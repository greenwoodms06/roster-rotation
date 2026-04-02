# Strategy Investigation: Alternative Rotation Modes

## Status: EXPLORED → DECLINED

Investigated whether the engine should support alternative rotation strategies (Starters+Subs, Platoon) alongside the existing Fair Rotation mode.

## What Was Explored

Three strategies were prototyped:
- **Fair Rotation** (existing) — equal playing time & position exposure
- **Starters + Subs** — top N players play most periods, subs get minimum time
- **Platoon** — two groups alternate periods (odd/even)

A working implementation was built and tested (128 assertions, all passing). Strategy was stored on season metadata and passed to the engine via constraints.

## Why It Was Declined

The existing constraint system already handles the realistic coaching scenarios:

| Coaching Intent | Existing Tool |
|---|---|
| "Alex plays the whole game" | Check only Alex + 6 others, or lock Alex to a position |
| "Starters play Q1" | Drag starters to top, enable starter mode toggle |
| "Keep players at same position" | Continuity = High |
| "Jordan never plays GK" | Position weight = Never (0) |
| "Sub Tyler in for 1 quarter" | Uncheck Tyler for first generate, check for second |
| "Two groups alternate" | Generate twice with different checked players |

The strategy abstraction added UI complexity (season-level selector, or per-game dropdown, or per-player time tiers) without meaningfully improving what a coach can already do with the current tools in ~2 extra taps.

## Key Insight

The real gap isn't a missing "strategy mode" — it's that **the coach's intent is always per-player and per-game**, which makes any fixed strategy pattern either too rigid (season-level) or too granular (per-player time tiers that duplicate what unchecking/reordering already does).

## If Revisited

If a concrete need arises (e.g., coaching an older competitive team with stable starter/sub roles across a season), the cleanest approach would be **Option B from the investigation**: per-player time tiers on Game Day (Full / Most / Half / Min), which maps directly to coaching intent without introducing a "strategy" abstraction. The engine's Phase 1 allocator is cleanly separated and ready for this if needed.
