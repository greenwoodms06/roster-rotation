# Roster Rotation Manager

Fair lineup rotation engine for youth sports. Supports any NvN format -- soccer 5v5/7v7/9v9/11v11, basketball 5v5/3v3, football, hockey, lacrosse, baseball, or fully custom. Runs as a PWA -- install it on your phone and use it on the field, fully offline.

**Live app:** `https://greenwoodms06.github.io/roster-rotation/`

## How It Works

The engine generates optimized lineups that balance:
1. **Equal playing time per game** -- every available player plays as close to the same number of periods as possible
2. **Equal playing time per season** -- normalized by games attended. Missing a game neither penalizes nor benefits a player.
3. **Equal position exposure** -- each player trends toward playing all positions equally over time
4. **Position weighting** -- per-player preferences to play certain positions more or avoid them entirely

### Game Day Constraints

On top of the core fairness algorithm, the coach can apply optional constraints before generating:

- **Position pins** -- lock a player to a specific position for this game. Tap a player's name in the available list, pick a position. That player plays that position every period they're on the field. A hint and pin summary is always visible under the Available Players header. Use case: "Alex is our GK today."
- **Position stickiness** -- reduce position changes between periods (Off / Medium / High). Use case: "Stop moving kids every 8 minutes, let them settle in."
- **Special position max** -- cap how many periods any player can play the first position (GK, G, etc.). Use case: "No kid plays goalkeeper more than once." Only appears for sports with a designated special position (soccer, hockey, lacrosse).

All constraints default to off. When off, behavior is identical to the original algorithm. Post-generation tap-to-swap is always available for manual adjustments.

### Field Tab & Play Diagramming

The **Field** tab shows a top-down SVG diagram of the field with draggable player dots. It works in three contexts:

- **Standalone mode** (no team selected) -- the full interactive field is available immediately. A sport/format selector lets you pick any sport and format. Custom sport offers +/- buttons to add or remove positions (P1, P2, ...) and a field background selector (soccer, basketball, hockey, etc.). Plays saved in standalone mode persist separately from team data.
- **Template mode** (team selected, no game plan) -- shows position labels on dots with the team's formation selector.
- **Game mode** (team selected, game plan active) -- shows player names per period with period pills and bench.

Play diagramming features (available in all modes):

- **Saved plays** -- drag dots into position, then save as a named play via the + menu. Load any saved play from the dropdown to restore positions instantly. Plays are per-team, per-season (or per-standalone bucket).
- **Route drawing** -- toggle draw mode (pencil icon), then drag your finger across the field to draw movement paths. Routes render as smooth curves with arrowheads. Tap a route to select it, then delete it individually. Undo and clear-all are available.
- **Defense overlay** -- toggle DEF to show draggable opponent X markers (red). Add or remove markers as needed. Defense positions save with plays.
- **Formations** -- switch between sport-specific formations (e.g., 2-3-1, 3-2-1 for soccer 7v7). Each sport has a detailed SVG field background.

## Setup

### Quick Start (Field Only)

The Field tab works immediately with no setup. Open the app and switch to the Field tab to diagram plays for any sport. No team or roster required.

### Team Setup
1. Open the app and create a team (give it a name)
2. Create a season (name + choose a position preset or define custom positions)
3. Add your players on the Roster tab, with any position weight preferences

### Game Day
1. Open the app - Game Day tab
2. Set the format (4 quarters, 3 periods, or 2 halves)
3. Check who's available, drag the grip handle to reorder for starters
4. Optionally expand Constraints to set pins, stickiness, or GK max
5. Tap **Generate Lineup**
6. Use the **Lineup** tab on the sideline -- tap any two players in the same period to swap them
7. Optionally add a game label (e.g. "vs. Lincoln FC") on the Lineup tab

### After the Game
1. Add game notes on the Lineup tab (visible at the top)
2. Check the **Season** tab for fairness charts and position distribution
3. To back up or share: tap **⋮** in the header → **Export → Current Team**

## Multi-Team & Multi-Season

The app supports managing multiple teams and seasons. Tap the context label in the header (e.g. "U10 King Cobras - Spring 2026") to:

- Switch to **Field Only** mode (full field diagramming without a team)
- Switch between teams and seasons
- Create a new team or season
- Delete a team or season
- When creating a new season, optionally copy the roster from the previous season as a starting point

Each team/season combination has its own roster, game history, and season stats -- completely independent.

## Period Formats

The Game Day format selector supports:

| Format | Label | Use |
|--------|-------|-----|
| 4 Quarters | Q1, Q2, Q3, Q4 | Soccer, basketball, football |
| 3 Periods | P1, P2, P3 | Hockey, lacrosse |
| 2 Halves | H1, H2 | Soccer (older ages), any sport |

The engine works with any period count. Labels adapt throughout the app (lineup cards, share text, field tab pills, season history).

## Backup & Sharing

All data lives on your device. Use the **⋮** menu in the header:

### Backup & Restore
- **Back Up** -- saves a complete snapshot of all teams, seasons, rosters, games, plays, and standalone field plays. Choose "Save to File" (cloud backup coming soon).
- **Restore** -- loads a backup file. Shows a preview of what's in the backup (teams, seasons, date). If you have existing data, a safety backup is auto-downloaded before replacing everything. Settings (theme, defaults) are preserved.

### Sharing Teams
- **Share Team** -- pick any team from the list and download it as a JSON file to send to an assistant coach or parent
- **Import Team** -- loads a shared team file. If the team already exists on your device, you're prompted to replace it. If it's new, it's added. Other teams are not affected

## Settings

Tap **⋮ → Settings** to customize the app:

- **Theme** -- Dark, Light, or System (follows your phone's setting)
- **Default period format** -- set your preferred format so Game Day starts with the right one
- **Default starter mode** -- toggle whether "first N = starters" is on by default
- **Hints** -- show or dismiss all first-use tip banners

## Repo Structure

```
roster-rotation/
|-- index.html              <- PWA app (GitHub Pages serves this)
|-- manifest.json           <- PWA manifest (icons, TWA-ready fields)
|-- sw.js                   <- Service worker (offline support)
|-- privacy.html            <- Privacy policy (required for Play Store)
|-- _config.yml             <- GitHub Pages config (serves .well-known)
|-- js/
|   |-- formations.js       <- SPORTS definitions, presets, formation layouts
|   |-- storage.js          <- localStorage data layer + export helpers
|   |-- engine.js           <- Rotation algorithm (pure JS, zero dependencies)
|   |-- field.js            <- Field tab rendering + drag handling
|   \-- app.js              <- Main UI logic
|-- css/
|   \-- styles.css          <- All styles (extracted from index.html)
|-- icons/
|   |-- icon-192.png        <- PWA icon 192x192
|   \-- icon-512.png        <- PWA icon 512x512
|-- tests/
|   |-- run_all.mjs         <- Test runner (runs all suites)
|   |-- helpers.mjs          <- Test harness, assert helpers, localStorage mock
|   |-- test_engine.mjs     <- Engine algorithm tests
|   |-- test_formations.mjs <- SPORTS, presets, formations tests
|   |-- test_storage.mjs    <- Storage layer CRUD tests
|   \-- test_app_logic.mjs  <- App-level logic tests
|-- docs/
|   |-- DESIGN_DECISIONS.md <- Architecture and technical decisions
|   |-- CONSTRAINT_DESIGN.md <- Constraint system design
|   |-- STRATEGY_INVESTIGATION.md <- Positional play vs fair rotation analysis
|   |-- APP_STORE_GUIDE.md  <- Play Store distribution via TWA (legacy reference)
|   |-- DISTRIBUTION_STRATEGY.md <- Platform, monetization, cloud backup strategy
|   |-- GAME_DAY_ENHANCEMENTS.md <- Goal tracking, sub-tabs, game navigation design
|   \-- ROADMAP.md          <- Development roadmap
|-- .well-known/
|   \-- assetlinks.json     <- Digital Asset Links template (TWA)
\-- README.md
```

## Sport & Position Presets

When creating a season, choose a sport and format. The format determines position count and labels:

| Sport | Format | Positions |
|-------|--------|-----------|
| Soccer | 5v5 | GK, LB, RB, CM, ST |
| Soccer | 7v7 | GK, LB, RB, LW, CM, RW, ST |
| Soccer | 9v9 | GK, LB, CB, RB, LM, CM, RM, LF, RF |
| Soccer | 11v11 | GK, LB, LCB, RCB, RB, LM, CM, RM, LW, RW, ST |
| Football | 7v7 (Flag) | QB, C, WR1, WR2, WR3, RB, TE |
| Football | 11v11 | QB, C, LG, RG, LT, RT, WR1, WR2, TE, RB, FB |
| Baseball | 9-player | P, C, 1B, 2B, SS, 3B, LF, CF, RF |
| Basketball | 5v5 | PG, SG, SF, PF, C |
| Basketball | 3v3 | G, F, C |
| Hockey | 6v6 | G, LD, RD, LW, C, RW |
| Lacrosse | 10v10 | G, D1, D2, D3, M1, M2, M3, A1, A2, A3 |
| Custom | -- | You define them |

The sport selection also drives the field background and formation layouts on the Field tab.

## Position Weights

In `roster.json`, each player can have a `positionWeights` object:

```json
{
  "name": "Casey",
  "positionWeights": {
    "GK": 3,
    "ST": 0
  }
}
```

- `1` = default (omit from the object)
- `2` or `3` = prefer this position (higher = stronger preference)
- `0` = hard exclude (never assigned)

These are season-level preferences that persist across games. For game-day overrides, use position pins (see Constraints above).

## Privacy

All data lives on your device in localStorage. Exported files include real player names -- treat them as private. Share only with trusted co-coaches.

## Installing on Your Phone

1. Open the GitHub Pages URL in Chrome
2. Tap the menu - **Add to Home Screen** (or **Install app**)
3. It appears as a standalone app with offline support

## Testing

Tests run with Node.js (18+), no dependencies:

```bash
node tests/run_all.mjs          # Run all suites (755 assertions)
```

Individual suites can be imported directly, but `run_all.mjs` is the standard entry point. Test coverage:

| Suite | Assertions | Coverage |
|-------|------------|---------|
| Engine | 65 | Generation, equal time, exact fit, exclusions, starters, locks, lock validation, specialPosMax, continuity, season deficit, halves, 5v5, getPlayerSummary |
| Formations | 550 | All sports/formats, preset derivation, icons, preset key roundtrip, position matching, formation layout validation (coord counts, value ranges), auto-layout |
| Storage | 114 | Team/season/roster/game/plays CRUD, game sorting, season stats, cascade delete, v3 export format, clearAll, importBackup, importSharedTeam, roundtrip tests, context persistence, settings preservation |
| App Logic | 26 | Period labels, getSpecialPosition, weight constants, v3 format detection, fairness spread, game number labels |

Tests use a VM sandbox with a localStorage mock — no browser needed. DOM-dependent features (drag reorder, modal focus trap, field rendering) would need Playwright browser tests (see `docs/ROADMAP.md`).

## Local Development

From the repo root:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000` in your browser (use `127.0.0.1`, not `localhost`, to avoid Chrome's HTTPS redirect).