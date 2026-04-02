# Lineup Constraints & Field Plays — Design Document

## Part 1: Lineup Constraint System

### Current Architecture Recap

The engine runs three phases:

1. **Phase 1 — Playing Time Allocation:** How many periods each player plays (fairness by season deficit).
2. **Phase 2 — Period Scheduling:** Which specific periods each player plays (urgency-based scheduling).
3. **Phase 3 — Position Assignment:** Which position each player plays within their assigned period (cost-minimized permutation search).

All constraints below are analyzed in terms of which phase they affect and how they interact with existing logic.

---

### Constraint 1: Position Locks / Pinning

**What:** "Alex always plays GK" or "Jordan plays CM in Q1 and Q3."

**Phase affected:** Phase 3 (Position Assignment), with Phase 2 implications for per-period locks.

**Design approach — Fixed points within the optimizer:**

The locked assignments are applied *before* the permutation search runs. For a given period:

1. Remove locked players from the candidate pool
2. Remove their locked positions from the available position list
3. Run the permutation search on the remaining N-k players and N-k positions
4. Merge the locked assignments back into the result

This is cleaner than pre-removing players from the pool entirely, because:
- The locked player still counts toward playing time allocation (Phase 1)
- Phase 2 still schedules them into the right periods
- Only Phase 3 is modified

**Per-period locks** ("Jordan plays CM in Q1 and Q3") additionally constrain Phase 2 — the scheduler must ensure Jordan is in the period roster for Q1 and Q3. This can be handled as a pre-assignment step: before urgency-based scheduling, force-place any period-locked players into their required periods and decrement their remaining allocation.

**Complexity:** Moderate. Phase 3 changes are straightforward (filter before permute). Phase 2 changes for per-period locks need care to avoid breaking urgency sort invariants.

**Data model:**
```json
{
  "locks": [
    { "pid": "p01", "position": "GK" },
    { "pid": "p05", "position": "CM", "periods": [1, 3] }
  ]
}
```

Stored per-game (in the game setup before generation). Not per-season — locks are situational.

**UI:** On the Game Day tab, long-press or tap a gear icon on a player to open a lock picker. Shows position dropdown and optional period checkboxes. Locked players get a 🔒 badge in the available list.

---

### Constraint 2: Position Continuity / Stickiness

**What:** "Try to keep players at the same position for N consecutive periods."

**Phase affected:** Phase 3 (Position Assignment) — additional cost term.

**Design approach — Cost function addition:**

Add a `WEIGHT_CONTINUITY` term to the cost matrix. When building costs for period P, look at the player's assignment in period P-1. If the player was at position X last period, reduce the cost of assigning them to X again (or equivalently, increase the cost of assigning them elsewhere).

```
continuity_cost = player_was_at_this_position_last_period ? -WEIGHT_CONTINUITY : 0
```

This is a *soft* constraint — a tunable weight, not a hard lock. Setting it high makes position changes rare; setting it low lets the fairness optimizer dominate as it does today.

**Trade-off with game diversity:** The existing `WEIGHT_GAME_DIVERSITY` term *penalizes* repeating positions within a game. Continuity directly opposes this. The resolution is simple: they're separate weights. The coach chooses which matters more for their context. A "stickiness" slider on Game Day (0 = maximum variety, 100 = maximum continuity) maps to the ratio between these two weights.

**Complexity:** Low. One new term in `_buildCostMatrix`, no structural changes.

**Data model:** Single numeric value per game setup:
```json
{ "continuityWeight": 0.0 }  // 0 = off (default), up to ~3.0
```

**UI:** Slider or toggle on Game Day tab, below the format selector. Label: "Position stickiness" with Low/High endpoints.

---

### Constraint 3: Position Group Continuity (Zone Stickiness)

**What:** "Keep players in the same zone (defense/midfield/attack) even if the specific position changes."

**Phase affected:** Phase 3 (Position Assignment) — cost term, softer than full continuity.

**Design approach:** Identical to Constraint 2, but the continuity cost uses zone membership instead of exact position match.

Requires a position-to-zone mapping:
```json
{
  "zones": {
    "defense": ["GK", "LB", "RB"],
    "midfield": ["CM", "LW", "RW"],
    "attack": ["ST"]
  }
}
```

When building the cost matrix for period P, if the player was in zone Z last period, reduce cost for all positions in zone Z.

**Complexity:** Low (once Constraint 2 exists, this is a one-line generalization).

**Composability with Constraint 2:** They're additive. A coach could want both "prefer same position" (strong) AND "if you must move, stay in the same zone" (medium). Two separate weights.

**Data model:** Zone mapping defined per-preset in `formations.js`. Custom seasons would need a zone editor (or auto-group by position order: first third = defense, middle third = midfield, last third = attack).

**UI:** Second slider below stickiness, or a single "Zone stickiness" toggle that activates a softer version of Constraint 2.

---

### Constraint 4: Platoon / Rotation Groups

**What:** "Group A plays Q1 and Q3, Group B plays Q2 and Q4."

**Phase affected:** Phase 2 (Period Scheduling) — hard override.

**Design approach:** This replaces the urgency-based scheduling for affected periods. The coach defines two (or more) groups. Each group maps to specific periods. Phase 2 simply uses the group assignments instead of computing the schedule.

Phase 1 (playing time allocation) must account for the group constraints — each player plays exactly the periods their group is assigned. If Group A has 8 players and there are 7 positions, Phase 1's allocation still determines who gets extra time, but the scheduling is locked.

**Edge cases:**
- Groups must each have ≥ N players (N = number of positions). If not, error or warning.
- Odd numbers of periods (3 quarters?) — groups could map unevenly (A: Q1+Q3, B: Q2). Fine.
- If a player is in multiple groups — not allowed, one group per player per game.

**Complexity:** Moderate. Phase 2 override is straightforward, but Phase 1 needs to adapt to fixed period counts per player.

**Data model:**
```json
{
  "platoons": {
    "A": { "players": ["p01", "p02", ...], "periods": [1, 3] },
    "B": { "players": ["p05", "p06", ...], "periods": [2, 4] }
  }
}
```

**UI:** On Game Day, a "Platoon mode" toggle. When on, shows two (or more) group columns. Players are dragged between groups. Period assignment chips below each group.

---

### Constraint 5: GK Constraints

**What:** "GK only changes at halftime" or "Max 1 period of GK per player per game."

**Phase affected:** Both Phase 2 and Phase 3.

**Design approach — Two sub-constraints:**

**5a. GK continuity ("GK only changes at halftime"):**
This is a special case of Constraint 2 (position continuity) applied only to GK. Implementation: after Phase 3 assigns positions for period P, if the GK player from P-1 is still on the field, force them into GK again. This is a hard constraint, not a cost term.

Alternatively: treat it as a position lock (Constraint 1) that auto-extends. Once a player is assigned GK in Q1, auto-lock them to GK for Q2. At halftime (Q3), allow a new GK assignment.

**5b. GK max periods ("Max 1 period of GK per player per game"):**
Add a per-game cap to Phase 3's cost matrix. If a player has already played GK in this game, set their GK cost to `EXCLUSION_COST` for remaining periods. Simple addition to `_buildCostMatrix` using `gamePositionCounts`.

**Complexity:** Low to moderate. 5b is trivial (one condition in cost matrix). 5a requires defining "halftime" (period N/2) and adding a lock propagation step.

**Data model:**
```json
{
  "gkConstraints": {
    "changeAt": "halftime",     // "halftime" | "any" | "never"
    "maxPeriodsPerPlayer": 1    // null = no limit
  }
}
```

**UI:** GK section in Game Day setup, below format selector. Two controls: "GK changes" dropdown (Every period / Halftime only / Never) and "Max GK periods per player" number input.

**Note:** GK constraints generalize to any "special position" — a catcher in baseball, a goalie in hockey. The UI should label this based on the sport preset rather than hardcoding "GK."

---

### Constraint 6: Buddy System

**What:** "These two players should always be on the field at the same time" or "never at the same time."

**Phase affected:** Phase 2 (Period Scheduling) — hard constraint.

**Design approach:**

**Always-together:** When scheduling a period, if player A is selected, player B must also be selected (and vice versa). During urgency sorting, treat buddy pairs as atomic units. If one is selected, the other is force-included even if their urgency is lower.

**Never-together:** When scheduling a period, if player A is selected, player B is excluded from that period's roster. During urgency sorting, when A is picked, B is removed from the candidate pool.

**Edge cases:**
- Buddy chains (A+B, B+C → A+B+C must all play together). Need transitive closure.
- Always-together conflicts with playing time fairness if the buddy pair has different season deficits.
- Never-together with only N+1 players total might make scheduling impossible.

**Complexity:** Moderate to Hard. The constraint propagation during Phase 2 scheduling can create unsatisfiable states. Need validation before generation ("These buddy constraints can't be satisfied with this roster").

**Data model:**
```json
{
  "buddies": [
    { "players": ["p01", "p02"], "type": "together" },
    { "players": ["p03", "p04"], "type": "apart" }
  ]
}
```

Per-season setting (these tend to be stable across games).

**UI:** In the player edit modal or a dedicated "Pairings" section on the Roster tab. Link two players with a "together" or "apart" badge.

---

### Constraint Interaction Matrix

| Constraint | Conflicts with | Composable with |
|---|---|---|
| Position Locks | Platoons (if lock contradicts group assignment) | All others |
| Continuity | Game Diversity weight (tension, not conflict) | Zone Continuity, GK Constraints |
| Zone Continuity | Game Diversity weight (less tension) | Continuity, Locks |
| Platoons | Buddy System (group assignment may violate buddy rules) | Locks, GK Constraints |
| GK Constraints | None (specialized) | All others |
| Buddy System | Platoons, Playing Time Fairness | Locks, Continuity |

**Key conflicts to watch:**
- Platoons + Buddies: A buddy pair split across platoon groups is unsatisfiable.
- Locks + Platoons: A player locked to a specific period that conflicts with their platoon assignment.
- Many constraints active simultaneously could make generation slow or impossible. Need a "constraint validation" step before running the engine.

---

### Priority Ranking

If implementing only 2-3 constraints, ranked by coaching value per implementation effort:

1. **Position Locks (Constraint 1)** — Highest value. Every coach has at least one player who "must play GK" or "needs to be at CB." Implementation is moderate and the most frequently requested feature. This also covers the most common GK constraint use case (lock a player to GK).

2. **Position Continuity (Constraint 2)** — High value, low effort. Kids genuinely struggle with position changes every 8 minutes. A single cost term addition solves a real coaching pain point. The slider UI is simple.

3. **GK Max Periods (Constraint 5b)** — High value, trivial effort. One condition in the cost matrix. "No kid plays GK more than once" is a near-universal youth soccer rule.

**Defer:**
- Platoons (Constraint 4): Useful but niche. Most teams under 14 players don't need this.
- Buddy System (Constraint 6): Complex edge cases, moderate value. Post-generation swaps handle most real scenarios.
- Zone Continuity (Constraint 3): Nice-to-have refinement of Constraint 2, implement after Constraint 2 ships.

---

## Part 2: Field Plays Feature

### Concept

The Field tab currently shows a single formation with draggable dots — either in template mode (position labels) or game mode (player names per period). The plays feature extends this to let coaches:

1. **Create named plays** — custom dot arrangements with optional drawn routes/arrows
2. **Save and load plays** — persist across sessions
3. **Toggle defensive overlay** — show opponent positions as Xs
4. **Export/import play sets** — share with other coaches

### Architecture

#### Play Data Model

```json
{
  "plays": [
    {
      "id": "play_001",
      "name": "Corner Kick Left",
      "formation": 0,
      "positions": {
        "GK": [50, 91],
        "LB": [35, 40],
        "RB": [65, 45]
      },
      "defense": [
        { "x": 40, "y": 50, "label": "" },
        { "x": 60, "y": 50, "label": "" }
      ],
      "showDefense": true
    }
  ]
}
```

Key fields:
- `positions`: Overridden dot coordinates (same format as `fieldDotPositions`)
- `defense`: Array of defensive player positions (Xs on the field)
- `formation`: Index into the current sport's formation layouts (base formation the play was built from)

#### Storage

Plays are per-team, per-season (they're tied to a position set). localStorage key:
```
rot_{teamSlug}_{seasonSlug}_plays
```

Export/import follows the existing pattern — plays included in full backup, optional standalone export.

#### Defense Toggle

When defense is enabled, the field SVG renders additional markers:

- **Shape:** X marks (two crossed lines) rather than circles, to visually distinguish from offensive dots
- **Color:** `rgba(255,82,82,0.6)` (danger-red, semi-transparent) — clearly "opponent"
- **Size:** Slightly smaller than offensive dots (12px radius vs 16px)
- **Draggable:** Yes, same pointer event system as offensive dots
- **Labels:** Optional short text label below each X (e.g., "GK", "D1")
- **Count:** Configurable — defaults to matching the number of positions in the current preset, but can be added/removed

Alternative considered: triangles, squares, or different-colored circles. Xs are the most universally recognized symbol for "opponent" in play diagrams across sports. They're also easy to render in SVG (two crossed lines).

#### UI Flow

1. **Play List:** Below the formation selector, a new row: play dropdown + buttons (Save, New, Delete)
2. **Saving a play:** After dragging dots and defense into position, tap "Save Play" → prompted for a name → saved to localStorage
3. **Loading a play:** Select from dropdown → dot positions and defense markers load instantly
4. **Defense toggle:** Button in the field controls bar (shield icon or "DEF" label). When on, X markers appear and are draggable. A "+" button adds more Xs, long-press on an X removes it.

#### Field Controls Layout (Updated)

```
[Formation Dropdown ▼] [↺ Reset] [🛡 DEF]
[Play Dropdown ▼] [💾 Save] [+ New] [🗑]
[Period pills: Q1 Q2 Q3 Q4]
[SVG Field]
[Bench]
```

The second row only appears when plays exist or the coach taps "New."

#### Export/Import

Two additions to the existing export menu:

- **Export Plays:** Downloads `plays.json` for the current team/season
- **Import Plays:** File picker, merges by play ID (new plays added, existing plays updated by ID, no deletions)

Plays are also included in the "Full Backup" export automatically.

### Implementation Phases

**Phase A (MVP): COMPLETED.** Save/load named plays with custom dot positions. Actions dropdown menu with save-as-new (case-insensitive duplicate detection), overwrite, delete. Reset-to-saved button. Play name filter for >5 plays.

**Phase B: COMPLETED.** Defense toggle with draggable X markers. Auto-seeded to position count, add/remove buttons. Red X shapes visually distinct from player dots. Saved with plays.

**Phase C: COMPLETED.** Route drawing with touch-drag. Bezier-smoothed paths with downsampled points, opaque arrowheads (manual polygon, not SVG markers), trimmed stroke endpoints. Per-route selection and deletion in draw mode. Undo and clear-all. Routes saved with plays.

### Complexity Assessment (Retrospective)

- **Phase A:** Low-moderate as predicted. ~150 lines in field.js, ~17 in storage.js.
- **Phase B:** Moderate as predicted. Defense drag handler parallels dot drag. Seeding logic was the only non-trivial piece.
- **Phase C:** Moderate (lower than predicted). The bezier smoothing approach (quadratic curves through midpoints) avoided the complexity of full path editing. The biggest challenge was arrowhead rendering — SVG markers failed and required manual polygon computation. Route selection via invisible hit areas was cleaner than long-press detection.
