# Idea: Position Groups (Offense / Defense / Special Teams)

**Status:** Tabled. Not implemented. Deferred until there is real demand from a football coach or similar user.

**Date:** 2026-04-13

## Problem

Football (tackle, and sometimes flag) platoons players between offense and defense — different kids on the field for each side, different position lists, potentially different formations. The current engine assumes one lineup per period with a single position list and all available players competing for all slots. That model can't balance a football roster where Alex plays QB on offense and doesn't touch defense while Bob plays CB on defense and doesn't touch offense.

## Is this a general need or football-specific?

Football is essentially the only mainstream team sport that needs this:

| Sport | Needs groups? | Why |
|---|---|---|
| Football (tackle) | **Yes** — O / D / ST platoons | Canonical use case |
| Football (flag) | Sometimes | Smaller rosters often mean kids play both sides — groups can be overkill |
| Baseball / softball | **No (different problem)** | Offense = batting order, defense = fielding; they're sequential not simultaneous. A batting-order tool is a separate feature, not parallel lineups |
| Lacrosse | No | Attack/middie/defense all on field at once — single-lineup model handles it |
| Hockey | No | Same 6 skate both ends; "line changes" is a within-period thing |
| Basketball, soccer, volleyball | No | Same players both ends |

So investing in groups is almost entirely an investment in football tackle.

## Workarounds available today (zero code)

**Two seasons per team** — "U12 Wildcats — Spring 2026 Offense" and "... Defense". Each has its own roster and position list. Players on both sides are entered in both. Coach generates two lineups per game day.

Ugly but unblocks football coaches without any engine or UI changes.

## What a real solution looks like

### Data model

```js
team = {
  slug, name,
  groups: [{ id, name, positions }]  // default: [{ id: 'main', name: 'Main', positions: [...] }]
}

roster.players[pid] = {
  name, num, archived,
  groups: { main: { weights: {...} } }   // per-group membership + weights
}

game.periodAssignments[i] = {
  period,
  byGroup: { main: { assignments: {...} } }   // per-group lineup per period
}
```

Single-group teams render identically to today (the `groups` array has one entry called `"main"`, everything flows through a single key). Migration from current shape is a trivial wrap.

### Engine

No algorithm change. `generateGamePlan` runs once per group per period, with a filtered player pool (only players in that group). Fairness is tracked **per-group** so a defense-only player isn't penalized for missing offensive snaps. A player in multiple groups has multiple independent ledgers.

### UI rules

1. **Single-group teams render identically to today.** Zero UI change unless the team is configured with more than one group. This is the non-negotiable rule — preserves the app's simplicity for the 95% case.
2. **Multi-group: segmented control at the top of Lineup tab** — one group visible at a time. Coaches on the sideline focus on one side between snaps anyway.
3. **Season stats** get the same tabs.
4. **Roster tab** shows small group badges (O, D, ST) on each player card for quick coverage audit.
5. **Roster edit modal** gets the same tabs — per-group position weights. Same interaction model, just multiplied.
6. **Game Day available-players list** filters by group (pill at top). "Who's here today?" is one answer; "who plays O vs D" is the membership already on the player.

### Cross-group fairness

Don't try to compare. Each group has its own fairness ledger. A player in multiple groups has multiple ledgers.

## Scope estimate

4–6 focused sessions, most of it UI work. The engine change is almost free (two independent runs). The hard parts:
- Migration of existing data
- Roster edit UI with group tabs
- Lineup tab segmented control
- Season stats tabbed split
- Field tab formations per group
- Copy-roster-from-last-season needs to preserve groups

## Decision

Tabled until a real football coach asks for it. The two-seasons workaround is serviceable for the interim.

## Things to avoid painting into a corner

While this is deferred, future changes to season / roster / game shape should **not** preclude later adding a `groups` field alongside existing `positions`. Specifically:

- Don't hardcode assumptions that a season has a single flat position list at the expense of extensibility.
- Don't couple formations to sport+N so tightly that a group-specific formation is impossible. (Current shape is already fine — `byCount[N].formations` just becomes `byGroup[g].byCount[N].formations` if ever needed.)
- Don't build a "batting order" feature as a special case of groups — it's structurally different (sequential, not parallel) and deserves its own model.

## Related future work

- **Batting order tool** (baseball/softball) — different feature, different data model. Sequential per-inning batting order rather than parallel lineups.
- **Line changes** (hockey/lacrosse) — within-period shift rotation, also a different feature.
