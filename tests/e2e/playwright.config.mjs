import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Rotation Manager PWA smoke suite.
 *
 * Runs against a local python http.server on port 8000. Playwright
 * starts the server automatically via `webServer` below — no manual
 * "start dev server first" dance.
 *
 * IMPORTANT: the app uses 127.0.0.1, not localhost, because Chrome
 * auto-redirects localhost to HTTPS (which breaks the plain-HTTP dev
 * server). Keep baseURL in sync with the README.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Each test starts with an isolated origin — localStorage is wiped
    // between tests via page.evaluate() in a beforeEach hook.
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use the system-installed Chrome instead of the Playwright-bundled
        // Chromium. Avoids the ~150MB download and sidesteps corporate
        // TLS interception (the bundled-browser CDN often hits self-signed
        // cert chain errors behind MitM proxies). Requires Chrome installed.
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'python -m http.server 8000 --bind 127.0.0.1',
    cwd: '../..',
    url: 'http://127.0.0.1:8000',
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
