# Idea: AI/LLM-Assisted Setup

**Status:** Tabled. Not implemented. Parked for future exploration.

**Date:** 2026-04-13

## Problem

First-time setup is the tallest friction wall in the app. A coach downloads the PWA, then has to:

- Create a team, name a season, pick a sport and player count
- Enter 12–18 players by hand (name + jersey number each)
- Optionally set position weights per player

For a coach whose roster already lives in a league email, a team spreadsheet, or a text message chain, re-typing it into the app is the main obstacle between "I installed this" and "I used it for my first game."

## Core idea

Leverage whatever LLM the coach already has (ChatGPT, Claude, Gemini, whichever) **without building a backend or API integration**. Ship copyable prompts. The LLM does the tedious parsing/restructuring. The coach imports the result.

No auth, no billing, no per-user costs, works with any provider the coach prefers.

## The brittle version (avoid)

Prompt the LLM to output our full `rot_backup_v3.json` directly. User imports via Restore.

**Why it's brittle:** LLMs drift on JSON. They rename fields (`jerseyNumber` vs `num`), add markdown wrappers, include commentary, miscase enums. Every drift = failed import = coach debugging JSON in an LLM chat. High friction for the exact users this feature is meant to help.

## The robust version

### 1. Human-readable intermediate format

The LLM outputs a format *we own*, not our internal backup JSON. Something like:

```
TEAM: U10 Wildcats
SEASON: Spring 2026
SPORT: soccer
PLAYERS_PER_SIDE: 7

PLAYERS:
- Alex Chen (#7) — prefers GK, never ST
- Blake Ng (#12) — prefers CM
- Casey Park (#3) — fast, prefers any attacking
- …
```

The prompt tells the LLM exactly this shape. We write a parser in the app that reads this and builds the backup. **Our format, our rules** — if the LLM drifts we can fix the parser without breaking users' existing workflows.

### 2. "Paste from AI" importer in the app

New UI affordance (roster tab + context picker): opens a textarea, user pastes the LLM output, the app parses and shows a preview card before committing. Same safety-net pattern as the Restore flow.

## Where an LLM earns its keep

Not the team name or the sport — those are single taps. The actual tedious parts:

1. **Roster entry.** Converting "here's the team text the league coordinator sent" into structured player records with numbers and preferences. Highest-value use case by far.
2. **Position weight translation.** Coach describes a player in natural language ("Alex is fast and always wants to be forward"), LLM translates to `ST: prefer, GK: never`.
3. **Importing from existing data.** Roster email, spreadsheet paste, even a photo of a team roster (coach does their own OCR in ChatGPT, pastes the text result).

The single-highest-value prompt is **"convert this text into a roster"** — much smaller ask of the LLM than "generate a full backup."

## Delivery mechanisms

Two reasonable options, probably both:

- **Docs on disk** (`docs/AI_SETUP_PROMPTS.md` — not yet written): copyable prompts the coach drops into any LLM. Linked from the About modal and README. Zero app code needed to ship.
- **In-app copy buttons**: settings or first-run screen with a "Set up team with AI" flow. A modal with the prompt pre-written, a copy button, instructions to paste into their LLM, then a paste-field to take the result back. One-screen loop.

## Phased plan

### Phase 1 — prompt docs (no app changes)

Ship `docs/AI_SETUP_PROMPTS.md` with 2–3 well-structured prompts:

- "Build a roster from free text"
- "Build a roster from a spreadsheet paste"
- "Build a full team setup conversation"

Each outputs the human-readable intermediate format. Even without a parser, coaches can read the output and manually transcribe. Validates the concept with near-zero investment.

### Phase 2 — parser + "Paste from AI" importer

Build the parser. Add the import button on the roster tab and context picker. Real productivity win — this is when AI-assisted setup becomes genuinely faster than manual entry.

### Phase 3 — in-app wizard

If demand is there: a dedicated first-run flow with copy buttons and guided paste-back. Surfaces the feature to coaches who wouldn't think to look at docs.

## Open design questions (when this is picked up)

1. **Target user** — first-timers setting up for the first time, or existing coaches adding a new season? Changes the prompt structure (first-timers need more scaffolding; returning coaches want quick-add).
2. **Format design** — totally different from our backup JSON (safer, more parser work) or a forgiving superset of our shape (less work, more drift risk)? The writeup above argues for "our own format," but the tradeoff is real.
3. **Discoverability** — docs-only (low surface area, discoverable only by motivated users) or surfaced in About / first-run welcome (higher discoverability, more app real estate)?
4. **Photo / spreadsheet pipeline** — how far do we go? "Paste this photo into ChatGPT, then paste the result here" is a fine two-step UX but depends on the coach being comfortable with their LLM.

## Things to avoid painting into a corner

- Don't couple import format parsing to the internal backup JSON shape too tightly — the intermediate format is its own concern and should tolerate our backup shape evolving.
- Don't promise specific LLM provider behavior — the prompts should be provider-agnostic and written defensively (e.g., "respond in this exact block format, no other text, no markdown wrappers").
- The feature should degrade gracefully: if the LLM response is unparseable, show the coach exactly which line failed so they can fix it in their LLM chat and try again.

## Non-goals

- Building an integrated AI assistant inside the app (backend, billing, latency, cost all work against the PWA's zero-infrastructure ethos)
- Generating full game plans via LLM — the rotation engine is deterministic and fair; an LLM would do worse and we'd lose the audit trail
