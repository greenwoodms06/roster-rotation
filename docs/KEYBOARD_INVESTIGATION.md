# Keyboard-vs-Modal Investigation Tracker

## Problem Summary

Text inputs inside modals misbehave across platforms due to virtual keyboard handling. The current implementation applies a blanket 60% height constraint on `focusin` for **all** platforms, including desktop (which has no virtual keyboard), causing modals to shrink unexpectedly on desktop.

## Platform Behavior Matrix

| Platform | Virtual KB? | `visualViewport` shrinks w/ `overlays-content`? | Needed fix |
|----------|-------------|--------------------------------------------------|------------|
| Android Chrome | Yes | **Yes** — accurate dimensions | Use `visualViewport` resize |
| iOS Safari | Yes | **No** — that's the point of `overlays-content` | Heuristic (focusin-based) |
| Desktop Chrome/FF/Safari | No | N/A | Do nothing |

## History of Approaches

### Approach 1 — Default viewport (no `overlays-content`)
- **Result:** iOS Safari pushed the entire page upward on keyboard open, shoving the bottom-sheet modal off-screen. Coach couldn't see the input.
- **Status:** ❌ Abandoned

### Approach 2 — `interactive-widget=overlays-content` + `focusin` scrollIntoView
- Added `overlays-content` to viewport meta → page stays still, keyboard overlays.
- Simple `focusin` listener calls `scrollIntoView` on focused input.
- **Result:** Player edit modal (input near top) worked fine. Team/season modals (input in middle/bottom) still covered by keyboard because `scrollIntoView` doesn't know the keyboard is there.
- **Status:** ❌ Partially worked

### Approach 3 — `focusin` with 60% height heuristic + `visualViewport` refinement (CURRENT)
- On `focusin` inside a modal, immediately set overlay height to `window.innerHeight * 0.6`.
- `visualViewport` resize handler refines with exact dimensions on Android.
- `focusout` resets overlay.
- **Result on mobile:** Mostly works but the 60% heuristic is aggressive and may not match actual keyboard size.
- **Result on desktop:** ❌ **BROKEN** — clicking any modal input shrinks the modal to 60% of window height. No virtual keyboard exists, so the modal just gets small for no reason. This is the primary reported bug.
- **Status:** ❌ Current code — needs fix

### Approach 4 — Guard with virtual keyboard detection + skip numeric inputs
- Only run handler on `pointer: coarse` devices.
- Skip `type="number"` / `inputMode="numeric"` inputs (small keypad).
- **Result on Android:** Modal stacking fixed. But modal floated in the middle of the screen because the *overlay* was shrunk (height + top) while `align-items: flex-end` positioned the modal at the bottom of the shrunken overlay — visually the middle of the screen. When keyboard dismissed, reset sometimes didn't fire, leaving the modal stuck.
- **Result on iOS:** Apple users report not fixed.
- **Status:** ❌ Overlay-resize approach fundamentally flawed

### Approach 5 — Resize the MODAL, not the overlay
- Keep the overlay full-screen (`inset: 0`) at all times. Never touch overlay styles.
- On `focusin`, set `max-height` on the `.modal` element to fit above the keyboard.
- The overlay's `align-items: flex-end` keeps the modal anchored to the **bottom of the screen** — right above the keyboard.
- The modal's `overflow-y: auto` makes its content scrollable within the shorter height.
- `scrollIntoView` scrolls the focused input into the visible portion.
- On `focusout`, reset `max-height` to `''` (reverts to CSS default `85dvh`).
- **Why this is better:** The modal never leaves the bottom of the screen. No floating. No overlay manipulation means the backdrop tap-to-dismiss works normally. Reset is simpler (just clear one style on the modal).
- **Detection:** Still guarded by `pointer: coarse` (desktop skipped entirely).
- **Numeric inputs:** Still skipped (small keypad doesn't need resize).
- **Android:** `visualViewport` refinement sets exact `max-height = vv.height - 20`.
- **iOS:** Heuristic sets `max-height = innerHeight * 0.55`.
- **Status:** ❌ Missing margin-bottom — modal stayed behind keyboard on Android

### Approach 6 — Resize modal max-height AND add margin-bottom (v4 zip — DEPLOYED)
- Same as approach 5 but also sets `margin-bottom` on the modal equal to the keyboard height.
- With `overlays-content`, the layout viewport extends behind the keyboard. `align-items: flex-end` puts the modal at the true bottom of the screen — under the keyboard. `margin-bottom` pushes it up above the keyboard.
- On Android: `margin-bottom = kbHeight` (exact from visualViewport).
- On iOS: `margin-bottom = innerHeight * 0.45` (heuristic, same as max-height calc).
- On keyboard close: clear both `maxHeight` and `marginBottom` → modal returns to bottom.
- **Result on Android:** Modal jumps up entirely — visually jarring. Sticky after keyboard dismiss (input keeps focus, focusout never fires).
- **Status:** ✅ Currently deployed (v4). Keyboard behavior still under evaluation.

### Approach 7 — VV reset without _kbUsedVV guard (v5 zip)
- Removed `_kbUsedVV` requirement for reset — resets whenever `kbHeight < 50`.
- Added auto-detection of active modal from `document.activeElement` in VV handler.
- **Result on Android:** No change in behavior observed.
- **Status:** ❌ Reverted to v4

### Approach 8 — padding-bottom inside modal, no movement (v6 zip)
- Modal stays anchored at the bottom of the screen. No margin-bottom, no max-height changes.
- On keyboard open: add `padding-bottom` inside the modal equal to keyboard height. This creates scrollable space below the content.
- `scrollIntoView({ block: 'center' })` scrolls the focused input to the center of the visible area above the keyboard.
- The modal doesn't move — only its internal scroll position changes. Minimal visual disruption.
- On keyboard close: clear `padding-bottom`, modal content snaps back to normal.
- VV handler auto-detects active modal if focus stayed after a previous reset (Android dismiss button).
- **Status:** ⏸️ Not tested yet — may revisit

## iOS Date Input Overlap Bug

**Problem:** On iOS Safari, `input[type="date"]` overflows its flex container and overlaps the adjacent "Game format" select dropdown on the Game Day tab.

**Root cause:** Safari renders date inputs with `display: inline-flex` and internal shadow DOM elements (`::-webkit-datetime-edit`) that enforce intrinsic width, ignoring flex container constraints. Combined with flex items defaulting to `min-width: auto`, the date input refuses to shrink.

### Fix attempt 1 — `min-width: 0` on flex children
```css
.field-row > * { flex: 1; min-width: 0; }
```
- **Status:** ❌ Did not fix the overlap on iOS. The overflow comes from Safari's internal shadow DOM, not the flex container.

### Fix attempt 2 — Target shadow DOM + `display: block`
```css
input[type="date"] { display: block; min-width: 0; box-sizing: border-box; }
input[type="date"]::-webkit-datetime-edit { display: block; padding: 0; line-height: 1; }
input[type="date"]::-webkit-datetime-edit-fields-wrapper { padding: 0; }
.field-row > * { overflow: hidden; }
```
- `overflow: hidden` on parent prevented overlap but clipped the border-radius, making the date field look chopped off.
- Moving `overflow: hidden` to the input itself didn't prevent the overlap at all.
- Adding `border-radius: var(--radius-sm)` to the parent improved the clip appearance but overlap persisted.
- The `display: block` also caused the date input to render taller than the adjacent select.
- **Status:** ❌ Either overlap or clipping; height mismatch

### Fix attempt 3 — `-webkit-appearance: none` (DEPLOYED ✅)
```css
input[type="date"] {
  -webkit-appearance: none;
  appearance: none;
  display: block;
  min-width: 0;
  box-sizing: border-box;
}
input[type="date"]::-webkit-datetime-edit { padding: 0; }
input[type="date"]::-webkit-datetime-edit-fields-wrapper { padding: 0; }
.field-row > * { overflow: hidden; border-radius: var(--radius-sm); }
```
- Strips Safari's special intrinsic sizing entirely so the date input behaves like a normal input for layout.
- The native iOS date picker wheel still works (picker is triggered by `type="date"`, not appearance).
- No overlap, no height mismatch, no clipping.
- Three of four AI sources (ChatGPT, Sonnet, Perplexity) warned this might break the picker — Gemini said it wouldn't. **Gemini was correct.**
- **Status:** ✅ Confirmed working on iOS Safari

## Related Bug: SELECT Elements Triggering Keyboard Handler

**Problem:** Tapping a `<select>` dropdown (e.g., player picker in Edit Lineup modal) triggered the keyboard resize handler. Select elements open native pickers, not keyboards — but the `focusin` handler treated them the same as text inputs, applying `margin-bottom` / `max-height` changes that pushed the modal off screen. Appeared as the modal "exiting" when trying to select a player.

**Fix:** Removed `SELECT` from both the `focusin` trigger check and the `focusout` still-in-modal check. Only `INPUT` and `TEXTAREA` now trigger keyboard handling.

## Key Files

- `index.html` line 5 — viewport meta with `interactive-widget=overlays-content`
- `app.js` lines 5078–5153 — keyboard handler section
- `sw.js` line 1 — cache version (bump on changes)

## Open Questions

1. Do inline inputs (game label, game notes on Lineup tab) need similar treatment? They're not in modals — user can scroll the page.
2. Should the 60% heuristic be replaced with a CSS `env(keyboard-inset-bottom)` approach when browser support improves?
3. On iPads with hardware keyboards, `pointer: coarse` is still true — the handler fires but no keyboard appears. Harmless (focusout resets quickly) but worth noting.

## Related Bug: Modal Stacking

**Problem:** Clicking "+ New" in the context picker (team/season chooser) opened the team or season modal *on top of* the still-visible context picker. Two overlays stacked.

**Fix:** `openTeamModal()` and `openSeasonModal()` now call `closeContextPicker()` first.

## Related Bug: Numeric Input Resize

**Problem:** Tapping duration number inputs (period duration in settings or game setup) triggered the full keyboard resize handler, shrinking the modal to 60%. The numeric keypad is much smaller than a full keyboard and doesn't need this.

**Fix:** The `focusin` handler now skips `type="number"` and `inputMode="numeric"` inputs.

## Testing Checklist

- [ ] **Desktop Chrome:** Click inputs in player/team/season modals — modal stays full size
- [ ] **Desktop Firefox:** Same as above
- [ ] **Desktop Safari:** Same as above
- [ ] **Android Chrome (Pixel):** Player edit modal — input visible above keyboard
- [ ] **Android Chrome (Pixel):** Team creation modal — input visible above keyboard
- [ ] **Android Chrome (Pixel):** Season creation modal — all inputs accessible
- [ ] **iOS Safari (iPhone):** Player edit modal — input visible
- [ ] **iOS Safari (iPhone):** Team/season modals — inputs visible
- [ ] **iOS Safari (iPhone):** Closing keyboard restores modal to full height
- [ ] **All platforms:** Modal backdrop tap-to-dismiss works
- [ ] **All platforms:** Scrolling within tall modal works normally
