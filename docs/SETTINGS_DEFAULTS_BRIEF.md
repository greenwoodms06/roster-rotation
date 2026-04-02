# Feature Brief: Settings Defaults — Stickiness & Global Max Cap

## Context
The Settings modal (⋮ → Settings) currently has three sections: Appearance, Game Day Defaults (period format, starter mode), and Help. Two constraint values that coaches set once and rarely change should move here as defaults: position stickiness and a global per-game max periods cap.

---

## New Settings

### 1. Position Stickiness Default

**Setting:** Default continuity level for new games.

**Values:** Off / Medium / High (maps to continuity 0/1/2 in engine)

**Current behavior:** Game Day constraint panel has a stickiness toggle. It defaults to Off every time. Coach must manually set it each game.

**New behavior:** Settings stores the default. Game Day constraint panel initializes from the setting. Coach can still override per-game. The per-game override is not persisted back to settings — it's ephemeral for that generation session.

**Storage key:** Add to `rot_settings` object: `defaultContinuity: 0|1|2` (default: 0 for backward compat)

### 2. Global Max Periods Per Game

**Setting:** Maximum number of periods any single player can play in a game, regardless of position. Sport-agnostic.

**Values:** No Limit (default) / 1 / 2 / 3 / ... / N (where N = max periods in format). The dropdown options should adapt based on the default period format setting. For example, if default period format is "4 Quarters", options are: No Limit, 1, 2, 3 (showing 4 would be meaningless since that's all periods).

**Current behavior:** No global cap exists. The existing per-position max (e.g. "max 1 quarter at GK") is a different, more targeted constraint that remains unchanged.

**New behavior:** Settings stores the default global cap. Game Day constraint panel shows it alongside the existing per-position controls. Coach can override per-game.

**Engine impact:** This is enforced in Phase 1 (playing time allocation). When `globalMaxPeriods` is set, no player can be allocated more than that many periods. This is simpler than position-specific max — it's just a ceiling on `periodsPerPlayer[pid]`.

**Storage key:** Add to `rot_settings` object: `defaultGlobalMaxPeriods: null|number` (default: null = no limit)

---

## Settings UI Changes

Add these to the **Game Day Defaults** section of the Settings modal, below the existing Period Format and Starter Mode rows:

```
Game Day Defaults
─────────────────────────────────
Period Format        [4 Quarters ▾]
Starter Mode         [Off       ▾]
Position Stickiness  [Off       ▾]    ← NEW
Max Periods/Player   [No Limit  ▾]    ← NEW
```

---

## Game Day Constraint Panel Changes

The constraint panel currently has:
- Position locks (per-player)
- Stickiness toggle (Off/Med/High)
- Per-position max controls

Changes:
- **Stickiness** initializes from `rot_settings.defaultContinuity` instead of hardcoded 0
- **New row: "Max periods per player"** — dropdown showing No Limit / 1..N-1. Initializes from `rot_settings.defaultGlobalMaxPeriods`. Sits above or below the per-position max controls.

Both are still fully editable per-game. The setting is just the initial value.

---

## Engine Changes (`engine.js`)

### Phase 1 — `_allocatePlayingTime()`

Add `globalMaxPeriods` parameter. After calculating ideal periods per player, clamp each player's allocation to `min(allocated, globalMaxPeriods)`. Then redistribute any freed-up slots to players who are below the cap, prioritizing by season fairness (same logic already used for distributing remainder slots).

**New constraint field:**
```js
constraints = {
  locks: [...],
  continuity: 0|1|2,
  positionMax: { GK: 1 },
  globalMaxPeriods: null|number   // ← NEW
}
```

### Edge cases:
- `globalMaxPeriods >= numPeriods` → effectively no limit, same as null
- `globalMaxPeriods = 1` with 10 players and 4 periods → 4×7=28 player-slots, each player plays at most 1 → need at least 28 unique slots but only 10 players × 1 = 10 fills. This would leave 18 empty slots. The engine should error if `availablePlayers.length * globalMaxPeriods < numPeriods * numPositions` (not enough player-slots to fill the game).
- When combined with per-position max: both constraints apply. A player capped at 2 periods globally AND 1 period at GK plays at most 2 periods, at most 1 of which is GK.

---

## Storage Changes (`storage.js`)

No changes needed. `rot_settings` is already a freeform object read/written via `loadSettings()` / `saveSettings()`. New keys are just additional properties.

---

## Service Worker

Bump cache version after implementation.

---

## Test Coverage

### Engine tests (`test_engine.mjs`)

- globalMaxPeriods caps playing time correctly (e.g., 10 players, 4 quarters, cap=3 → no player plays more than 3)
- globalMaxPeriods=null behaves identically to current (no regression)
- Error thrown when globalMaxPeriods is too low to fill the game
- globalMaxPeriods interacts correctly with per-position max (both enforced)
- globalMaxPeriods respects season fairness (players with lower season time get priority for their capped slots)

### Manual testing

- [ ] Settings shows new dropdowns with correct options
- [ ] Game Day constraint panel initializes from Settings values
- [ ] Changing Game Day constraint doesn't change Settings value
- [ ] Changing Settings value is reflected next time Game Day panel opens
- [ ] Settings survive backup/restore cycle
- [ ] Light/dark theme renders correctly
