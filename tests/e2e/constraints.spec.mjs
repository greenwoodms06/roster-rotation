import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, addPlayers, switchTab } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createTeam(page, 'Team A');
  await createSeason(page, { name: '2026' });
  await addPlayers(page, 10);
});

test('set a global-max-periods constraint, generate, verify no player exceeds it', async ({ page }) => {
  await switchTab(page, 'Game Day');
  await page.getByRole('button', { name: /^all\s*→$/i }).click();

  // Expand constraints panel
  await page.locator('#constraintToggle').click();

  // Bump globalMaxPeriods stepper up to 3.
  // TODO(selectors): stepper buttons are rendered dynamically inside
  // #constraintControls. Inspect on first run — likely buttons with
  // data-action="globalMax+" or similar.
  const bumpPlus = page.locator('#constraintControls button').filter({ hasText: /\+/ }).first();
  await bumpPlus.click();
  await bumpPlus.click();
  await bumpPlus.click();

  await page.locator('#generateBtn').click();

  // Verify no player is assigned to more than 3 periods
  const periodsPerPlayer = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith('_games'));
    const games = JSON.parse(localStorage.getItem(key));
    const plan = games[0];
    const counts = {};
    for (const pa of plan.periodAssignments) {
      const seen = new Set();
      for (const val of Object.values(pa.assignments)) {
        const occupants = Array.isArray(val) ? val : [{ pid: val }];
        for (const entry of occupants) seen.add(entry.pid);
      }
      for (const pid of seen) counts[pid] = (counts[pid] || 0) + 1;
    }
    return counts;
  });

  for (const [pid, n] of Object.entries(periodsPerPlayer)) {
    expect(n, `player ${pid} plays ${n} periods (max 3)`).toBeLessThanOrEqual(3);
  }
});
