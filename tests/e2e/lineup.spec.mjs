import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, addPlayers, switchTab, selectAllPlayers, dumpStorage } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createTeam(page, 'Team A');
  await createSeason(page, { name: '2026' });
  await addPlayers(page, 10);
});

test('generate lineup with default 4 periods, verify period cards rendered', async ({ page }) => {
  await switchTab(page, 'Game Day');
  await selectAllPlayers(page);
  await page.locator('#generateBtn').click();

  // App auto-switches to the Lineup tab
  await expect(page.locator('#tab-lineup .period-card')).toHaveCount(4);
});

test('add a period mid-game, verify it appears as period 5', async ({ page }) => {
  await switchTab(page, 'Game Day');
  await selectAllPlayers(page);
  await page.locator('#generateBtn').click();

  await page.locator('.add-period-btn').click();

  await expect(page.locator('#tab-lineup .period-card')).toHaveCount(5);
});

test('remove a period with Rebalance After, verify tail regenerated', async ({ page }) => {
  await switchTab(page, 'Game Day');
  await selectAllPlayers(page);
  await page.locator('#generateBtn').click();

  // Snapshot period 4 (last) before removal
  const beforeSnapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith('_games'));
    const games = JSON.parse(localStorage.getItem(key));
    return JSON.stringify(games[0].periodAssignments[3]);
  });

  // Open the remove modal on period 2.
  // TODO(selectors): the remove/trash button on each period header is
  // rendered as part of the period-header HTML (see openRemovePeriodModal
  // in app.js). Inspect the markup to find the right class.
  await page.locator('#tab-lineup .period-card').nth(1).locator('button[title*="Remove" i], button[aria-label*="remove" i]').first().click();
  await page.getByRole('button', { name: /rebalance after/i }).click();

  await expect(page.locator('#tab-lineup .period-card')).toHaveCount(3);

  const afterSnapshot = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith('_games'));
    const games = JSON.parse(localStorage.getItem(key));
    return JSON.stringify(games[0].periodAssignments[2]);
  });
  expect(afterSnapshot).not.toBe(beforeSnapshot);
});

test('swap two players in a period, verify persistence across reload', async ({ page }) => {
  await switchTab(page, 'Game Day');
  await selectAllPlayers(page);
  await page.locator('#generateBtn').click();

  const before = await dumpStorage(page);
  const beforeGames = JSON.parse(before[Object.keys(before).find(k => k.endsWith('_games'))]);
  const beforePeriod0 = JSON.stringify(beforeGames[0].periodAssignments[0]);

  // Tap two players in period 1 to open the sub popup. The click target
  // that fires handleSwapTap is `.lineup-swap-target` (inside `.lineup-row`).
  const periodOne = page.locator('#tab-lineup .period-card').first();
  await periodOne.locator('.lineup-swap-target').nth(0).click();
  await periodOne.locator('.lineup-swap-target').nth(1).click();
  // Popup defaults to approx mode with "Swap" pre-selected; the main
  // button is labeled "Confirm" (class .sub-confirm-main).
  await page.locator('#subPopup .sub-confirm-main').click();

  await page.reload();

  const after = await dumpStorage(page);
  const afterGames = JSON.parse(after[Object.keys(after).find(k => k.endsWith('_games'))]);
  const afterPeriod0 = JSON.stringify(afterGames[0].periodAssignments[0]);
  expect(afterPeriod0).not.toBe(beforePeriod0);
});
