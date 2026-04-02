# Feature Brief: Late Arrival & Rebalance Remaining Periods

## Context
Roster Rotation Manager — a vanilla JS PWA (no frameworks, no dependencies) for sideline lineup rotation. Core files: `engine.js` (pure algorithm), `app.js` (UI logic), `styles.css`, `sw.js` (service worker). Deployed on GitHub Pages, primary device is Google Pixel/Android Chrome.

---

## Two Features Requested

### 1. Late Arrival
A player shows up after the game has already started. They need to be inserted into remaining periods without touching past/current periods.

### 2. Rebalance Remaining Periods
After manual swaps or a late arrival, re-optimize all periods from a chosen point forward — using what's already been played to keep full-game fairness intact.

---

## Engine Change (`engine.js`)

New method on `RotationEngine`: **`rebalanceFromPeriod(existingPlan, fromPeriodIdx, newPlayerIds, constraints)`**

**Logic:**
1. Slice `periodAssignments[0..fromPeriodIdx-1]` as **frozen** (untouched)
2. Count how many frozen periods each player actually played
3. Build **augmented season stats** — add frozen play counts to `totalPeriodsPlayed` and the full game to `totalPeriodsAvailable`. This makes players who've played more frozen periods rank lower for remaining slots, preserving fairness without regenerating past work
4. Temporarily swap in augmented stats, run Phase 1 (playing time allocation) for remaining periods only, restore original stats
5. Run Phase 2 (period scheduling) and Phase 3 (position assignment) for remaining periods, seeding `gamePositionCounts` from frozen periods so position diversity is continuous across the whole game
6. Seed `prevAssignments` from the last frozen period so continuity weight works across the freeze boundary
7. Merge and return: `{ ...existingPlan, availablePlayers: allAvailable, periodAssignments: [...frozen, ...regenerated] }`

**Late arrivals:** Simply passed in as `newPlayerIds` — they get `0` frozen plays so Phase 1 gives them fair share of remaining slots.

---

## UI Changes (`app.js`)

**`renderLineup()` — two additions:**

1. **"+ Late" button** in the lineup header action row (next to Share/Delete). Disabled when all roster players are already in the game.

2. **↺ icon button** in each period card header for periods 2+ (not on Q1 — can't rebalance with nothing frozen).

**New functions needed:**
- `openLateArrivalModal()` — modal with a player picker (roster players not in current game) + "joining from period X" selector
- `confirmLateArrival(pid, fromPeriodIdx)` — calls `doRebalance(fromPeriodIdx, [pid])`
- `openRebalanceModal(fromPeriodIdx)` — confirmation showing "Q1–Q2 frozen, Q3–Q4 will be regenerated"
- `doRebalance(fromPeriodIdx, newPids = [])` — instantiates engine with current roster + season stats, calls `engine.rebalanceFromPeriod(...)`, saves, re-renders, shows toast

---

## Styles (`styles.css`)

- `.rebalance-btn` — small muted icon button that sits right-aligned in `.period-header`
- Possibly `.btn-icon` for the person-plus button in the header actions

---

## Service Worker (`sw.js`)

Bump cache version: `rotation-v1.0` → `rotation-v1.1`

---

## Tests (`test_engine.mjs`)

New suite: **`Engine — rebalanceFromPeriod`**

Assertions to verify:
- Frozen periods are byte-identical to the originals
- Late arrival player appears in remaining periods
- Period numbers in regenerated periods are correct (e.g. Q3=3, Q4=4, not 1/2)
- Bench is correct (all available players not on field)
- Playing time across full game is as fair as possible (spread ≤ 1)
- With `newPlayerIds=[]`, existing available players are preserved and re-optimized only

---

## Key Constraints / Gotchas for Implementation

- **`availablePlayers` on the plan must be updated** to include any late arrivals — it's the source of truth for the player summary table and season stats recording
- **Constraints object** should be read from current `gameLocks`, `gameContinuity`, `gameSpecialPosMax` state in `app.js` (same as `doGenerate`)
- **Late arrival modal** should only show players present in `roster.players` but absent from `currentPlan.availablePlayers`
- **"From period" selector in late arrival modal** should default to the next unplayed period (e.g. if Q2 is live, default to Q3)
- **Period number in regenerated assignments** must be `fromPeriodIdx + i + 1` (1-based), not just `i + 1` — easy bug to introduce
- **Don't touch `currentPlan.date`, `.gameId`, `.notes`, `.label`, `.numPeriods`** — only `availablePlayers` and `periodAssignments` change
