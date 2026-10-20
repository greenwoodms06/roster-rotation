@~/.claude/plugins/marketplaces/soul-system/operations/CLAUDE.md

**Stage: released** (owner, 2026-10-20 · written by /soul-stage — re-run with a stage to change or refresh)
- Relied on from outside: the roster backup / import file formats — full backup
  and share-team JSON (`js/backup.js`, currently versions 3 and 4) — changing these
  is a deliberate, announced change.
- Rules:
  - People rely on this. The surfaces listed in this block are the public contract; changing any of them is a deliberate, announced change — never a side effect.
  - Deprecate, don't delete: keep the old way working with a warning, say when it goes away, and point at the new way.
  - Every change ships with tests and a changelog line; a change to a public surface also ships with upgrade instructions.
  - New behaviour is opt-in; existing behaviour stays as it is unless changing it is the point.
  - Fix the symptom when the structural fix is out of scope — and record the debt (`/soul-capture idea`) so it isn't lost.
- Next stage when: not known yet.
- Owner's additions: none.
- Propose `/soul-stage` if something outside this project starts relying on it,
  a release is cut, a rule above is about to be overridden, or you find yourself
  adding a deprecation path, alias or shim — one sentence, then wait; only the
  owner changes the stage.
The contract's rules and the completion gate apply unchanged.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roster Rotation Manager — a PWA for generating fair lineup rotations in youth sports. The PWA itself is pure vanilla HTML/CSS/JS — no bundler, no transpiler — deployed as a static site on GitHub Pages, with all data in localStorage. An additive Capacitor 5 wrap layer at the repo root produces an Android APK/AAB from the same JS sources (see "Native build" below); the PWA is unaffected by the wrap and stays the default development target.

## Development

**Local dev server:**
```bash
python -m http.server 8000
```
Open `http://127.0.0.1:8000` (not `localhost` — Chrome redirects localhost to HTTPS).

**Run unit tests:**
```bash
node tests/run_all.mjs
```
Tests run in Node using `vm.createContext` sandboxes with a localStorage mock. No browser needed. There is no single-test runner; edit `tests/run_all.mjs` to comment out suites if needed.

**Run Playwright smoke suite** (optional — covers end-to-end flows):
```bash
cd tests/e2e
npm install                         # first time only
npm test                            # uses system-installed Chrome (channel: 'chrome')
```
Playwright auto-starts `python -m http.server 8000` via its `webServer` config. The repo now has two `package.json` files: top-level (Capacitor wrap) and `tests/e2e/` (Playwright). Both keep `node_modules/` gitignored. See `tests/e2e/README.md` for the spec list and selector-tuning notes.

**Sync changes into the Android project** (only needed when producing a build):
```bash
npm run cap:sync                    # mirrors web assets into www/, then runs cap sync
```
This is `npm run build:www` (which regenerates `www/` from the project root via `scripts/build-www.mjs`) followed by `npx cap sync android`. After it completes, open `android/` in Android Studio for the actual build. The PWA workflow above does **not** need this step.

## Architecture

### Script load order (matters — no modules, all globals)
`index.html` loads scripts in this order via `<script>` tags. Files added during the Capacitor-prep split (utils, fairness, clock, game_notes, backup, season_view, modals) live alongside `app.js` as plain `<script>` tags — no bundler, no modules. They reference globals declared in `app.js` at runtime.

1. **platform.js** — `Platform.isNative()` / `Platform.isWeb()`. Runtime gate for features that must be hidden or behave differently on native (Capacitor WebView) vs. PWA. PWA is the default; native flips the flag. Store-sensitive UI (donate links, popup-window Print) is gated off on native.
2. **formations.js** — Sport definitions, position presets, field formation layouts. Single source of truth for `SPORTS`, `FORMATIONS`, `POSITION_PRESETS`. No dependencies.
3. **credit.js** — Fractional credit system utilities for sub tracking (v4 format with `timeIn`/`timeOut` fractions 0.0–1.0). Pure functions, no dependencies.
4. **storage_adapter.js** — Thin synchronous wrapper over `localStorage` (`StorageAdapter.get/set/remove/keys/clear`). Single seam to swap for Capacitor Preferences on native later.
5. **storage.js** — Persistence layer. Multi-team/multi-season data model. Keys prefixed `rot_`. Routes everything through `StorageAdapter`. No dependency on engine or UI. Re-slugifies team/season slugs at the `_importTeamData` / `importSharedTeam` seam (defense against tampered backups — slugs flow into inline `onclick=` attrs).
6. **engine.js** — `RotationEngine` class. Pure algorithm for generating fair lineups. Depends only on `DEFAULT_POSITIONS` from formations.js. Balances: equal game time → season fairness → position exposure → position preferences. Supports constraints (locks, continuity, positionMax, globalMaxPeriods, maxSubsPerBreak). Constraint precedence when conflicting: full staffing → globalMaxPeriods (hard) → equal time → fatigue/rest spread → maxSubsPerBreak (soft, relaxes) → globalMaxPeriods relaxes last resort. After Phase 2 scheduling two post-repair passes run: `_repairAllocation` fixes equal-time violations via in-period swaps, then `_reduceSubCapViolations` attempts cross-period 2-swaps to eliminate sub-cap violations — gated by a fatigue guard that allows at most +1 streak extension (max consec plays or sits) per swapped player. Forced-overflow holdovers prefer the lowest season-ratio player (rotates across games). When the user adds a period post-generation and everyone is at `globalMaxPeriods`, `app.js` prompts to raise the cap by 1 rather than throwing.
7. **utils.js** — `esc`, `downloadBlob`, `pulseInvalid`, `welcomeEmptyState`, `showToast`. Zero-dependency UI helpers. `esc()` is a 5-char HTML-entity escape (`& < > " '`) safe for both innerHTML bodies and HTML attribute values; for JS string literals embedded inside `onclick="..."`, use `esc(JSON.stringify(value))`.
8. **fairness.js** — Fairness color palette (colorblind-aware) + `gameFairnessSpread`. Calls `loadSettings()` at runtime.
9. **clock.js** — Game clock state (`clockStart/Stop/Reset/Toggle`), time/fraction conversions, `toggleTimeDisplay`. Reads/writes clock globals declared in `app.js`. Period-end alert (`playPeriodEndAlert`) fires when elapsed crosses the period duration while running and repeats every 3s until `clockStop`/`clockReset`/`clockAdvancePeriod` cancels it (or elapsed drops back below pd, e.g. period extended). Sound uses Web Audio (lazy `_alertAudioCtx`, two-tone 880/1320Hz), gated by the `endOfPeriodSound` setting.
10. **game_notes.js** — Notes/label inputs, scrimmage toggle, period-collapse toggle. Persists through `Storage.saveGame`.
11. **backup.js** — Full backup/restore + share-team + import-team. Uses `Storage` and `StorageAdapter`.
12. **season_view.js** — Season tab: overview, games list, players table, game picker, position color palette.
13. **modals.js** — Custom modal helpers (`showModal`, `closeCustomModal`, `showPromptModal`) + About / Help / Settings modal builders. `closeDynamicModal` lives in `app.js` (used widely).
14. **field.js** — Field tab: SVG rendering, drag-to-position, route/zone drawing, saved plays. Depends on formations.js, storage.js, and `app.js` globals.
15. **app.js** — Main UI controller. Owns global state (`ctx`, `roster`, `currentPlan`, clock vars, etc.), tab switching, lineup rendering, swap/sub UI, edit-roster, generate, constraint controls, init/boot. Functions are global and invoked via inline `onclick=` attributes — keeping `<script type="module">` off the table by design.

### Service Worker (sw.js)
Cache-first offline strategy, **web-only** (registration is skipped on native — see Native build below). `CACHE_NAME` version string (currently at `sw.js:1`) must be bumped **and** the matching `<div class="about-version">` in `index.html` edited — the two strings are deliberately kept in sync by hand. Bumping `CACHE_NAME` is what triggers the user-visible update flow. Does not `skipWaiting` automatically; the app prompts the user. Registration is gated via `Platform.isWeb() && !navigator.webdriver` — skipped inside Capacitor WebViews (iOS WKWebView has no SW support; Android WebView fails under `capacitor://`) and under Playwright/Selenium/Puppeteer (the first-install `clients.claim()` fires `controllerchange` → `window.location.reload()`, which races with `page.evaluate` and destroys the execution context mid-test). The `ASSETS` array must include every `js/*.js` file plus `index.html`, `css/styles.css`, `manifest.json`, icons, and the self-hosted fonts in `fonts/`.

### Native build (Capacitor 5 / Android)
**Layout.** Top-level `package.json` + `capacitor.config.json` + `.capacitorignore` + `scripts/build-www.mjs` + `assets/` (icon source PNGs/SVGs) + `patches/` (patch-package patches) + `android/` (generated Capacitor Gradle project). `node_modules/` and `www/` are gitignored.

**The www/ mirror.** Capacitor's `webDir` cannot be `.` (it would recurse into `android/` during `cap copy`). Instead, `scripts/build-www.mjs` mirrors the runtime files (`index.html`, `privacy.html`, `manifest.json`, `sw.js`, `css/`, `js/`, `icons/`, `fonts/`) into `www/`, and `capacitor.config.json` points `webDir` at `www`. `cap sync` then copies `www/` into `android/app/src/main/assets/public/`. The PWA root layout is unaffected — GitHub Pages still serves `index.html` from the repo root.

**Capacitor version pin.** Capacitor 5 (not 6). Capacitor 6 generates AGP 8.2.1 projects, which require Android Studio Hedgehog or newer. Flamingo (the local IDE) ships AGP 8.0, which matches Capacitor 5.7.x. Don't bump to v6 without bumping Android Studio first.

**Plugins installed** (all v5):
- `@capacitor/splash-screen` — bg `#0f1923`, ~500ms
- `@capacitor/status-bar` — style DARK (light icons on `#0f1923`)
- `@capacitor/share` + `@capacitor/filesystem` — power the Backup / Share-Team flows on native (see "Sharing" below)

**patch-package.** `patches/@capacitor+share+5.0.8.patch` carries two Android 14 fixes that were never backported from Capacitor 6 to v5: `registerReceiver` was missing the `RECEIVER_NOT_EXPORTED` flag, and `PendingIntent.getBroadcast` used `FLAG_MUTABLE` with an implicit intent. The `postinstall` hook in `package.json` reapplies the patch on every `npm install`. Don't `npm uninstall` `@capacitor/share` without removing the patch first.

**Sharing (native).** `js/backup.js` `shareOrDownload()` branches on `Platform.isNative()`: writes the JSON blob to the app's cache via `Filesystem.writeFile`, hands the URI to `Share.share`, which opens the Android chooser. The Web Share API path remains for PWA mobile, the `downloadBlob` path for desktop. The FileProvider in `AndroidManifest.xml` + `res/xml/file_paths.xml` already covers the cache dir, so no permission edits are needed.

**Printing (native).** `MainActivity.java` adds a `JavascriptInterface` named `AndroidPrint` exposing `print(html)`. It renders the HTML in an off-screen WebView and hands the resulting `PrintDocumentAdapter` to `PrintManager`. The default WebView silently no-ops on `window.print()`, which is why this bridge exists. The web path uses a hidden `<iframe srcdoc=...>` whose inline `<script>window.print()</script>` fires on load — no popup window dependency on either platform.

**Icons.** Source: `icons/icon.svg` (vector). Adaptive-icon foreground source: `assets/icon-foreground.svg` (loop only, scaled into the safe zone). Build pipeline: Inkscape (Windows side, called via `wslpath`) renders SVG → 1024×1024 PNG; ImageMagick downscales to per-density mipmaps. There is no scripted re-generation flow yet — re-running the icon work is manual. The adaptive-icon background is the `@color/ic_launcher_background` resource (`#0f1923`), not a drawable.

**Signing (release).** `android/keystore.properties` (gitignored) carries the `.jks` path and passwords; `keystore.properties.example` shows the schema. `android/app/build.gradle` reads it into a `signingConfigs.release` block applied to `buildTypes.release`. The keystore itself lives **outside the repo** at `D:/AndroidKeystores/rotations-release.jks` (Windows path; the build.gradle uses forward slashes which Gradle accepts on Windows). Lose the keystore = locked out of Play Store updates forever.

**Build outputs.**
- Debug APK (sideload to phone): `android/app/build/outputs/apk/debug/app-debug.apk` — *Build → Build APK(s)* with debug variant
- Release APK (signed, sideload): `android/app/build/outputs/apk/release/app-release.apk` — *Build APK(s)* with release variant
- Release AAB (Play Console upload): `android/app/build/outputs/bundle/release/app-release.aab` — *Build → Build Bundle(s)* with release variant

**Versioning.** `versionCode` (integer, in `android/app/build.gradle`) must be bumped for every Play upload — Play rejects re-uploads with the same code. `versionName` (cosmetic string) is separate and tracks the PWA's `<div class="about-version">` value loosely, but they don't have to match.

### Data Model
- **Teams/Seasons**: `rot_teams` → array of `{slug, name}`. Each team has `rot_{teamSlug}_seasons`.
- **Roster**: `rot_{teamSlug}_{seasonSlug}_roster` → `{players: {id: {name, number?, positionWeights}}, positions: []}`.
- **Games**: `rot_{teamSlug}_{seasonSlug}_games` → array of game plans with v4 period assignments (`{position: [{pid, timeIn, timeOut}]}`).
- **Plays**: `rot_{teamSlug}_{seasonSlug}_plays` → saved field diagrams.

### Test Harness
Unit tests use a custom minimal framework in `tests/helpers.mjs` — provides `suite()`, `assert()`, `assertEqual()`, `assertThrows()`, `assertApprox()`. The `createContext()` helper loads JS files into a Node VM sandbox in dependency order. App.js tests require `{withApp: true}` which adds DOM stubs + `matchMedia`, `visualViewport`, `setInterval`, `clearInterval` stubs on the sandboxed `window`. All six suites (`engine`, `formations`, `storage`, `credit`, `swap`, `app_logic`) run green.

E2E tests live in `tests/e2e/` and run Playwright against `python -m http.server 8000` using the system Chrome (`channel: 'chrome'` — avoids the ~150MB bundled-Chromium download that breaks behind corporate TLS interception). Selector patterns documented in `tests/e2e/README.md`; key gotchas: context picker buttons are literal `+ New`, player weight field is `positionWeights` (not `weights`), stepper buttons use `aria-label="Decrease"/"Increase"`, saveSeason() seeds a default roster of `positions.length + 3` players.

### Fonts
`fonts/dm-sans-latin.woff2` and `fonts/jetbrains-mono-latin.woff2` are self-hosted variable-font (`font-weight: 100 900`) latin subsets. Declared via `@font-face` at the top of `css/styles.css`. **No runtime network fetch** — the app is fully offline-capable on first run and makes no third-party calls (Play Store privacy disclosure = "none").

### Design docs
`docs/` holds load-bearing context that isn't obvious from the code: `ROADMAP.md`, `DESIGN_DECISIONS.md`, `DETAILS.md`, and three `SESSION_PROMPT_*.md` files covering the Capacitor prep split (why files moved out of `app.js`), the flexible-formats work, and the Capacitor wrap (Android Studio version pinning, plugin choices, share/print native paths, signing). Check these before large architectural changes.

## Key Conventions

- No external **runtime** dependencies in the PWA layer — everything is vanilla JS/CSS/HTML. The Capacitor wrap pulls in npm packages but they only ship inside the Android APK, never the GitHub Pages PWA.
- All state is global variables in app.js; no framework, no state management library.
- Functions are globally scoped and called via `onclick` attributes in HTML.
- The rotation engine is intentionally pure — no DOM, no storage access.
- `sw.js` ASSETS array must list every file the app needs offline.
- User-entered strings (position names, team/season names, game labels, player names, notes) must be `esc()`-wrapped anywhere they flow into `innerHTML` or HTML attributes. For values embedded inside `onclick="..."` JS strings, use `esc(JSON.stringify(value))`.
- Line endings: LF. `.gitattributes` enforces this — do not let an editor convert files to CRLF.
- When editing files that ship in the WebView bundle (anything mirrored by `scripts/build-www.mjs`), run `npm run cap:sync` before rebuilding the Android app — otherwise the WebView serves stale assets even after a Gradle rebuild.
- Native code (`MainActivity.java`, anything under `android/app/src/main/`) and root JS files (`js/*.js`, `index.html`, `sw.js`) are the **only** places where platform-specific changes belong. Don't add Capacitor checks deep inside engine.js or storage.js — keep `Platform.isNative()` gating at UI boundaries and the `shareOrDownload`/`printLineup` seams.
