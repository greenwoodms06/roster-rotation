# Session Prompt: Flexible Game Segments & Player Count

## Goal

Two related generalizations to make the app truly format-agnostic:

1. **Arbitrary segment count** — replace the fixed 4-option game format dropdown with a free numeric input, and support adding segments mid-game
2. **Arbitrary player count per side** — replace the fixed format dropdown in season creation with a player-count stepper that auto-populates positions from the sport's known list

No engine changes needed — the rotation engine already accepts any `numPeriods` and any number of positions. This is purely UI + data flow.

---

## Feature 1: Arbitrary Segment Count ✅ DONE (v3.15)

> Implemented. See DESIGN_DECISIONS.md § "Arbitrary Segment Count" for final architecture. Cap is 999 (not 20). Remove-period modal has 4 options (Rebalance All / Rebalance After / Remove Only / Cancel) instead of the 3 originally planned. Constraint caps (Max periods/player, Max per position) also converted to stepper + "Any" sentinel to avoid row overflow at large period counts.



### Current State

Game Day has a `<select>` with 4 hardcoded options: 4 Quarters, 3 Periods, 2 Halves, 1 Game. Settings has the same dropdown for the default. `getPeriodLabel()` maps 4→Quarter, 2→Half, and everything else→Period.

### Changes

#### 1a. Game Day — Replace dropdown with a stepper

Replace the `<select id="gamePeriods">` with a compact +/− stepper (same pattern used for custom field positions). Minimum value: 1. No hard maximum but practical suggestion of ~20.

Display should show the count and the auto-derived label. Examples:
- `[ − ]  4 Quarters  [ + ]`
- `[ − ]  2 Halves  [ + ]`
- `[ − ]  6 Periods  [ + ]`
- `[ − ]  1 Game  [ + ]`

`getPeriodLabel` already handles the fallback: 4=Quarter, 2=Half, 1=Game, everything else=Period. No changes needed there.

#### 1b. Settings — Same stepper for default game format

Replace the `<select id="settingsDefaultPeriods">` dropdown with the same +/− stepper widget. This sets `settings.defaultPeriods` which seeds the Game Day stepper.

#### 1c. Add segments mid-game (Lineup tab)

After a game plan is generated, add a `[ + Add Period ]` button at the bottom of the lineup card list (below the last period card). Tapping it:

1. Increments `currentPlan.numPeriods` by 1
2. Calls the engine's rebalance logic to generate the new period using existing periods as frozen history. This is conceptually the same as `rebalanceFromPeriod(newPeriodIndex)` — all prior periods are frozen, and only the new appended period is generated.
3. Appends the new `periodAssignment` to `currentPlan.periodAssignments`
4. Saves and re-renders

**Implementation approach:** The existing `rebalanceFromPeriod(fromIdx)` freezes periods 0..fromIdx-1 and regenerates fromIdx onward. To add a period:
- Set `currentPlan.numPeriods++`
- Call the rebalance with `fromPeriod = oldNumPeriods` (i.e., regenerate only the newly added period)
- The engine will use the frozen history to pick fair assignments for the new period

**Edge case:** If `rebalanceFromPeriod` expects the plan to already have the right number of `periodAssignments`, you may need to push a placeholder entry first, or modify the rebalance call to accept a "generate from this index with this total count" parameter. Examine how `rebalanceFromPeriod` works and adapt accordingly. The key constraint is: do not re-generate any existing periods — only generate the new one(s) using all prior periods as frozen context.

**Label:** The button label should use the period label: "Add Quarter", "Add Half", "Add Period" etc. via `getPeriodLabel()`.

**Goal tracking warning:** Same as existing rebalance — if goal data exists, warn before proceeding (though for appending this is less of a concern since no existing data is overwritten).

#### 1d. Remove segments mid-game (Lineup tab)

Each period card should have a delete/remove option (e.g., a trash icon in the period card header, or a long-press action — use whatever pattern fits the existing UI best, but keep it hard enough to avoid accidental taps on the sideline). Only allow removal if `numPeriods > 1`.

When the coach taps remove on a period card, show a modal with three options:

1. **Remove & Rebalance** — deletes the period and rebalances all periods after the removed one. For example, removing P2 from a 4-period game: P1 stays frozen, P3 and P4 are regenerated as a fair 2-period plan using P1 as frozen history. `numPeriods` decrements by 1.
2. **Remove Only** — deletes the period and shifts later periods down (P3→P2, P4→P3) with no regeneration. Assignments stay as-is. `numPeriods` decrements by 1. This is a quick "we planned too many" action.
3. **Cancel**

**Goal data warning:** If the period being removed (or any period that would be regenerated in the Rebalance option) has goal data, warn the coach before proceeding — same pattern as existing rebalance warnings.

**Implementation:** Removing a period means splicing it out of `currentPlan.periodAssignments`, decrementing `currentPlan.numPeriods`, saving, and re-rendering. For the rebalance option, after splicing, call `rebalanceFromPeriod` starting at the index where the removed period was.

---

## Feature 2: Arbitrary Player Count (Positions Per Side) ✅ DONE (v3.16)

> Implemented with expanded scope. See DESIGN_DECISIONS.md § "Unified Sports Shape (v3.16)" for final architecture. Deviations from the original plan:
> - `formations.js` rewritten to one unified shape per sport (`byCount`, `positionPool`, `defaultN`, `hasSpecialFirst`, `fieldBg`). Deleted parallel tables `FORMATIONS`, `POSITION_PRESETS`, `SPORT_ICONS`, and the `makePresetKey`/`parsePresetKey` helpers (kept `parseLegacyPresetKey` as a read-path compat shim only).
> - Season storage now writes `{sport, playerCount}`; legacy `preset: "soccer-7v7"` seasons still read fine. `settings.defaultFormat` migrates to `settings.defaultPlayerCount` on load.
> - Cap at **20** (not unlimited) because brute-force Phase 3 solver becomes slow above N≈10. Hungarian swap queued as a future session.
> - Editing the positions text field flows **back** to update the stepper count (coupling is bidirectional).
> - Changing sport mid-modal resets count to that sport's `defaultN`; the initial modal open still honors `settings.defaultPlayerCount`.
> - N>10 slow-toast warning skipped per user request (deferred with the Hungarian work).



### Current State

Season creation has two dropdowns: Sport (soccer, football, etc.) and Format (5v5, 7v7, etc.). The format dropdown is populated from `SPORTS[sport].formats` — each format has a fixed `positions` array. Choosing a format fills the positions text input. The user can also pick "Custom" sport and type positions freely.

The standalone Field tab already has a +/− stepper for custom player count (generating P1..Pn labels).

### Changes

#### 2a. Season creation — Replace format dropdown with player count stepper

Replace the format `<select>` with a +/− stepper showing the count and an NvN label. The sport dropdown stays.

When sport is selected (e.g., Soccer):
- Show the stepper initialized to the sport's most common format count (e.g., Soccer defaults to 7)
- Display: `[ − ]  7v7  [ + ]`
- The positions text input auto-populates based on the sport's known position lists

**Position auto-population logic:** Each sport in `SPORTS` has an ordered list of formats with position arrays. These arrays are ordered from smallest to largest format. Use them as a "position pool" for the sport:

- **Decreasing count:** Remove positions from the largest format that matches, dropping from the end of the list (typically the most specialized/forward positions). For example, Soccer 7v7 is `[GK, LB, RB, LW, CM, RW, ST]`. Dropping to 6 removes ST. Dropping to 5 removes RW (matching the actual 5v5 preset: GK, LB, RB, CM, ST — but note the order differs, so prefer using the actual smaller preset if one exists at that count).
  
  **Better approach:** If a preset exists at the target count, use it exactly. If no preset exists at that count, take the next-larger preset and trim from the end. This way known formats are always correct, and in-between counts get reasonable defaults that the coach can edit in the positions text field.

- **Increasing count:** If a preset exists at the target count, use it. If not, take the next-smaller preset and append generic labels (e.g., `P6`, `P7`) for the extra slots. The coach can rename them in the positions text field.

- **Custom sport:** Same as current standalone field behavior — generates P1..Pn.

The positions text input remains editable so the coach always has final say.

#### 2b. Preset key handling

Currently `makePresetKey` produces keys like `soccer-7v7`. With arbitrary counts, a season might be `soccer` with 6 positions — no matching preset key. 

**Approach:** Store the preset as the nearest matching key if one exists (e.g., `soccer-7v7` if positions match exactly), otherwise store `soccer` (sport only, no format suffix). The `getSeasonPreset()` fallback via `matchPresetFromPositions` already handles this — if positions don't match any preset, it returns null, which triggers `generateAutoLayout`. This is fine; just make sure the season's `preset` field is set to the best match or the sport-only key.

When loading a season for field rendering:
- If preset matches a known format → use its formations and field background
- If preset is sport-only (no format match) → use the sport's field background + auto-generated layout
- This already works via the existing fallback chain in `getFieldFormations()`

#### 2c. Settings — Default field format

The settings "Field format" dropdown currently lists the formats for the selected sport. This should also become a stepper, consistent with season creation. When the default sport changes, reset the count to that sport's default format size.

#### 2d. Standalone field tab

The standalone field tab already has a +/− stepper for Custom sport. For non-custom sports, it currently shows a format dropdown. Replace that dropdown with the same stepper pattern for consistency. This way the interaction is identical everywhere: pick a sport, then +/− to set player count.

#### 2e. Engine limit note

The brute-force permutation solver in Phase 3 evaluates all N! position assignments. This is fast up to N=10 (3.6M permutations). At N=11 (39.9M) it will be noticeably slow on a phone. **For this session, do not change the algorithm.** Just add a practical note or soft cap: if positions > 10, show a toast warning "Large position count — generation may be slow" but still allow it. A future session will implement the Hungarian algorithm for large N.

---

## UI Design Notes

### Stepper Widget Pattern

Use a consistent stepper component everywhere. The app already has a stepper pattern in the standalone field's custom sport +/− buttons. Generalize it:

```
┌─────────────────────────┐
│  [ − ]   7v7    [ + ]   │   ← player count (season creation, settings, standalone field)
│  [ − ]  4 Quarters [ + ]│   ← segment count (game day, settings)
└─────────────────────────┘
```

- Thumb-friendly: buttons should be at least 44×44px tap targets
- The center label is display-only (not editable — use the buttons)
- Visually match existing constraint controls styling (the tri-toggle buttons, etc.)
- `−` button disables at minimum (1 for segments, 2 for positions since engine needs ≥2)
- No hard maximum but disable `+` at a sensible cap if desired (e.g., 20 segments, 15 positions)

### Format label in the stepper

For the **player count stepper**: show `NvN` as the label (e.g., "7v7", "5v5", "11v11"). This is universal across sports and immediately communicates what the number means.

For the **segment count stepper**: show the count + period label (e.g., "4 Quarters", "6 Periods", "2 Halves"). Use `getPeriodLabel()` for the word.

---

## Files Likely Modified

- **`app.js`** — season creation modal (replace format dropdown with stepper), game day (replace format dropdown with stepper), settings (replace both format dropdowns with steppers), add-period button on lineup tab, position auto-population logic
- **`index.html`** — replace `<select>` elements with stepper markup in game day card, settings panel, and season modal
- **`field.js`** — standalone sport selector (replace format dropdown with stepper for non-custom sports)
- **`formations.js`** — possibly add a helper to get the "position pool" for a sport (ordered union of all format positions), or a function to find the best position list for a given sport + count
- **`styles.css`** — stepper component styles (may already exist for custom field stepper; generalize if needed)

## Files NOT Modified

- **`engine.js`** — no changes. It already handles any numPeriods and any position count.
- **`storage.js`** — no changes. Data model already supports arbitrary periods and positions.
- **`sw.js`**, **`manifest.json`** — no changes.

---

## Testing Considerations

- Verify existing tests still pass (segment counts 1-4, standard presets)
- Test segment stepper at boundary values: 1 (minimum), large numbers like 10+
- Test player count stepper: stepping through known presets (should exactly match), stepping to in-between values (should produce reasonable positions), stepping past the largest preset (should append generic labels)
- Test add-period mid-game: verify only the new period is generated, prior periods are untouched, season stats correctly include the extra period
- Test remove-period mid-game: verify "Remove Only" leaves other periods unchanged, "Remove & Rebalance" correctly regenerates subsequent periods, goal data warnings fire when appropriate, cannot remove below 1 period
- Test that field tab correctly falls back to auto-layout for non-standard position counts
- Test that backup/restore roundtrips work with non-standard segment and position counts (they should — the data model is already flexible)

---

## Out of Scope (Future Sessions)

- Hungarian algorithm for N>10 positions (current brute-force stays, with a warning toast)
- Per-segment custom labels (e.g., naming drives "Drive 1", "Drive 2" instead of "Period 1")
- Custom period label override (always use the auto-derived Quarter/Half/Period/Game labels)
- **Formation curation:** The current formation presets for some sports include multiple layouts that look nearly identical on the small phone-sized SVG field (e.g., two soccer 7v7 formations that differ by a few pixels of width). A future pass should audit all sport/format formation lists and either remove visually redundant layouts or replace them with formations that are meaningfully distinct on a small screen. Keep only formations where a coach would glance at the field diagram and immediately see a different shape. This doesn't block anything in this session but should be done soon.
