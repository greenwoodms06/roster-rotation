# Design Decisions & Technical Notes

## Why PWA Over Native

Evaluated BeeWare (Briefcase + Toga) and Chaquopy for native Android. Chose PWA because:
- The app has a simple UI with no need for native device APIs (no camera, GPS, Bluetooth)
- PWA works on Android AND iOS immediately with zero toolchain
- GitHub Pages hosting is free and simple
- Time-to-working-prototype was hours vs days/weeks

For app store distribution, the plan is to wrap the PWA as a Trusted Web Activity (TWA) using Bubblewrap for Google Play. This requires zero code changes — the TWA loads the PWA from GitHub Pages. See `APP_STORE_GUIDE.md` for details.

## Sport-Agnostic Design

The app is built to handle any NvN sport, not just soccer. Key design choices:
- Positions are defined per-season, not hardcoded. A season can use any set of position labels.
- Built-in presets for common formats: Soccer 7v7/9v9/11v11, Football 7v7/11v11, Baseball/Softball, Basketball 5v5, Hockey 6v6, Lacrosse 10v10, or fully custom.
- The algorithm doesn't know or care what the position labels mean — it just assigns N players to N positions using cost minimization.
- UI uses generic terms ("positions," "periods") rather than sport-specific ones.
- The header icon is a generic rotation arrows SVG, not a sport-specific emoji.

### Position Presets

Chosen based on the most common youth formations for each sport:
- **Soccer 5v5:** GK, LB, RB, CM, ST (compact 2-1-1 formation — common for youngest age groups)
- **Soccer 7v7:** GK, LB, RB, LW, CM, RW, ST (2-3-1 formation — the most widely used 7v7 shape)
- **Soccer 9v9:** GK, LB, CB, RB, LM, CM, RM, LF, RF (3-3-2 formation — LF/RF rather than LW/RW because the forwards play centrally, not wide)
- **Soccer 11v11:** GK, LB, LCB, RCB, RB, LM, CM, RM, LW, RW, ST (flat 4-3-3/4-4-2 hybrid — avoids formation-specific labels like CDM/CAM)
- **Football 7v7 (Flag):** QB, C, WR1, WR2, WR3, RB, TE (standard flag football offense)
- **Football 11v11:** QB, C, LG, RG, LT, RT, WR1, WR2, TE, RB, FB (standard offensive line + skill positions)
- **Baseball/Softball:** P, C, 1B, 2B, SS, 3B, LF, CF, RF (standard defensive positions)
- **Basketball 5v5, 3v3, Hockey, Lacrosse:** standard universal positions
### SPORTS as Single Source of Truth

The `SPORTS` object in `formations.js` defines all sports, their display names, icons, and available formats. Each format specifies a key, display name, and position list. The legacy `POSITION_PRESETS` and `SPORT_ICONS` objects are derived automatically from `SPORTS` — no hand-maintained duplicate data.

Preset keys are composed as `{sport}-{format}` for multi-format sports (e.g., `soccer-7v7`) or just `{sport}` for single-format ones (e.g., `basketball`). These keys are stored on the season object and used to look up formations, field backgrounds, and icons. `makePresetKey()` and `parsePresetKey()` handle composition and decomposition.

The season creation modal exposes this as two dropdowns: Sport (drives the format list) and Format (drives the positions). The format dropdown is always visible (hidden only for Custom, where positions are freeform). Single-format sports show their one option, which communicates "this is the format in use" rather than hiding the concept. The standalone field selector uses the same two-dropdown pattern (sport + format) for consistency.

## Game Identity: gameId

Each game has a `gameId` field that serves as its primary key in storage. For single-game days, `gameId` equals the date string (`2026-03-21`). For tournament days with multiple games, subsequent games get suffixed IDs (`2026-03-21_2`, `2026-03-21_3`).

When generating and games already exist for the selected date, a custom modal offers three choices: Add (new game), Replace (last game), or Cancel. Re-generating while viewing an existing game silently replaces it.

`ensureGameIds()` stamps missing IDs at import time as input normalization — it is not a runtime backwards-compatibility mechanism.

## Game Notes

Each game object has an optional `notes` string field. The textarea renders at the top of the Lineup tab (above period cards) for immediate visibility. A bullet-insert button (`•`) adds list-style entries at the cursor position. Notes auto-save on every keystroke and are preserved when re-generating over an existing game. Notes are included in share text output and survive export/import as part of the game object.

## Season Analytics

The Season tab includes three visual analytics sections:

- **Playing Time chart:** horizontal SVG bars per player showing `periodsPlayed / periodsAvailable`. A team average row appears first with a dashed reference line. Player bars are colored by deviation from the average: green (within 5%), yellow (5–10%), red (>10%).
- **Position Distribution chart:** per-player stacked bars showing fraction of time at each position. Colors are deterministic from the position list.
- **Per-game fairness spread:** a badge next to each game in the history list showing `max_periods - min_periods` played. Colored green (≤1), yellow (2), red (≥3).

All data is derived from existing `getSeasonStats()` and `loadAllGames()` — no new storage.



### Why Split Into Multiple Files

The app was originally two files: `index.html` (HTML + CSS + ~1800 lines of inline JS) and `engine.js` (~600 lines of algorithm + storage + formations). This was fine for initial development but became unwieldy for maintenance. The split was chosen over keeping everything inline because:

- **Separation of concerns is clear:** formations data, storage logic, algorithm, field rendering, and UI are five distinct domains with minimal coupling
- **No build step needed:** Files load via `<script>` tags in dependency order. The service worker caches them identically to the single-file version
- **Debugging is easier:** Browser devtools show meaningful filenames in stack traces instead of "index.html:1847"
- **The project crossed the threshold:** At ~2400 lines of JS, a single inline block becomes hard to navigate. Five files of 200-500 lines each are much more manageable

CSS was also extracted from inline `<style>` in `index.html` into `css/styles.css` for the same reasons: cleaner HTML (~250 lines vs ~1000), independent browser caching, and easier maintenance. The service worker caches it alongside JS files.

### Folder Structure

```
index.html, manifest.json, sw.js, privacy.html   ← root (GitHub Pages requirement)
js/                                                ← all application JavaScript
css/                                               ← extracted stylesheet
icons/                                             ← PWA icons (192, 512)
tests/                                             ← Node.js test suites
docs/                                              ← design docs and roadmap
python/                                            ← reference implementation
data/                                              ← example fixtures
.well-known/                                       ← Digital Asset Links (TWA)
```

### Load Order

```html
<link rel="stylesheet" href="css/styles.css">
<script src="js/formations.js"></script>  <!-- Data: presets, layouts, icons, preset matching -->
<script src="js/storage.js"></script>     <!-- Data layer: localStorage CRUD -->
<script src="js/engine.js"></script>      <!-- Algorithm: RotationEngine class -->
<script src="js/field.js"></script>       <!-- Field tab: SVG rendering, drag -->
<script src="js/app.js"></script>         <!-- UI: tabs, modals, rendering, boot -->
```

Each file declares globals that subsequent files depend on. This is intentional — ES modules would require a build step or complex service worker configuration for offline support.

### File Responsibilities

| File | Lines | Purpose |
|---|---|---|
| `js/formations.js` | ~370 | `SPORTS` (single source of truth), derived `POSITION_PRESETS`, `FORMATIONS`, `SPORT_ICONS`, `DEFAULT_POSITIONS`, `makePresetKey()`, `parsePresetKey()`, `matchPresetFromPositions()`, `getSeasonPreset()`, `generateAutoLayout()` |
| `js/storage.js` | ~340 | `Storage` object (roster, games, plays CRUD, v3 export/import, backup/restore, clearAll), `slugify()` |
| `js/engine.js` | ~390 | `RotationEngine` class, `getPlayerSummary()` |
| `js/field.js` | ~1300 | Field tab rendering, SVG field backgrounds, drag handling, plays management, route drawing, defense overlay, standalone mode |
| `js/app.js` | ~2250 | Everything else: state, init, tabs, modals, roster, game day (drag reorder, constraints), lineup (swaps, labels), season analytics, backup/restore/share UI, settings, theme, hints, accessibility, utilities |
| `css/styles.css` | ~1000 | All styles: CSS custom properties, dark/light themes, components, tab-specific styles, animations |

## Algorithm: Brute-Force Over Hungarian

Position assignment uses brute-force permutation search (N! iterations) instead of the Hungarian algorithm. This was a deliberate choice:
- For 7 positions: 5040 iterations, trivially fast (<1ms)
- For 9 positions: 362,880 iterations, still fast (~10ms)
- For 11 positions (football): 39,916,800 iterations — still under 1 second on modern mobile hardware
- Avoids pulling in scipy/numpy (Python) or any matrix library (JS)
- Code is simple and auditable
- Guaranteed optimal (exhaustive search)

Would need to revisit if positions ever exceeded ~12 (12! = 479M).

## Position Weights Are Multiplicative, Not Additive

A player's ideal position fraction is `weight / sum(all_eligible_weights)`. This means:
- Default (all 1.0): each position = 1/N
- If GK=3.0 and all others=1.0: GK gets ~3x its fair share
- If GK=0.0: excluded entirely, remaining positions split the fraction

## Absence Neutrality

All season stats are computed per-game-attended, not absolute. Key metric is `playing_time_ratio = total_periods_played / total_periods_available`. A player who attended 5 games and played 15 periods is treated identically to one who attended 10 games and played 30 periods. Missing a game neither penalizes nor benefits a player — fairness is measured only across games each player was present for.

## Multi-Team / Multi-Season Architecture

### Data Model

Teams and seasons are independent hierarchies:
- A **team** is just a name and a slug (folder name)
- A **season** belongs to a team and defines its own positions, roster, and game history
- Each team/season combo has completely independent data

### localStorage Keys

```
rot_context                             → { teamSlug, seasonSlug }
rot_teams                              → [{ slug, name }]
rot_{teamSlug}_seasons                 → [{ slug, name, positions }]
rot_{teamSlug}_{seasonSlug}_roster     → { players, positions }
rot_{teamSlug}_{seasonSlug}_games      → [games]
rot_{teamSlug}_{seasonSlug}_plays      → [plays]
```

The `rot_` prefix distinguishes from any legacy data.

### Repo Data Folder

The `data/` folder in the repo contains example/test fixture data:

```
data/
  teams.json                            ← ["u10-kingcobras"]
  u10-kingcobras/
    team.json                           ← { name, seasons: [{slug, name}] }
    2026-spring/
      roster.json                       ← example roster (placeholder names)
      games.json                        ← example game history (with gameId fields)
```

This structure is used by the test suite and serves as format documentation. It is not used by the app at runtime — all user data lives in localStorage and is transferred via JSON file export/import.

### Context Switching

The header label shows "Team · Season" and tapping it opens a context picker modal. Creating a new season offers the option to copy the roster from the previous season.

## Data Privacy

All data lives on-device in localStorage. Exported files contain real player names — treat them as private. Game history within those files uses player IDs (`p01`, `p02`), not names, but the roster section includes names.

### Import Auto-Detection

When importing from file, the app inspects the JSON structure to determine the format:
- Object with `version: 2` and `teams` array → full backup (adds/updates all teams and seasons)
- Object with `version: 2`, `team`, and `season` → single-season bundle
- Object with `players` key → standalone roster (replaces current season's roster)
- Array where items have `id` and `name` but no `date` → standalone plays (merges by play ID)
- Array of other objects → standalone games (replaces current season's games)

### Export

- **Export → Current Team:** downloads a single JSON file containing the team with all its seasons (rosters, games, plays). Uses the v2 backup format (`{ version: 2, teams: [...] }`)
- **Export → All Teams:** downloads a full backup of all teams and seasons

Games without `gameId` are automatically stamped via `ensureGameIds()` on import.

## Lineup Swaps (Post-Generation Editing)

The lineup view is a live, editable document. After generating, the coach can tap any player (field or bench) to select them, then tap another player in the same period to swap:
- **Field ↔ Field:** two on-field players trade positions
- **Bench → Field:** bench player subs in, field player moves to bench
- **Field → Bench:** reverse of above

Every swap saves immediately. Season stats are computed from saved game data, so they always reflect what actually happened on the field.

## Share Lineup

The lineup share button opens a dropdown menu:
- **Copy to Clipboard** — with `document.execCommand('copy')` fallback for non-HTTPS contexts
- **Share...** — native share sheet (only shown on mobile where `navigator.share` exists)
- **Download as Text** — saves a `.txt` file

## localStorage as Source of Truth

localStorage holds all app data — rosters, games, plays, team/season structure. Data transfer between devices uses JSON file export/import (via the header ⋮ menu). The repo's `data/` folder exists only for test fixtures and as format documentation.

Workflow:
1. Create team and season in the app
2. Add players, generate lineups, add game notes
3. Export Current Team → transfer file to backup or share with co-coach
4. On new device: Import → load the file

## Service Worker Cache Strategy

- App shell files (`index.html`, `css/styles.css`, `js/*.js`, `manifest.json`, `icons/*.png`): cache-first (fast offline loads)
- Cache version is bumped manually in `sw.js` when app files change
- `skipWaiting()` + `clients.claim()` ensures updates take effect immediately

## CSS Architecture

Styles live in `css/styles.css` (extracted from inline `<style>` block in index.html for cleaner HTML and independent caching). Uses CSS custom properties for theming. Key variables:
```
--bg: #0f1923    (darkest)
--bg2: #172a3a   (card background)
--bg3: #1e3a4f   (interactive elements)
--fg: #e8eff5    (primary text)
--fg2: #8fa3b3   (secondary text)
--accent: #00e676 (primary action color - green)
--gk: #fdd835    (goalkeeper highlight - yellow)
```

Fonts: DM Sans (body), JetBrains Mono (data/numbers). Loaded from Google Fonts CDN.

## Player ID Scheme

Auto-generated as `p01`, `p02`, etc. (zero-padded two digits). IDs are stable across sessions — renaming a player doesn't change their ID, which preserves game history references. Deleting a player with existing game history could leave orphaned IDs in past games (currently just shows the raw ID).

IDs are scoped per-season. When copying a roster to a new season, IDs carry over so the same player keeps the same ID across seasons on the same team. Cross-team players have separate IDs (teams are independent).

## Formations — Visual-Only Architecture

Formations are purely a presentation layer — they define where player dots appear on the Field tab's SVG diagram. The rotation engine is completely untouched.

### Why Visual-Only?

The engine just needs a flat list of N position labels. Formations add spatial coordinates to those labels for the field diagram, but they never alter what the engine produces. This means:
- Zero risk of breaking the rotation algorithm
- No data model changes to games or rosters
- Formation switching is instant (just move dots)
- Season stats remain valid regardless of formation changes

### Formation Storage

Formations are defined in `formations.js` alongside `POSITION_PRESETS`, keyed by the same preset name. Each preset maps to a `fieldType` (soccer/basketball/hockey/lacrosse/football/baseball/generic) and an array of named `layouts`, where each layout maps position labels to `[x, y]` percentage coordinates.

### Sport-Specific Field Backgrounds

Each sport gets a stylized SVG background rendered by dedicated functions in `field.js`:
- **Soccer:** Green pitch with markings, penalty areas, center circle, corner arcs, goals
- **Basketball:** Wood-toned court with key, three-point arcs, backboards
- **Hockey:** Ice-blue rink with rounded corners, face-off circles, blue/red lines, creases
- **Lacrosse:** Green field with restraining lines, wing areas, creases, goals
- **Football:** Green field with yard lines, end zones, hash marks, yard numbers, goal posts
- **Baseball:** Green field with diamond, baselines, outfield arc, pitcher's mound, batter's boxes
- **Generic:** Simple rectangle with center line and circle (fallback)

## Header Menu

The header ⋮ menu provides four data operations and About, accessible from any tab:

- **Back Up** — downloads a complete v3 snapshot of all data
- **Restore** — loads a v3 backup file with preview, warning, and safety-net auto-backup
- **Share Team** — downloads the current team as a v3 single-team file for sharing
- **Import Team** — loads a shared team file, adds or replaces one team

This follows the standard Android overflow menu pattern. The About modal shows version and algorithm info.

## v3 Data Format

### Why a New Format

The v2 format had several issues that would block cloud backup:
- Standalone plays (`__standalone__/__standalone__`) were not exported
- Active context (`rot_context`) was not saved — restoring on a new device didn't remember what you were working on
- Season `preset` was dropped on some export paths, breaking field backgrounds after import
- The full backup import was a merge, not a replacement — ambiguous when restoring from cloud
- Five import paths (v2 full, v2 season, standalone roster, standalone games, standalone plays) made format detection fragile
- `ensureGameIds()` existed as runtime import normalization for pre-gameId data

### v3 Design: One Format, Two Purposes

A single JSON format serves both backup and sharing:

```json
{
  "version": 3,
  "app": "roster-rotation",
  "exportedAt": "2026-03-26T14:30:00.000Z",
  "context": { "teamSlug": "cobras", "seasonSlug": "spring-2026" },
  "teams": [...],
  "standalonePlays": [...]
}
```

- **Backup** (`exportAll`) includes everything: all teams, `context`, `standalonePlays`
- **Share** (`exportTeam`) includes one team only: no `context`, no `standalonePlays`

The receiver distinguishes them by `teams.length` — multi-team = backup, single-team = share.

### Import Semantics

**Restore (backup):** full replacement. `Storage.clearAll()` removes all `rot_*` keys, then `importBackup()` writes everything from the backup. Before replacing, the UI auto-downloads the user's current data as a safety-net backup file.

**Import Team (share):** add-or-replace for one team. If the team slug exists locally, `deleteTeam()` cascade-removes it first. Then `_importTeamData()` writes the incoming team. Other teams are untouched.

Both operations are in `storage.js` and fully testable without DOM.

### What Changed from v2

| Aspect | v2 | v3 |
|---|---|---|
| Version field | `2` | `3` |
| `app` field | absent | `"roster-rotation"` |
| `context` | not exported | included in backup |
| `standalonePlays` | not exported | included in backup |
| `preset` on seasons | sometimes dropped | always included |
| Empty arrays | `undefined` | `[]` |
| Backup import | merge (additive) | full replace with safety net |
| Import paths | 5 (fragile detection) | 2 (backup vs share) |
| `ensureGameIds()` | runtime normalization | removed (no legacy data) |
| `exportTeamSeason()` | dead code | removed |

## Field Plays System

### Architecture

Plays extend the Field tab's existing draggable-dot system. A play captures:
- **Dot positions:** overridden `[x, y]` coordinates (same format as the in-memory `fieldDotPositions`)
- **Routes:** arrays of downsampled touch points, rendered as smoothed bezier paths with arrowheads
- **Defense markers:** array of `{x, y}` positions for opponent X markers
- **Formation index:** which formation layout the play was built on

Plays are per-team, per-season (tied to a position set). Stored at `rot_{teamSlug}_{seasonSlug}_plays`. Standalone plays (no team context) use the key `rot___standalone_____standalone___plays`. All plays are included in v3 backup exports.

### Route Drawing — Technical Decisions

**Point capture and downsampling:** Raw pointer events produce hundreds of points per second. `downsamplePoints()` filters to a minimum 6px distance between samples, reducing a typical swipe from ~200 points to ~20-40 while preserving shape.

**Smoothing:** `smoothPath()` builds quadratic bezier curves through midpoints of consecutive samples. The result is smooth without expensive spline fitting or control point computation.

**Arrowheads:** SVG `<marker>` elements with `orient="auto"` were tried first but produced incorrectly oriented arrows on curved paths. Replaced with manually computed polygon triangles using `atan2` from the second-to-last point to the last point. The arrowhead is centered on the endpoint (shifted forward by half its size). The visible stroke path is trimmed back 8px via `trimPathEnd()` so the round linecap tucks under the arrowhead cleanly.

**Z-ordering:** Route lines render between the field background and player dots (so lines go under dots). Arrowheads are collected separately and appended after all dots and defense markers (so arrows sit on top of everything).

**Selection:** In draw mode, each route has an invisible 18px-wide hit area path layered under the visible 2.5px stroke. Tapping selects the route (highlights green), and the toolbar switches to show delete/cancel. This avoids needing long-press detection, which is unreliable on touch devices during drag gestures.

### Defense Overlay

Defense markers are X shapes (two crossed SVG lines) in red (`rgba(255,82,82,0.7)`), visually distinct from the green/yellow/gray player dots. They use the same pointer event drag system as player dots but through a separate handler (`onDefPointerDown`) to avoid conflicts.

On first toggle, `seedDefenseMarkers()` generates markers matching the position count, spread in a staggered pattern across the top third of the field. Add/remove buttons adjust the count.

Defense dragging is disabled during draw mode to avoid gesture conflicts.

### Interaction Mode Priority

The Field tab has three toggleable modes (Aa names, draw, defense) that interact:
- **Draw mode ON:** dot dragging disabled, defense dragging disabled, route selection enabled, container cursor becomes crosshair
- **Draw mode OFF + defense ON:** dots draggable, defense Xs draggable, no route interaction
- **Both OFF:** dots draggable, template/game mode only

### Play Actions Menu

Uses a popup dropdown (same pattern as the data import/export menus) rather than separate buttons. Actions: Save as New (with case-insensitive duplicate detection), Overwrite current play, Delete current play. The reset button (↺) reloads the saved play's positions/routes/defense without overwriting.

## Game Day — Drag-to-Reorder

The available player list on the Game Day tab uses a drag handle for reordering instead of up/down arrow buttons. Each row has a six-dot grip icon (⠿) on the right side. The drag interaction uses pointer events:

1. `pointerdown` on the grip creates a ghost element (cloned row with accent border and shadow) positioned at the cursor
2. `pointermove` moves the ghost and highlights the drop target (green top-border on the target row)
3. `pointerup` splices the item from its old position to the new position, flashes the moved row (swapPulse animation), and shows a toast ("Moved [name]")

**Why drag handle instead of tap-to-swap:** The Game Day list has multiple interactive zones per row — checkbox (toggle availability), player name (open lock picker for position pins), lock badge (remove pin). A tap-to-swap interaction conflicts with these zones because tapping a row needs to mean different things depending on what was tapped. A dedicated drag handle avoids ambiguity entirely.

**Why not up/down arrows:** Arrows require many taps to move a player more than one or two positions. With 10+ players, moving someone from the bottom to the top takes 9 taps. Drag-to-reorder accomplishes it in one gesture.

## Position Pin Hint

The pin hint ("Tap a name to pin to a position") is always visible as a subtle line under the Available Players card header. When pins exist, it shows a summary (e.g., "Pinned: Alex = GK, Jordan = ST"). This was moved from inside the collapsible Constraints panel (where it was hidden by default) to the always-visible area because:

- Discoverability: coaches who don't expand Constraints never learned the feature existed
- The pin interaction (tap name → pick position) happens on the player list, not in the constraint panel, so the hint belongs near the list

The constraint panel still shows the constraint badge count (includes pins) and the continuity/specialPosMax controls.

## SVG Icons

All interactive icons use inline SVGs instead of text characters. This provides consistent rendering across devices, perfect scaling, and `currentColor` inheritance for theming. Replaced:

- Close button `x` → 18×18 SVG ✕ (two crossed lines)
- Edit button `>` → 16×16 SVG chevron-right
- Constraint caret `v` → 12×12 SVG chevron-down (rotates 180° on expand via CSS transform)
- Lock badge dismiss `✖` → 10×10 SVG ✕
- Drag handle → 16×16 SVG six-dot grip pattern

The app already used inline SVGs for nav tab icons, so this is consistent with the existing pattern.

## Accessibility

### Modal Focus Management

All modals have `role="dialog"` and `aria-modal="true"`. Two global `keydown` listeners on `document` handle:

- **Escape key:** Closes the topmost open modal or menu, checked in reverse stacking order (tournament modal → share/header menus → static modals). This matches standard platform behavior.
- **Tab focus trap:** When a modal is open, Tab/Shift+Tab cycling is constrained to focusable elements within the modal. If focus escapes (e.g., the modal just opened), it wraps to the first or last focusable element.

### Remaining Gaps

- Interactive `<li>` elements (player items, available list) respond to click but not keyboard Enter/Space. Would need `tabindex="0"` and `keydown` handlers for full keyboard accessibility.
- Color contrast: `--fg2` (#8fa3b3) on `--bg` (#0f1923) is ~4.2:1, passing WCAG AA for normal text but below AAA for the 10-11px sizes used in some labels.
- These are tracked in the roadmap as future improvements.

## Test Architecture

Tests run in Node.js using the `vm` module to create sandboxed contexts that load the app's JS files in dependency order. Key design choices:

- **localStorage mock:** A simple in-memory object with `getItem/setItem/removeItem/clear`. Each test suite gets a fresh context to avoid state leaks between suites.
- **DOM stubs:** Minimal stubs for `document.getElementById`, `document.createElement`, etc. These return inert objects with no-op methods — enough for app.js to load and run its `init()` without crashing, but no actual rendering.
- **No browser required:** Engine, storage, formations, and pure-logic app functions (period labels, import detection, fairness calculations) are fully testable without a DOM.
- **VM sandboxing:** Each context is an isolated `vm.createContext` with its own globals. Files are loaded via `vm.runInContext` in dependency order (formations → storage → engine → optionally app.js with field.js stubs).
- **Assertion helpers:** `assert`, `assertEqual`, `assertThrows`, `assertApprox` with suite grouping and a final report showing pass/fail counts.

**What's covered (755 assertions):** Algorithm correctness, data layer CRUD, v3 export/import format, backup/restore roundtrips, shared team import, settings preservation, sport/format/formation integrity, constraint validation, season stats, app utility functions.

**What's not covered (needs Playwright):** Drag-to-reorder gesture, modal open/close/focus trap, lineup swap rendering, field SVG rendering, toast notifications, service worker behavior. These are tracked in the roadmap.

## Standalone Field Mode

### Problem

The Field tab previously required a team and season to be selected before showing anything. This blocked casual use — coaches who just wanted to diagram a quick play before setting up their full roster had to create a team and season first. It also meant the app's most visually interesting feature was hidden behind a setup wall.

### Design

The field now works in three tiers, each adding context:

| Scenario | What's shown |
|---|---|
| No team/season (standalone) | Sport/format selector, full field with formation selector (or +/- for custom), plays, routes, defense |
| Team selected, no game plan | Formation selector, position labels on dots |
| Team selected, game plan active | Period pills, player names on dots, bench row |

The standalone tier is implemented by relaxing the guards in `renderField()` and `buildFieldSVG()` to derive positions from `POSITION_PRESETS[fieldStandalonePreset]` instead of requiring `roster.positions`. A `getStandalonePositions()` helper centralizes this, returning the preset positions for known sports or generating `P1..Pn` labels for custom.

### Plays in Standalone Mode

Plays saved without a team context use the storage key `__standalone__/__standalone__`. This avoids polluting real team data and avoids the complexity of migrating plays when a team is later created. The `getPlaysCtx()` helper returns the standalone key when `ctx` is null, so all plays functions (`savePlayAsNew`, `overwriteActivePlay`, `deleteActivePlay`) work identically in both modes.

### Custom Sport Mode

When the "Custom" sport is selected in standalone mode, the formation selector row is replaced with:
- A **position count label** ("7 positions") and **+/−** buttons (range: 1–15). Dots get generic labels P1, P2, P3...
- A **field background selector** replacing the format dropdown — any sport's field background can be used with custom positions (soccer field for a 6v6 game, hockey rink for a modified format, etc.)

This keeps custom fully freeform while reusing existing field artwork.

### Field Only Context Picker

A "🏟️ Field Only" chip appears first in the Team section of the context picker. Selecting it sets `ctx = null` and calls `showWelcome()`, which now:
- Hides roster controls ("+ Add" button hidden, empty state says "Select a team to manage your roster")
- Hides game day cards (replaced with "Select a team to set up games")
- Shows appropriate messages on lineup and season tabs
- Renders the standalone field

Field Only is session-level — on next app reload, if teams exist, the init code auto-selects the first team. This keeps the common case (coaches with an active team) frictionless.

### State Variables

Three new globals in `app.js` support standalone mode:
- `fieldStandalonePreset` (`'soccer-7v7'` default) — the active sport/format when no team context
- `fieldCustomCount` (`7` default) — dot count for custom sport
- `fieldCustomFieldType` (`'generic'` default) — field background for custom sport

All reset to defaults on app reload (not persisted). This is intentional — the standalone field is a scratchpad, not a persistent workspace.

## Field Rendering Corrections

### Soccer Penalty Arcs

The half-circle arcs at the edge of the penalty areas had their SVG sweep flags inverted. The arcs curved *into* the penalty area (toward the goal) instead of *away* from it (toward center field). In real soccer, the penalty arc marks the area outside the penalty box that is within 10 yards of the penalty spot — it curves toward the center of the field.

Fix: swapped the `sweep-flag` parameter in both SVG arc paths. Top penalty area: `0 0 1` → `0 0 0`. Bottom: `0 0 0` → `0 0 1`.

### Lacrosse Goal Positioning

The goals and creases were placed at `th + 18` pixels from the field edge, which on the 480px-tall SVG canvas put them at roughly 4% from the end line. On a real lacrosse field, goals sit 15 yards from the end line on a 110-yard field — approximately 14% of the total field length.

Fix: changed goal Y-coordinates from `th + 18` to `th + fh * 0.14` and `bh - fh * 0.14`, with creases and goal squares referencing the computed positions. The visual effect moves goals noticeably toward center field, matching real field proportions.

## Settings System

### Architecture

Settings are stored in `rot_settings` (a single JSON key in localStorage) with three groups: Appearance (theme), Game Day Defaults (period format, starter mode), and Help (hint visibility). The Settings modal is opened from the ⋮ header menu.

`loadSettings()` returns defaults if no settings key exists, so the app works identically on first launch as before settings were added. `saveSettings()` writes immediately. Settings are **not** included in backup exports — they are device-level preferences (theme, defaults) that should persist across backup restore. `clearAll()` explicitly skips `rot_settings`.

### Why Not Per-Setting Keys

An alternative was individual localStorage keys (`rot_setting_theme`, `rot_setting_periods`, etc.). A single JSON key was chosen because: settings are always read together at init, the total data is tiny, and it avoids polluting the `rot_*` key namespace with many small keys that `clearAll()` then has to individually exclude.

## Light Theme

### Implementation

The dark theme's hardcoded `rgba(255,255,255,...)` colors were extracted into CSS custom properties: `--border`, `--border-subtle`, `--border-faint`, `--hover`, `--hover-strong`, `--shadow`, `--shadow-strong`, `--overlay`. A `--check-fg` variable handles text-on-accent elements (checkmarks, primary buttons, constraint badges, field dot labels) — dark in dark mode, white in light mode.

The `.theme-light` class overrides all variables with light equivalents: white backgrounds, dark text, `rgba(0,0,0,...)` semi-transparent colors, and a slightly darker accent green (`#00b34a`) for adequate contrast on white backgrounds. The class is applied to `<html>` by `applyTheme()`.

"System" mode uses `window.matchMedia('(prefers-color-scheme: light)')` with a change listener for real-time response to OS theme changes.

### What Didn't Need Changing

Field SVG backgrounds (soccer green, basketball brown, hockey blue) are self-contained dark rectangles that look correct on any page background. Route drawing colors, defense marker colors, and dot fills are all independent of the page theme.

## Game Labels

An optional `label` field (max 40 chars) on the game object. Entered via an inline text input below the date on the Lineup tab. Auto-saves on input. Displayed in the Lineup header, game history list, share text, and delete confirmation. Preserved through re-generation alongside notes.

The label does not affect `gameId` or any storage logic. It is purely a display-layer annotation. Absent `label` on older games is treated as no label — no migration needed.

## First-Use Contextual Hints

### Design

Each tab shows a small green-tinted banner at the top the first time the user visits it (only when a team is active — not in field-only mode). Each hint has a dismiss × button. Once dismissed, a `rot_hint_{tab}` flag is set in localStorage and the hint never appears again.

Hint text uses bolded key terms to draw the eye to the actionable words ("Tap **+ Add** to add players"). The `showTabHint(tabName)` function is called from `switchTab()` and after `loadContextData()` for the default tab.

Settings provides "Show Again" (clears all hint flags) and "Dismiss All" (sets all flags). Hints reset on backup restore because `clearAll()` removes `rot_hint_*` keys along with other data.

### Context Label Pulse

On first launch with no teams, the context label in the header gets a subtle green glow pulse animation (2s CSS cycle). The pulse stops when the user taps the label or when a team context is loaded. This draws attention to the single most important first-time action without blocking anything.

## Multi-Game Day Bug Fix

The `generatePlan()` function had a branch that silently overwrote the current game when `currentPlan.date === date`, bypassing the tournament modal entirely. This caused data loss on tournament days when the coach re-generated for the same date. Fixed by removing the silent-replace branch — all existing-game scenarios now route through the tournament modal (Add / Replace / Cancel).

## Donate Button

A centered PayPal.me link in the app header, styled as a small accent-colored pill. Uses `position: absolute; left: 50%; transform: translateX(-50%)` on the relatively-positioned header flex container. Opens in a new browser tab, no modal or confirmation. Should be removed or moved to Settings before app store submission.

## Future Strategy: Positional Play

The current engine optimizes for fairness through rotation. A separate strategy for competitive/older teams (position specialization with rest-based substitution) has been investigated and documented in `docs/STRATEGY_INVESTIGATION.md`. The architecture supports adding a `strategy` field to the season model without breaking existing data. No implementation is planned until there's a concrete user need.

## Field Panning & Dot Dragging (HTML Overlay Approach)

### Problem

The field SVG covers most of the mobile viewport. With `touch-action: none` on the `.field-container`, users couldn't scroll the page by swiping on the field — they had to find the narrow 10px side margins. But setting `touch-action: pan-y` on the container broke dot dragging: Chrome Android would sometimes interpret a touch on a dot as a scroll gesture before JS could call `setPointerCapture()`.

### What Didn't Work

1. **`touch-action: pan-y` on `.field-container` + `touch-action: none` on SVG `.dot-group`** — Chrome Android ignores `touch-action` on SVG `<g>` elements nested inside a `pan-y` parent. The browser commits to scrolling before the JS `pointerdown` handler fires.
2. **Enlarged hit radii** (26→36px) on dot circles — helped slightly but didn't eliminate the competing gesture problem.
3. **`pointer-events: none` on SVG + `pointer-events: auto` on `.dot-group`** — the `pointer-events` CSS worked correctly, but the underlying `touch-action` on SVG `<g>` elements was still ignored by Chrome Android.

### Solution: HTML Touch Overlays

Transparent HTML `<div>` elements (class `.dot-overlay` / `.def-overlay`) are positioned absolutely on top of each SVG dot and defense marker. CSS `touch-action: none` on HTML `<div>` elements *is* respected by Chrome Android. The approach:

- **SVG** has `pointer-events: none` — all touches pass through to the container
- **Container** has `touch-action: pan-y pinch-zoom` — allows scrolling and zoom on the field background
- **HTML overlays** (56×56px, `touch-action: none`, `pointer-events: auto`) sit on top of each dot — touches on a dot hit the overlay, which blocks scrolling, and the drag handler fires reliably
- **Draw/zone mode** hides overlays (`display: none`) and sets `touch-action: none` on the container, so freehand drawing isn't interrupted by scrolling

The overlays are generated in `renderField()` alongside the SVG. Drag handlers (`setupFieldDrag`, `setupDefenseDrag`) attach to the HTML overlays and update both the SVG visuals and overlay positions during drag. The SVG dot-groups remain for visual rendering only — they no longer receive touch events.

### Why Not a Full HTML Canvas

A canvas or pure-HTML approach would avoid SVG touch issues entirely, but the existing codebase has substantial investment in SVG rendering (field backgrounds, dot groups, route/zone paths, arrowheads). The overlay approach adds ~30 lines of HTML generation and ~20 lines of CSS while keeping all SVG rendering unchanged.

## Mobile Keyboard Covering Modal Buttons

### Problem

Bottom-sheet modals (`align-items: flex-end` on the overlay) place Save/Delete buttons at the bottom. On Android Chrome, the on-screen keyboard covers the bottom of the screen, but `position: fixed` elements stay relative to the *layout* viewport (unchanged), not the *visual* viewport (shrunk by the keyboard). The buttons end up behind the keyboard.

### Solution: `visualViewport` API

A global listener on `window.visualViewport` detects when the visible area shrinks by more than 100px (keyboard opening). When detected, the modal overlay's `top` and `height` are set to match `visualViewport.offsetTop` and `visualViewport.height`, making the overlay occupy only the visible area above the keyboard. The modal's existing `overflow-y: auto` and `flex-end` alignment handle the rest — the modal fits within the smaller space and its content is scrollable.

When the keyboard closes (viewport grows back), the inline styles are cleared so the CSS defaults take over.

The `scrollIntoView({ block: 'nearest' })` call after repositioning ensures the focused input stays visible. Both `resize` and `scroll` events are monitored because Android Chrome fires `scroll` events on `visualViewport` when the page adjusts to the keyboard.

### Why Not Approach B (scrollIntoView Only)

A `scrollIntoView` on input focus would scroll the input into view but not guarantee the buttons below it are visible. The overlay repositioning approach keeps the entire modal within the visible area, making both the input and buttons reachable.