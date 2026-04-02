# Feature Brief: Custom Confirm/Alert Modals

## Context
Replace all browser-native `confirm()` and `alert()` dialogs with themed custom modals that match the app's dark/light theme. The native dialogs are browser-chrome styled, can't be themed, and look jarring on Android.

---

## Scope: 10 Dialogs Across 2 Files

### app.js (8 dialogs)

| Line | Type | Context | Style | Confirm Label |
|------|------|---------|-------|---------------|
| 464 | confirm | Delete season | destructive | Delete |
| 486 | confirm | Delete team + all seasons | destructive | Delete |
| 795 | confirm | Delete/remove player | destructive | Remove |
| 1133 | alert | Not enough players to generate | info | OK |
| 1216 | alert | Engine error during generation | info | OK |
| 1486 | confirm | Delete game | destructive | Delete |
| 2204 | confirm | Restore backup (replaces all data) | destructive | Replace |
| 2312 | confirm | Import shared team (add or replace) | neutral | Import |

### field.js (2 dialogs)

| Line | Type | Context | Style | Confirm Label |
|------|------|---------|-------|---------------|
| 827 | confirm | Overwrite existing play name | neutral | Overwrite |
| 919 | confirm | Delete play | destructive | Delete |

---

## API Design

Single reusable function in `app.js` (globally accessible since field.js needs it too):

```js
function showModal({ title, message, confirmLabel, cancelLabel, destructive, onConfirm })
```

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| title | string | required | Modal heading (e.g. "Delete Player") |
| message | string | required | Body text. Supports `\n` for line breaks |
| confirmLabel | string | `'OK'` | Primary button text |
| cancelLabel | string\|null | `'Cancel'` | Secondary button text. `null` = alert-style (no cancel) |
| destructive | boolean | `false` | If true, confirm button uses `.btn-danger` (red) |
| onConfirm | function | required | Called when confirm button is tapped |

### Behavior

- Rendered as a dynamically created DOM element (same pattern as `showTournamentModal`)
- Overlay covers screen with semi-transparent backdrop
- Escape key dismisses (same as cancel)
- Tapping overlay backdrop dismisses (same as cancel)
- `role="dialog"` + `aria-modal="true"` for accessibility
- Focus trapped within modal while open
- Only one `showModal` instance at a time (dismiss existing before showing new)
- Modal ID: `customModal` (for cleanup)

### Alert-style (info only)

For the two `alert()` replacements, call with `cancelLabel: null`:

```js
showModal({
  title: 'Not Enough Players',
  message: `Need at least ${roster.positions.length} players!`,
  cancelLabel: null,
  onConfirm: () => {}  // just dismisses
})
```

---

## HTML Structure

```html
<div class="modal-overlay" id="customModal">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="customModalTitle">
    <h2 id="customModalTitle">{title}</h2>
    <div class="modal-message">{message}</div>
    <div class="modal-actions">
      <!-- cancel button (omitted for alert-style) -->
      <button class="btn btn-ghost">{cancelLabel}</button>
      <!-- confirm button -->
      <button class="btn btn-primary|btn-danger">{confirmLabel}</button>
    </div>
  </div>
</div>
```

---

## CSS Additions (styles.css)

```css
/* Custom modal message body */
.modal-message {
  font-size: 14px;
  color: var(--fg2);
  line-height: 1.5;
  margin-bottom: 16px;
  white-space: pre-line;       /* respect \n in message text */
}

/* Modal action button row */
.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* Ghost/cancel button for modals */
.btn-ghost {
  background: none;
  border: 1.5px solid var(--border);
  color: var(--fg2);
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.btn-ghost:active {
  background: var(--hover);
}
```

Note: `.btn-danger` already exists in styles.css. `.btn-primary` and `.btn-outline` already exist. The `.modal-overlay` and `.modal` base classes already exist and handle backdrop, centering, animation, and theme colors.

---

## Conversion Guide

Each replacement follows the same pattern. Before:

```js
if (!confirm('Remove Alex?')) return;
// ... do the thing
```

After:

```js
showModal({
  title: 'Remove Player',
  message: 'Remove Alex?',
  confirmLabel: 'Remove',
  destructive: true,
  onConfirm: () => {
    // ... do the thing
  }
});
return;  // function exits; onConfirm handles the rest
```

**Key refactor note:** Every `confirm()` call currently gates synchronous code that follows it. Converting to the async modal means the code after `confirm()` must move into the `onConfirm` callback. This may require extracting the post-confirm logic into a named helper function if it's more than a few lines.

---

## Tournament Modal

The existing `showTournamentModal()` stays as-is for now — it has 3 buttons with distinct actions (Add Game N / Replace / Cancel) which doesn't fit the 2-button `showModal` pattern. It could be refactored later to use the same overlay/styling, but that's optional cleanup, not part of this task.

---

## Service Worker

Bump cache version after implementation.

---

## Test Coverage

Manual testing checklist (no automated tests needed — these are pure UI):

- [ ] Each of the 10 dialogs renders with correct title, message, and button labels
- [ ] Destructive modals show red confirm button
- [ ] Alert-style modals show only one button (OK)
- [ ] Escape key dismisses modal (triggers cancel path)
- [ ] Backdrop tap dismisses modal
- [ ] Theme colors work in both dark and light mode
- [ ] Modal doesn't scroll page behind it on mobile
- [ ] Focus is on confirm button when modal opens
