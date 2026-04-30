# Development Roadmap

## Completed

### Core Engine
- [x] Core rotation algorithm (Python + JS port)
- [x] Three-phase engine: time allocation > period scheduling > position assignment
- [x] Position weighting (prefer toward, hard exclude)
- [x] Season-level fairness with absence neutrality
- [x] `first_available_start` option (first N in list start period 1)
- [x] Configurable periods (4 quarters, 3 periods, 2 halves)
- [x] Sport-agnostic position presets (soccer 7/9/11v11, football 7/11v11, baseball, basketball, hockey, lacrosse, custom)

### Lineup Constraints
- [x] Position locks / pinning -- coach pins a player to a specific position before generating
- [x] Position continuity weight -- tunable stickiness (Off/Med/High) to reduce position changes between periods
- [x] Special position max -- cap how many periods any player can play positions[0] (GK, G, etc.)
- [x] Global max periods per player -- sport-agnostic cap on total periods any player can play in a game
- [x] Constraint UI: collapsible panel on Game Day with badge count, inline lock picker on player names
- [x] Backward compatibility -- all constraints default to off, no behavior change when unused
- [x] Constraint validation -- errors for duplicate position locks, locks on excluded positions, locks on unavailable players
- [x] Late arrival -- add a player mid-game, rebalance remaining periods fairly
- [x] Early departure -- remove a player mid-game (injury/leaving), rebalance remaining periods
- [x] Rebalance from period -- re-optimize any periods forward, freezing earlier periods. Goals warning for affected periods.

### PWA & UI
- [x] PWA with offline support (service worker with update detection and user-prompted activation)
- [x] Mobile-first dark theme UI with 5 tabs (Roster, Game Day, Lineup, Season, Field)
- [x] Custom rotation arrows SVG header icon (sport-agnostic)
- [x] Player add/edit/delete with position weight cycling
- [x] Game day: check available, reorder, generate
- [x] Lineup display with period cards and player summary
- [x] Post-generation lineup swaps (field<>field, field<>bench) with tap-to-select
- [x] Swap feedback: pulse animation on swapped rows + descriptive toast ("Swapped Alex and Blake")
- [x] Share lineup: copy to clipboard, native share (mobile), download as text
- [x] Season stats table with per-position breakdown
- [x] Game history with "View" past games
- [x] All tabs properly cleared when last team/season is deleted
- [x] Custom confirm/alert modals (themed, accessible, replaces all native dialogs)
- [x] Donate dropdown (PayPal + Venmo)
- [x] Pinch zoom enabled globally (touch-action: manipulation)
- [x] PWA update banner -- detects new service worker, prompts user with backup reminder before updating
- [x] Mobile keyboard fix -- visualViewport API repositions bottom-sheet modals above on-screen keyboard

### Multi-Team / Multi-Season
- [x] Team create/delete with context switching
- [x] Season create/delete with position preset selection
- [x] Copy roster from previous season when creating new season
- [x] Per-season positions (different sports/formats per season)
- [x] Repo folder structure: `data/teams.json` > `{team}/team.json` > `{team}/{season}/roster.json + games.json`

### Data & Privacy
- [x] Privacy separation: template roster (placeholder names) for repo, real names device-only
- [x] v3 backup format: complete snapshot (all teams, seasons, rosters, games, plays, standalone plays, active context)
- [x] Backup & Restore: full-replace with preview and auto safety-net backup before overwriting
- [x] Share Team / Import Team: single-team export/import with add-or-replace semantics
- [x] File share uses .txt extension for Android compatibility, import accepts .json and .txt
- [x] GitHub Pages deployment
- [x] Python reference implementation preserved in `python/`

### Field Visualization & Formations
- [x] Field tab: top-down SVG field diagram with draggable player dots
- [x] Sport-specific field backgrounds (soccer, basketball, hockey, lacrosse, football, baseball, generic)
- [x] Formation layouts per sport preset (multiple formations per sport)
- [x] Formation selector dropdown with reset button
- [x] Template mode (position labels) and game mode (player names + period pills)
- [x] Smooth pointer-event-based drag handling via HTML touch overlays (touch + mouse)
- [x] Field panning: scroll page by swiping on field background, pinch zoom on field
- [x] Auto-generated grid layout fallback for custom positions
- [x] Preset key stored with season for field type discovery
- [x] About modal explaining algorithm and usage
- [x] Standalone mode: full interactive field without team/season (sport/format selector, plays, routes, defense)
- [x] Field Only context picker option for quick access to standalone field
- [x] Custom sport: +/- dot controls with generic labels (P1..Pn), field background selector
- [x] Soccer penalty arc direction fix (arcs curve toward center field)
- [x] Lacrosse goal/crease positioning fix (14% from end line, matching real field proportions)

### Field Plays & Diagramming
- [x] Save/load named plays with custom dot positions
- [x] Play actions dropdown menu: save as new, overwrite, delete
- [x] Case-insensitive duplicate name detection with overwrite prompt
- [x] Reset-to-saved button (restores play's saved dot positions)
- [x] Play name filter (appears when >5 plays saved)
- [x] Route drawing: toggle draw mode, touch-drag to draw movement paths
- [x] Smooth bezier curve rendering with point downsampling
- [x] Opaque arrowheads with proper orientation (manual polygon, not SVG markers)
- [x] Trimmed stroke endpoints (line tucks under arrowhead cleanly)
- [x] Per-route selection: tap a route in draw mode to select, then delete
- [x] Undo last route and clear all routes
- [x] Defense overlay: toggle DEF mode, draggable X markers (red, semi-transparent)
- [x] Defense auto-seeded to match position count, add/remove buttons
- [x] Plays persist routes and defense markers; restored on load
- [x] Plays included in full backup export/import
- [x] Zone drawing: freehand closed shapes with semi-transparent fill, 4-color palette (blue/red/yellow/green)
- [x] Zone selection via tap, delete selected, undo last, clear all
- [x] Zones layered above field background, below routes/dots/defense
- [x] Zones persist with plays and included in backup

### Season Analytics
- [x] Season Summary: games, W-L-D record, roster size, avg availability, goals for/against with GD, shutouts
- [x] Playing time bar chart (relative to team avg, color-coded fairness)
- [x] Availability dot chart (Games sub-tab): availability trend with W/L/D/S letters, fairness-colored dots
- [x] Position distribution stacked bar chart per player
- [x] Goals bar chart (when goal data exists)
- [x] Per-game fairness spread badges in game history

### Code Quality
- [x] File split: `js/formations.js`, `js/credit.js`, `js/storage.js`, `js/engine.js`, `js/field.js`, `js/app.js`
- [x] CSS extracted: `css/styles.css` (from inline `<style>` block)
- [x] Folder structure: `js/`, `css/`, `icons/`, `docs/`, `tests/`, `python/`
- [x] Code cleanup: dead code removal, naming consistency, duplicate logic consolidated
- [x] Accessibility: aria-labels, dialog roles, focus trap, Escape key handler
- [x] All files pure ASCII (no encoding issues across platforms), no path-comment headers
- [x] Test suite: 1303 assertions across 6 suites (`node tests/run_all.mjs`): engine (355), formations (550), storage (125), credit (115), swap/sub (94), app logic (64)
- [x] Test harness: VM sandbox with localStorage mock, DOM stubs, per-suite isolation
- [x] Bug fixes: broken HTML comment, stale tab state, closeImportModal double-toggle, firstAvailableStart allocation bug (non-starters capped correctly)

### v4 Sub Tracking & Fractional Credit
- [x] v4 data model: per-position arrays of `{pid, timeIn, timeOut}` entries with normalized 0.0-1.0 fractions
- [x] Unified swap popup with time picker: Swap (default), fraction buttons (¼/⅓/½/⅔/¾), Approx/Exact toggle for second-precise stepper
- [x] Single Confirm button for all actions; Reset to full period as de-emphasized text link for corrections
- [x] Tap-order-independent swap system: `resolveSwapLocations` scans data to determine player locations
- [x] Derived visual bench from assignments (not stored list)
- [x] Replace cleanup: `removePlayerFromOtherPositions` prevents >100% credit
- [x] Post-mutation validation: `validateAssignments` catches duplicate last-occupants
- [x] Player time popup: all-period detail view with position-colored bars, time markers, reset buttons (per-period and full-game)
- [x] Game clock: play/pause, reset, count up/down, auto-fill sub time in Fine mode
- [x] Period-end alert: two-tone sound + vibrate at end of period, repeats every 3s until paused/reset/advanced. Independent sound/vibrate toggles in Settings (any combination supported).
- [x] Position-colored timeline bars with gap spacers and tick marks at transitions
- [x] Bench bars below player chips (separated for touch targets)
- [x] Duration input: dual-field MM:SS with ▲/▼ steppers
- [x] Coarse fraction time labels (green hints under buttons)
- [x] ~~Downgrade modal~~ (removed — unified popup eliminates mode switching)
- [x] v3→v4 auto-migration on load and import
- [x] 1 Game format option (numPeriods=1)

### UX Polish
- [x] 12-color perceptual position palette (dark-background optimized)
- [x] Settings restructured: Game Structure + Tracking & Clock sections
- [x] Labels renamed: Game format, Segment length, Field format, Max segments/player
- [x] Clock direction default in Settings (↓ Down / ↑ Up)
- [x] Required field validation: red asterisk + shake on empty required fields
- [x] Empty-state guidance cards on all tabs

## Next Up

- [x] **App store distribution (Android)** -- Capacitor 5 wrap producing a signed `app-release.aab` for Google Play internal testing. Pinned to v5 (Flamingo IDE constraint), `www/` mirror webDir, native Share + Filesystem with patch-package fixes for two Android 14 crashes in `@capacitor/share@5.0.8`, custom `AndroidPrint` JS bridge in `MainActivity` (WebView's `window.print()` is silent without it), keystore lives outside repo with gradle `keystore.properties` seam. Session writeup in `docs/SESSION_PROMPT_CAPACITOR_WRAP.md`. iOS still pending.
- [ ] **App store distribution (iOS)** -- separate Capacitor wrap session for App Store. Will need to revisit the SW gating (WKWebView has no SW), the Share plugin path (uses native iOS share sheet), and signing (Apple Developer cert + provisioning profile). Probably blocked on having a Mac to build from.
- [ ] **Cloud backup** -- client-side backup to user's own cloud storage (Google Drive, iCloud). No backend. See docs/DISTRIBUTION_STRATEGY.md Phase 3.

## Recently Completed

- [x] **Arbitrary player count + sport refactor (v3.16)** -- Season creation's format dropdown replaced with a `+/−` "Players per side" stepper (2–20). Positions auto-fill from the sport's exact preset when available, else from a canonical `positionPool` (ordered essential → specialized), padding with `P#` for counts beyond the pool. Editing the Positions text field also updates the stepper. Changing the sport mid-modal resets the count to that sport's typical default. Same stepper pattern applied to Settings ("Players per side") and the standalone Field tab's non-custom sports. Internally, `formations.js` was rewritten to a single unified shape per sport (`{ name, icon, fieldBg, defaultN, hasSpecialFirst, positionPool, byCount: {N: {positions, formations}} }`) — deleted the parallel `FORMATIONS`, `POSITION_PRESETS`, `SPORT_ICONS` tables and the `makePresetKey` helper. Legacy `preset: "soccer-7v7"` season keys are read transparently via `parseLegacyPresetKey` compat shim; new seasons write `{sport, playerCount}`. Settings migrate `defaultFormat: "7v7"` → `defaultPlayerCount: 7` on load.
- [x] **Arbitrary segment count (v3.15)** -- Game Day and Settings "Game format" selectors replaced with a reusable `+/−` stepper (`renderStepperHtml()` helper). Any integer 1–999 allowed; label auto-derives ("4 Quarters", "2 Halves", "6 Periods", "1 Game"). New `[+ Add Period]` button on the Lineup tab appends a period mid-game via `rebalanceFromPeriod(oldNumPeriods)`. Each period card gets a trash icon opening a 4-option modal: *Rebalance All* (freeze nothing, regenerate from 0), *Rebalance After* (freeze earlier, regenerate tail), *Remove Only* (splice, no regeneration), *Cancel*. Goal-data impact is shown inline per option. Constraint controls (Max periods/player, Max per position) converted from tri-toggle button rows to the same stepper with an "Any" sentinel — scales cleanly past 4 periods without row overflow.
- [x] **Unified swap popup** -- Replaced three separate tracking modes (Simple/Coarse/Fine) with a single popup. Time picker row: Swap (default) + fraction buttons. Approx/Exact toggle for precision. One Confirm button. Reset to full period as text link. Eliminated mode dropdown from lineup header, removed downgrade modal, always-visible timeline bars.
- [x] **Help screen** -- Searchable, scrollable help modal accessible from ⋮ menu. Organized by section (Getting Started, Game Day, Lineup, Season, Field, Data & Backup) with title + description for every major feature. Real-time text filtering.
- [x] **Tab swipe navigation (v3.4)** -- Horizontal swipe on `#app` switches between tabs. Requires >60px horizontal, <400ms, clearly more horizontal than vertical. Skips when modals are open or touch starts on field-interactive elements (dot overlays, defense markers, draw layer).
- [x] **Unified sharing (v3.4)** -- All share flows (backup, team share, lineup share) route through a single `shareOrDownload()` function. Removed the 3-button lineup share popup menu (~50 lines deleted). On mobile: native share sheet. On desktop: direct file download.
- [x] **Desktop share fix (v3.4)** -- `shareOrDownload()` uses `navigator.userAgentData.mobile` (Client Hints API) instead of touch detection. Chrome on Windows falsely reports `maxTouchPoints > 0` and `ontouchstart` even without touch hardware. CSS `(pointer: coarse)` also unreliable. `userAgentData.mobile` is the only reliable mobile detection for Chromium; falls back to UA string regex for Safari/Firefox.
- [x] **Backup indicator (v3.4)** -- Amber dot on ⋮ menu button and inline on "Back Up" menu item when data has changed since last backup. Storage mutation methods are monkey-patched at init to auto-track changes via `markDataDirty()`. Dot clears after successful backup (`markBackupDone()`). Timestamps stored in `rot_lastDataChangeAt` / `rot_lastBackupAt`.
- [x] **Jersey number (v3.4)** -- Optional 2-character `number` field on player model. Entered alongside player name in the edit modal. Displayed as muted gray `#7` suffix via `displayNameHtml(pid)` in all HTML contexts (roster, game day, lineup, bench, season tables) and `displayNameSvg(pid)` with `<tspan>` in SVG charts. Field tab shows number on a separate line below the player name on dots. Plain text `displayName(pid)` used for share text and toasts.
- [x] **Position input sanitization (v3.4)** -- `sanitizePositions()` on `blur` of the positions input: auto-uppercase, space-as-delimiter fallback (when no commas), deduplication with toast, truncate tokens >5 chars, collapse empty tokens. Also called as safety net inside `saveSeason()`.
- [x] **Engine jitter (v3.4)** -- `Math.random() * 0.01` tiebreaker added to `_buildCostMatrix()`. Equally-fair lineups now vary between generations. Magnitude is ~100x smaller than the smallest real cost weight, so it only breaks ties, never overrides fairness decisions.
- [x] **Field panning & pinch zoom (v3.3)** -- Scrolling and pinch zoom now work on the field background. Dot dragging uses HTML overlay divs (with `touch-action: none`) positioned over SVG dots, because Chrome Android ignores `touch-action` on SVG `<g>` elements. SVG set to `pointer-events: none` so background touches pass through to the scrollable container. Draw/zone mode sets `touch-action: none` on the container to block scrolling during freehand drawing.
- [x] **Mobile keyboard fix (v3.3)** -- Bottom-sheet modals now reposition when the on-screen keyboard opens. Uses `visualViewport` API to detect keyboard height and repositions the modal overlay to fit the visible area. Save/Delete buttons are now always reachable without dismissing the keyboard.
- [x] **Season stats expansion (v3.2)** -- Season Summary card: roster size, avg availability, goals for/against with colored goal differential, shutouts. Availability dot chart on Games sub-tab: y-axis = players available, dot letter = W/L/D/S, dot color = fairness spread, connecting line shows trend. Compact sizing with smaller fonts.
- [x] **PWA update system (v3.2)** -- Service worker no longer auto-activates. App detects waiting SW and shows "Update available — Back up your data first, then tap Update" banner. `updateViaCache: 'none'` bypasses CDN cache. Visibility change and hourly poll trigger update checks. User taps Update → `SKIP_WAITING` message → page reloads with new version.
- [x] **Donate dropdown (v3.2)** -- ♥ Donate button opens dropdown with PayPal and Venmo links. Escape key and backdrop dismiss.
- [x] **Field improvements (v3.2)** -- Side margins on field container. Pinch zoom enabled globally via `touch-action: manipulation`.
- [x] **Lineup heading cleanup (v3.2)** -- game label as truncated second line, removed player/period subtitle, gap between heading and action buttons.
- [x] **Engine bug fix (v3.2)** -- `_allocatePlayingTime()` now accounts for `firstAvailableStart`, capping non-starters at `numPeriods - 1`. Fixes "?" appearing in last position with 8-9 players.
- [x] **Custom modals (v3.2)** -- `showModal()` replacing all 10 native confirm/alert calls. Themed, accessible.
- [x] **Settings defaults (v3.2)** -- continuity and globalMaxPeriods in Settings, engine enforcement, constraint panel.
- [x] **Late arrival & rebalance (v3.2)** -- `rebalanceFromPeriod()`, Edit Roster modal, rebalance ↺ icon.
- [x] **Zone drawing (v3.2)** -- freehand shapes, 4-color palette, persist with plays.
- [x] **Settings & light theme (v3.1)** -- Settings modal with Appearance, Game Day Defaults, Help sections. Light theme via CSS variables. System theme responds to OS changes.
- [x] **First-use hints (v3.1)** -- contextual tips per tab, dismiss individually or via Settings.
- [x] **Game labels (v3.1)** -- optional short label per game, auto-saves, displayed everywhere.
- [x] **Donate button (v3.1)** -- accent-colored pill in header.

## Future Ideas (Unprioritized)

### Algorithm & Constraints
- [ ] Position groups (offense / defense / special teams) — tabled; see `docs/IDEA_POSITION_GROUPS.md`. Deferred until a football coach asks for it. Two-seasons workaround serviceable in the interim.
- [ ] Buddy system: always-together or never-together player pairs
- [ ] Zone continuity: keep players in the same zone across periods
- [ ] Fatigue awareness: prefer not to play a player consecutive periods if subs are available
- [ ] Quick re-roll: add small random perturbation to cost function for alternative valid plans. Perhaps should just be the default behavior (hidden to the user)

### UI / UX
- [x] Light theme option
- [x] Help screen: searchable, scrollable feature reference accessible from ⋮ menu
- [ ] AI/LLM-assisted setup — copyable prompts + in-app "Paste from AI" importer for roster/team setup; see `docs/IDEA_AI_ASSISTED_SETUP.md`. Zero-backend, coach uses any LLM they already have.
- [ ] Method for providing standardized/anonymized feedback.
- [ ] Season modal: collapse "Players per side" stepper + "Positions" text field into a single input (the position list implies the count). Either hide the stepper, or make the stepper add/remove tokens from the end of the positions list. Needs UX design — custom abbreviations should stay editable.
- [ ] Formation curation: audit per-sport formation lists for visually redundant layouts on phone-sized SVG field (e.g., soccer 7v7 "2-3-1" vs "2-3-1 Narrow" differ by ~10 units). Keep only formations where a coach would immediately see a different shape.
- [ ] Hungarian algorithm for N > 10 positions: current brute-force permutation solver (Phase 3) becomes noticeably slow above ~10 positions on phone. Replace with Hungarian / Kuhn-Munkres for O(N³).

### Data & Backup
- [ ] Cloud backup: Google Drive provider (OAuth + appDataFolder)
- [ ] Cloud backup: iCloud provider
- [ ] QR code sharing between coaches' devices
- [ ] Backup history / versioning

### Season Analytics
- [x] Fairness score per game (how balanced was it?)
- [x] Season-level charts (bar chart of playing time distribution)
- [x] Position heat map per player across the season
- [ ] Export season report as PDF. 
- [ ] Export lineup as a standard roster card format (may differ per sport). Allow exporting all games or select games

### Platform
- [ ] Playwright browser integration tests (Python)
- [ ] iOS testing and any non-Chrome browser/Android/Pixel PWA fixes
