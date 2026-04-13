# Playwright smoke suite

Runs against the PWA served from `python -m http.server 8000`. Playwright
starts the server automatically via `webServer` in the config — no
separate "start dev server first" step.

## First-time setup

```bash
cd tests/e2e
npm install
```

The config uses `channel: 'chrome'`, so Playwright drives the system-
installed Chrome instead of downloading its own Chromium. No browser
binary download is needed — this also sidesteps corporate TLS
interception that breaks the Playwright CDN.

If Chrome isn't installed, either install it or switch the config back to
the bundled Chromium and run `npx playwright install chromium`. If the
download hits a self-signed-cert error behind a corporate proxy, set
`NODE_EXTRA_CA_CERTS=/path/to/corp-ca-bundle.pem` before running it.

`node_modules/` and `package-lock.json` are gitignored. The root project
stays no-npm; only this folder has a `package.json`, and it's dev-only.

## Running

```bash
npm test                 # headless, all specs
npm run test:headed      # watch the browser
npm run test:ui          # Playwright's interactive UI mode (best for debugging)
npx playwright test roster.spec.mjs     # single file
npx playwright show-report              # after a failing run
```

## Specs

| File | Covers |
|---|---|
| `setup.spec.mjs` | Create team, default season, non-default player count, custom sport |
| `roster.spec.mjs` | Add 10 players, set a position-weight preference |
| `lineup.spec.mjs` | Generate, add period, remove period with rebalance-after, swap + reload |
| `edit_roster.spec.mjs` | Late-arrival add + rebalance |
| `backup.spec.mjs` | Backup → clear → restore round-trip |
| `settings.spec.mjs` | Theme + colorblind persistence across reload |
| `constraints.spec.mjs` | Global max periods honored by the engine |

## Status

All 13 specs pass against the current app. When adding new tests or the
UI changes, use `npm run test:ui` (Playwright's interactive UI mode) for
the fastest feedback loop — it lets you hover-to-inspect the actual
rendered DOM and copy working selectors.

When you fix or find a good selector, consider promoting it to a named
locator in `helpers.mjs` so other specs benefit.

## Bug caught on first run

The initial round-trip backup test caught a real bug: `backup.js`
validated `data.version !== 3` and rejected v4 backup files on restore,
even though `Storage.importBackup` already supported both v3 and v4.
Since `Storage.exportAll()` writes `version: 4`, every backup created by
the current app was unrestorable. Fixed during scaffolding.

## Gotchas discovered on first run

- **"New Team" is actually "+ New"** — the context picker uses `.ctx-chip.add-new` buttons with literal text `+ New` in both the Team and Season sections. The helper scopes by "first" (Team) vs "last" (Season).
- **`saveSeason()` auto-seeds a default roster** of `positions.length + 3` generic players. The `createSeason` helper wipes these by default (`clearDefaultRoster: true`) so roster tests start from zero. Pass `clearDefaultRoster: false` when you want to assert on the default seeding.
- **Player weight key is `positionWeights`, not `weights`.**
- **Stepper buttons** use `aria-label="Decrease"` / `"Increase"` (see `renderStepperHtml` in `app.js`).

## Isolation

Each test calls `resetApp(page)` in `beforeEach`, which wipes
localStorage and reloads. Tests run serially (`workers: 1`) because
they share the same origin and localStorage bleeds across parallel
workers otherwise. Not a perf win, but keeps a smoke suite honest.
