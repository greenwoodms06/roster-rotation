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
- **Global max periods per player** -- cap how many total periods any player can play, regardless of position. Use case: "No player plays more than 3 of 4 quarters." Works with any sport. Treated as a hard cap — the engine relaxes the sub cap before exceeding this value.
- **Max subs per break** -- cap how many players can be subbed out between consecutive periods. Use case: "I've got 14 kids and only want to swap 2 at a time so the game keeps flowing." Defaults to Any. Soft constraint: may force a player past their equal-time share to keep the roster stable, and relaxes automatically when the hold-over pool exhausts against the Max Periods cap. When it forces overflow, the player with the lowest season-ratio is chosen first so overflow rotates across games.

**Constraint precedence** (when over-constrained): fully staff every period → honor Max Periods → relax Max Subs as needed → equal playing time → relax Max Periods only as a last resort if no valid plan exists.

All constraints default to off (or to the values set in Settings). When off, behavior is identical to the original algorithm. Post-generation tap-to-swap is always available for manual adjustments.

### Field Tab & Play Diagramming

The **Field** tab shows a top-down SVG diagram of the field with draggable player dots. The field supports scrolling and pinch zoom on mobile -- swipe on the background to scroll, pinch to zoom, drag dots to reposition. It works in three contexts:

- **Standalone mode** (no team selected) -- the full interactive field is available immediately. A sport/format selector lets you pick any sport and format. Custom sport offers +/- buttons to add or remove positions (P1, P2, ...) and a field background selector (soccer, basketball, hockey, etc.). Plays saved in standalone mode persist separately from team data.
- **Template mode** (team selected, no game plan) -- shows position labels on dots with the team's formation selector.
- **Game mode** (team selected, game plan active) -- shows player names per period with period pills and bench.

Play diagramming features (available in all modes):

- **Saved plays** -- drag dots into position, then save as a named play via the + menu. Load any saved play from the dropdown to restore positions instantly. Plays are per-team, per-season (or per-standalone bucket).
- **Route drawing** -- toggle draw mode (pencil icon), then drag your finger across the field to draw movement paths. Routes render as smooth curves with arrowheads. Tap a route to select it, then delete it individually. Undo and clear-all are available.
- **Zone drawing** -- toggle zone mode (square icon) to draw freehand shapes on the field. Four colors available (blue, red, yellow, green). Zones render as semi-transparent filled shapes. Tap a zone to select and delete. Zones layer above the field background but below routes and dots.
- **Defense overlay** -- toggle DEF to show draggable opponent X markers (red). Add or remove markers as needed. Defense positions save with plays.
- **Formations** -- switch between sport-specific formations (e.g., 2-3-1, 3-2-1 for soccer 7v7). Each sport has a detailed SVG field background.

All diagramming elements (dot positions, routes, zones, defense markers) persist when saving a play and are included in backup exports.

## Setup

### Quick Start (Field Only)

The Field tab works immediately with no setup. Open the app and switch to the Field tab to diagram plays for any sport. No team or roster required.

### Team Setup
1. Open the app and create a team (give it a name)
2. Create a season (name + choose a position preset or define custom positions)
3. Add your players on the Roster tab, with any position weight preferences

Season creation uses a Sport dropdown plus a **Players per side** stepper (e.g. 7v7, 5v5, 11v11). Any integer from 2 to 20 is allowed. Changing the stepper or the sport auto-fills the Positions text field:
- If the sport has an exact preset for that count, it uses the preset positions.
- Otherwise, it fills from the sport's canonical position pool (ordered essential → specialized), padding with `P#` if the count exceeds the pool.
- Editing the Positions text directly also updates the stepper to match the new count.
- "Custom" sport leaves positions freeform (no auto-fill).

### Game Day
1. Open the app - Game Day tab
2. Set the game format with the `+/−` stepper (any count from 1 to 999; label auto-derives: 4 Quarters, 2 Halves, 1 Game, everything else as Periods)
3. Check who's available, drag the grip handle to reorder for starters
4. Optionally expand Constraints to set pins, stickiness, position max, global max periods, or max subs per break
5. Tap **Generate Lineup**
6. Use the **Lineup** tab on the sideline (see In-Game Features below)

### After the Game
1. Check the **Season** tab for fairness charts, position distribution, and W-L-D record
2. To back up or share: tap **⋮** in the header → Back Up or Share Team

## In-Game Features

The **Lineup** tab is designed for sideline use during a game:

- **Tap-to-swap** -- tap any two players in the same period to open the swap popup. When both slots are clean (no mid-period subs yet), tapping swaps instantly. When slots have sub history, the popup appears with a unified time picker: **Swap** (selected by default) trades positions instantly, or pick a fraction (¼/⅓/½/⅔/¾) to record when the sub happened. Toggle **Approx/Exact** for second-precise timing with 1s/10s/30s/1m/5m increments. One **Confirm** button executes all actions. **Reset to full period** (text link) wipes sub history for corrections.
- **Timeline bars** -- position-colored bars on each player row show time at each position during the period. Tap any bar for a full-game detail popup with per-period breakdowns, position legends, and reset buttons. Always visible.
- **Game clock** -- always visible in the lineup header. Play/pause, reset, count up or count down. When running, the clock auto-fills the sub time in the exact stepper.
- **Goal tracking** -- use the +/- buttons on each player row to track who scored. Opponent goals are tracked per period in the score header. The running score is displayed at the top of each period card.
- **Scrimmage toggle** -- check "Scrimmage" to mark a game as an exhibition. Scrimmage games are excluded from season stats (W-L-D record, playing time fairness).
- **Game label** -- add an optional label (e.g. "vs. Lincoln FC") that appears in game history and share text.
- **Game notes** -- a text area at the top of the Lineup tab for freeform notes. Auto-saves on every keystroke. Notes are preserved when re-generating and included in share text.
- **Edit Roster (late arrival / early departure)** -- tap the Edit button to add a player who showed up late or remove a player who left early. The engine rebalances all remaining periods fairly, freezing periods already played.
- **Rebalance** -- tap the ↺ icon on any period card (period 2+) to re-optimize from that point forward. Useful after manual swaps to restore fairness across remaining periods. Warns if goal data exists in periods that will be regenerated.
- **Add period** -- tap `[+ Add Quarter/Half/Period]` at the bottom of the lineup to extend the game. All existing periods stay frozen; the new period is generated fairly against that history. Useful for overtime, extra drills, or mid-game format changes.
- **Remove period** -- tap the trash icon on any period card. A modal offers four options: *Rebalance All* (regenerates every remaining period), *Rebalance After* (freezes earlier periods, regenerates the tail), *Remove Only* (deletes the period with no regeneration — "we planned too many"), or *Cancel*. Each option shows inline which goals will be cleared. Cannot remove below 1 period.

### Multiple Games Per Day

If you generate a lineup for a date that already has a game, a prompt offers three options: Add (creates Game 2, Game 3, etc.), Replace (overwrites the last game), or Cancel. Each game on the same date gets its own game ID and appears separately in season history.

## Multi-Team & Multi-Season

The app supports managing multiple teams and seasons. Tap the context label in the header (e.g. "U10 King Cobras - Spring 2026") to:

- Switch to **Field Only** mode (full field diagramming without a team)
- Switch between teams and seasons
- Create a new team or season
- Delete a team or season
- When creating a new season, optionally copy the roster from the previous season as a starting point

Each team/season combination has its own roster, game history, and season stats -- completely independent.

## Period Formats

The Game Day format stepper accepts any integer from 1 to 999. The label auto-derives based on count:

| Count | Label | Typical use |
|-------|-------|-------------|
| 1 | Game | Single-segment games, scrimmages |
| 2 | Halves (H1, H2) | Soccer (older ages), any sport |
| 4 | Quarters (Q1..Q4) | Soccer, basketball, football |
| 3, 5, 6, 7+ | Periods (P1..Pn) | Hockey, lacrosse, innings, custom drills |

The engine works with any period count. Labels adapt throughout the app (lineup cards, share text, field tab pills, season history). Periods can also be added or removed mid-game from the Lineup tab (see In-Game Features).

## Backup & Sharing

All data lives on your device. Use the **⋮** menu in the header:

### Backup & Restore
- **Back Up** -- saves a complete snapshot of all teams, seasons, rosters, games, plays, and standalone field plays.
- **Restore** -- loads a backup file. Shows a preview of what's in the backup (teams, seasons, date). If you have existing data, a safety backup is auto-downloaded before replacing everything. Settings (theme, defaults) are preserved.

### Sharing Teams
- **Share Team** -- pick any team from the list and export it as a file to send to an assistant coach or parent
- **Import Team** -- loads a shared team file. If the team already exists on your device, you're prompted to replace it. If it's new, it's added. Other teams are not affected

## Settings

Tap **⋮ → Settings** to customize the app:

- **Theme** -- Dark, Light, or System (follows your phone's setting)
- **Game Structure** -- default sport, default players per side (2–20), game format (stepper: any count from 1 to 999; seeds new games only), segment length (MM:SS), starter mode, position stickiness, max segments per player, max subs per break. Changing the default sport resets the player count to that sport's typical default (e.g., soccer → 7, basketball → 5, hockey → 6).
- **Tracking & Clock** -- timing precision (Approx / Exact), clock direction (↓ Down / ↑ Up)
- **Hints** -- show or dismiss all first-use tip banners

## Repo Structure

```
roster-rotation/
|-- index.html              <- PWA app (GitHub Pages serves this)
|-- manifest.json           <- PWA manifest (icons, TWA-ready fields)
|-- sw.js                   <- Service worker (offline support + update detection)
|-- privacy.html            <- Privacy policy (required for Play Store)
|-- _config.yml             <- GitHub Pages config (serves .well-known)
|-- js/
|   |-- formations.js       <- SPORTS definitions, presets, formation layouts
|   |-- credit.js           <- v4 fractional credit utilities
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
|   |-- helpers.mjs         <- Test harness, assert helpers, localStorage mock
|   |-- test_engine.mjs     <- Engine algorithm tests
|   |-- test_formations.mjs <- SPORTS, presets, formations tests
|   |-- test_storage.mjs    <- Storage layer CRUD tests
|   |-- test_credit.mjs     <- v4 credit/migration tests
|   |-- test_swap.mjs       <- Swap/sub/replace/reset tests
|   \-- test_app_logic.mjs  <- App-level logic tests
|-- docs/
|   |-- DETAILS.md          <- This file (user guide + project reference)
|   |-- DESIGN_DECISIONS.md <- Architecture and technical decisions
|   |-- ROADMAP.md          <- Development roadmap
|   |-- DISTRIBUTION_STRATEGY.md <- Platform, monetization, cloud backup strategy
|   |-- STRATEGY_INVESTIGATION.md <- Positional play vs fair rotation analysis
|   \-- SESSION_HANDOFF.md  <- Current session state for continuity
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
2. Tap the menu → **Add to Home Screen** (or **Install app**)
3. It appears as a standalone app with offline support
4. When updates are available, the app shows a banner prompting you to back up data first, then tap Update

## Testing

Tests run with Node.js (18+), no dependencies:

```bash
node tests/run_all.mjs          # Run all suites (1303 assertions)
```

Individual suites can be imported directly, but `run_all.mjs` is the standard entry point. Test coverage:

| Suite | Assertions | Coverage |
|-------|------------|---------|
| Engine | 355 | Generation, equal time, exact fit, exclusions, starters, locks, lock validation, specialPosMax, continuity, globalMaxPeriods, maxSubsPerBreak, season deficit, halves, 5v5, getPlayerSummary (v4), rebalanceFromPeriod, firstAvailableStart edge cases, spacing/rest |
| Formations | 550 | All sports/formats, preset derivation, icons, preset key roundtrip, position matching, formation layout validation, auto-layout |
| Storage | 125 | Team/season/roster/game/plays CRUD, game sorting, season stats (v4 fractional), cascade delete, v4 export format, import with auto-migration, roundtrip tests |
| Credit | 115 | v4 entry/slot credit, occupantAtTime, wrapEngineOutput, v4↔v3 conversion, migration, validation, gamePlayedFraction, seasonFairnessRatio |
| Swap/Sub | 94 | resolveSwapLocations, deriveVisualBench, splitSlotEntry, executeSwap (6 scenarios), executeFullReplace with cleanup, executeMidPeriodSub, tap order independence, credit integrity, resetPlayerInPeriod |
| App Logic | 64 | Period labels (incl. 1=Game), getSpecialPosition, weight constants, v3 detection, fairness spread, game numbers, sanitizePositions, displayName, archived players |

Tests use a VM sandbox with a localStorage mock — no browser needed. DOM-dependent features (drag reorder, modal focus trap, field rendering) would need Playwright browser tests (see `docs/ROADMAP.md`).

## Local Development

From the repo root:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000` in your browser (use `127.0.0.1`, not `localhost`, to avoid Chrome's HTTPS redirect).
