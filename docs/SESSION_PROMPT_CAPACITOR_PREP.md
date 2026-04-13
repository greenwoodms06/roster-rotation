# Session Prompt: Capacitor Prep — Restructure & Hardening

> **Status: completed.** Outcomes captured in `CLAUDE.md` (script load order, SW gating, Playwright usage) and `docs/DESIGN_DECISIONS.md` (File Organization, Storage Adapter Seam). `app.js` went from 5,705 → 4,067 LoC via 7 feature-split files. Playwright smoke suite in `tests/e2e/` at 13/13 green. One real bug caught during scaffolding: `backup.js` rejected v4 backup files on restore; fixed. `CACHE_NAME` at `rotation-v3.30`. Retained here as historical context for the decisions made.

## Goal

Prepare this vanilla-JS PWA to be wrapped with Capacitor for Google Play + App Store distribution, without abandoning the zero-build, zero-npm, zero-bundler ethos. The PWA must keep working standalone on GitHub Pages after these changes.

This prompt is the output of a research pass covering both Capacitor best practices and a structural survey of our code. See the "Why these choices" notes throughout for the research-backed reasoning.

## Non-goals

- **No framework migration.** We are not adopting React, Vue, Svelte, Lit, or any component model. We are staying vanilla.
- **No bundler.** No Vite, no esbuild, no Rollup. Scripts continue to load via `<script>` tags in a fixed order.
- **No ES-module migration yet.** `<script type="module">` breaks our ~134 inline `onclick=` handlers. That refactor is a separate, later session if we ever do it.
- **No event-delegation refactor yet.** Same reason. Inline handlers stay.
- **No Capacitor wrapping in this session.** This session only *prepares*. Wrapping itself is the next session.
- **No formation / engine / algorithm changes.**

## Current state (baseline)

- `js/app.js` — 5,705 LoC, dominates the codebase. Well-sectioned with comment banners but monolithic.
- `js/field.js` — 1,617 LoC, tightly coupled to `app.js` via ~14 shared mutable globals.
- `js/formations.js`, `js/credit.js`, `js/storage.js`, `js/engine.js` — clean, well-tested, minimal cross-coupling.
- ~134 inline `onclick=` handlers across `index.html` and dynamically-generated HTML strings in `app.js`.
- Service worker is cache-first with manual update prompt; `ASSETS` array in `sw.js` is current.
- Tests: strong coverage on `engine.js`, `credit.js`, `storage.js`, `formations.js`. Minimal for `app.js`. Zero for `field.js`.

## Scope — ordered by risk, low → high

### Phase 1: Capacitor-safe hygiene (no structural changes)

Goal: make the PWA work correctly under a Capacitor WebView *without* refactoring anything. These are all single-file, low-risk edits.

#### 1a. Gate service worker registration on non-native

Capacitor's iOS WKWebView has no service-worker support ([WebKit 206741](https://bugs.webkit.org/show_bug.cgi?id=206741)); Android WebView registration fails under the `capacitor://` scheme ([capacitor#7069](https://github.com/ionic-team/capacitor/issues/7069)). On native the app ships bundled so offline is automatic — no SW needed.

- Wrap the existing `navigator.serviceWorker.register(...)` call in `if (!window.Capacitor?.isNativePlatform())`.
- The update-detection banner only runs on the web build. That's correct — native updates ship through the store.
- Verify the PWA still shows the update banner after a `CACHE_NAME` bump.

#### 1b. Viewport-fit=cover + safe-area insets

iOS notch / home-indicator handling requires this at the viewport meta level, then CSS `env(safe-area-inset-*)` padding on top-level containers ([safe-area-inset docs](https://capacitorjs.com/docs/apis/status-bar)).

- Update `<meta name="viewport">` in `index.html` to include `viewport-fit=cover`.
- Add top/bottom padding on the main app container in `css/styles.css`:
  - `padding-top: env(safe-area-inset-top)` on the header
  - `padding-bottom: env(safe-area-inset-bottom)` on the nav bar
- Verify: PWA still looks correct (these are no-ops on desktop Chrome), iOS Safari "Add to Home Screen" mode renders with correct insets.

#### 1c. Storage adapter seam

We don't swap localStorage → Preferences in this session, but we introduce a thin wrapper so that swap is a one-file change later. Capacitor's Preferences plugin falls back to localStorage on web, so the adapter works identically in both environments.

- Create `js/storage_adapter.js` with `StorageAdapter.get(key)`, `.set(key, value)`, `.remove(key)`, `.keys()`, `.clear()`. Synchronous API backed by localStorage.
- Replace all direct `localStorage.getItem/setItem/removeItem/clear/key(i)` calls in `storage.js` with `StorageAdapter.*` calls. This is a mechanical find-and-replace.
- `app.js` has a few direct localStorage calls (settings, hints) — also route through the adapter.
- Load order: `storage_adapter.js` before `storage.js` in `index.html` and `sw.js` ASSETS.
- Tests: update the test harness localStorage mock to also expose `StorageAdapter`. Existing tests should continue to pass unchanged.

**Why synchronous API:** Preferences is async on native, but we only need the *shape* to be swappable, not the async-ness today. When we later adopt Preferences on native, we'll add an async variant and migrate hot paths selectively. The adapter's current synchronous surface is intentional — preserves existing code structure.

#### 1d. Backup-on-launch reminder

Capacitor 5→6 had a known bug that wiped localStorage/IndexedDB ([capacitor#7548](https://github.com/ionic-team/capacitor/issues/7548)). Our existing "amber dot on Back Up menu item" already addresses this well. No new work — just validate the flow still works.

- Walk the backup/restore flow manually. Confirm the dirty-data indicator behaves as documented.
- No code changes unless a regression is found.

### Phase 2: Split app.js (lateral, low risk)

Goal: break `app.js` into feature-sized files while keeping **globals global** and **inline `onclick` inline**. Nothing changes about how the code runs — only where functions live.

This is the biggest change in this session and the research says it's worth doing before wrapping because debugging a 5.7k-line file inside a WebView Inspector is miserable.

**Rule:** split by feature (a full tab's worth of concern), not by layer. Keep globals as globals — all extracted files are `<script>` tags loaded in dependency order, not modules.

**Candidate splits (extract these in order, one per commit so each is reviewable):**

1. **`js/utils.js`** (~31 LoC) — `esc()`, `downloadBlob()`, `pulseInvalid()`, `welcomeEmptyState()`, `showToast()`. Zero coupling. Trivial first split, validates the flow.
2. **`js/fairness.js`** (~141 LoC) — fairness-color palette, goal-tracking helpers, fairness spread math. Pure math, no DOM. Should also absorb anything in `credit.js` that's specifically season-level (though `credit.js` as-is is fine — don't disturb it unless cleanly merges).
3. **`js/clock.js`** (~100 LoC) — clock state + start/pause/reset + period duration UI. Self-contained module of UI logic. Reads `currentPlan` / `ctx` globals (fine).
4. **`js/game_notes.js`** (~65 LoC) — notes modal + save-on-keystroke. Near-zero coupling.
5. **`js/backup.js`** (~269 LoC) — full backup/restore + share-team + import-team. Routes through `Storage` and the new `StorageAdapter`. Already a well-defined unit.
6. **`js/season_view.js`** (~416 LoC) — season tab: fairness charts, per-game history, W-L-D, availability dots. Reads `ctx` / games / `seasonStats` globals.
7. **`js/modals.js`** (~554 LoC) — About, Help, Settings modal builders + `showModal` / `closeCustomModal`. Bulky but coherent.

**Deliberately not extracted this session** (too coupled, not worth the risk without tests):
- Lineup display (287 LoC)
- Edit Roster / Late Arrival (408 LoC)
- Swap + sub popup (several hundred LoC)
- Constraint controls (139 LoC — small but mutates many globals)
- Field tab (keep `field.js` as-is; that decoupling is a separate future session)

**After each extraction:**
- Update `index.html` `<script>` tag order (new file before `app.js`, after its dependencies).
- Update `sw.js` `ASSETS` array.
- Bump `CACHE_NAME`.
- Run `node tests/run_all.mjs` — engine/credit/storage/formations suites must still pass at 1,072+ assertions. The two pre-existing `window.matchMedia` crashes in swap/app-logic tests are expected.
- Smoke-test the extracted feature manually in the browser before moving to the next split.

### Phase 3: Playwright smoke suite (new testing layer)

Before we wrap with Capacitor, get a 10-ish-test smoke suite running against the PWA locally. This is the cheapest automation investment with the biggest payoff — catches 90% of regressions and works bundler-free.

**Scope:**
- Install Playwright as a dev-only CLI (not a runtime dependency — use `npx playwright install`, no `package.json` commitment). The project stays no-npm at runtime.
- Add `tests/e2e/` folder with ~10 tests:
  - Create team + season, create a season with a non-default player count
  - Add 10 players with position preferences
  - Set constraints, generate lineup, verify 4 periods
  - Add a period mid-game, verify it appears
  - Remove a period with Rebalance After, verify tail regenerated
  - Swap two players in a period, verify persistence across reload
  - Add a late-arrival player, verify rebalance
  - Back up, clear data, restore, verify all teams present
  - Create a custom-sport season with 6 players, verify auto-layout
  - Toggle theme / colorblind mode, reload, verify persisted
- Runner: `node tests/e2e/run.mjs` or `npx playwright test`. Document in CLAUDE.md.
- CI: optional — if GitHub Actions is added, run both `tests/run_all.mjs` and the Playwright suite. Not blocking for this session.

**Why Playwright, not Puppeteer / Cypress:** Playwright runs headless Chromium against our localhost PWA, which is exactly what Capacitor will wrap. Catches WebView-relevant regressions. Puppeteer is Chromium-only and less polished for e2e; Cypress requires more setup and isn't bundler-free.

### Phase 4: Document + update CLAUDE.md

- Update `CLAUDE.md` "Script load order" section to include the new files in dependency order.
- Add a "Running Playwright tests" subsection to the Development section.
- Note the Capacitor-gating of the service worker in the Service Worker section.
- Update `docs/DESIGN_DECISIONS.md` with a new "File Organization (post-Capacitor-prep)" section briefly explaining the feature-split rationale and the "keep globals, keep inline onclick" decision.

## Explicit anti-patterns to avoid

From research:
- **Don't convert to `<script type="module">`.** Breaks inline `onclick`. Requires event-delegation refactor that isn't in scope.
- **Don't hard-code `http(s)://` origins or `location.origin` checks** — under Capacitor, assets serve from `capacitor://localhost` / `https://localhost`.
- **Don't use cookies for state.** WKWebView cookie handling is inconsistent. We already don't — keep it that way.
- **Don't use `<iframe>` for app UI.** Navigation and safe-area both misbehave. We don't — keep it that way.
- **Don't invent a components/ or src/ folder.** We have no component model; flat two-level `js/` is the right shape.

## Testing checklist before shipping the session

- [ ] `node tests/run_all.mjs` passes (1,072+ assertions, only pre-existing matchMedia crashes allowed)
- [ ] `npx playwright test` passes on local Chromium
- [ ] Manual browser walkthrough: create team, add players, generate lineup, swap, backup, restore, settings round-trip
- [ ] Lighthouse PWA audit still passes (installability, offline, manifest)
- [ ] `sw.js` ASSETS array matches actual `js/` directory
- [ ] Service worker registers under plain web context, doesn't attempt to register under Capacitor (simulate by checking the gate)
- [ ] `viewport-fit=cover` verified; no visual regressions in PWA mode on iOS Safari and desktop Chrome

## Out of scope (future sessions)

- **Capacitor wrapping itself.** After this session, a separate session wraps the app: `npm install @capacitor/core @capacitor/cli`, `npx cap init`, add Android + iOS platforms, adopt the Preferences plugin via the adapter seam, configure safe areas, set up signing, submit to stores.
- **Live Updates (OTA web-asset updates).** Defer until we feel pain from store-only releases.
- **Event delegation + module conversion.** Large refactor, not required for Capacitor. Revisit only if the inline-handler count becomes a real maintenance burden.
- **Field.js decoupling.** The ~14 shared mutable globals between `field.js` and `app.js` are a real smell but not a blocker. Tackle after wrapping if `field.js` needs major changes.
- **Extracting lineup / late-arrival / swap UI** from `app.js`. These are the tangled parts. Extract later after Playwright gives us safety nets.

## References (from research pass)

- [Capacitor Web docs](https://capacitorjs.com/docs/web) — `webDir` expectations
- [Capacitor PWA docs](https://capacitorjs.com/docs/web/progressive-web-apps) — service worker on native
- [Capacitor Preferences plugin](https://capacitorjs.com/docs/apis/preferences) — storage on native, fallback to localStorage on web
- [Capacitor Filesystem plugin](https://capacitorjs.com/docs/apis/filesystem) — file-based backup/restore
- [WebKit service worker bug (206741)](https://bugs.webkit.org/show_bug.cgi?id=206741) — iOS WKWebView has no SW
- [capacitor#7069](https://github.com/ionic-team/capacitor/issues/7069) — Android WebView SW registration under `capacitor://`
- [capacitor#7548](https://github.com/ionic-team/capacitor/issues/7548) — localStorage wipe on v5→v6 (motivates adapter seam + backup discipline)
- [safe-area-inset guide (capacitor-community/safe-area #23)](https://github.com/capacitor-community/safe-area/issues/23) — viewport-fit=cover + env(safe-area-inset-*)
- [Playwright](https://playwright.dev/) — e2e layer
- [MDN: JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) — why inline `onclick` breaks with modules

## Recommended execution pace

One commit per sub-phase (1a, 1b, 1c, 1d each as separate commits; each Phase 2 split as its own commit; Phase 3 as 2–3 commits). Don't batch. Each commit should leave the app working and tests passing. Estimated total: 8–12 focused commits, 1–2 sessions depending on pace.
