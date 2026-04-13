import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, addPlayer, addPlayers, dumpStorage } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createTeam(page, 'Team A');
  await createSeason(page, { name: '2026' });
});

test('add 10 players, verify roster size + persistence', async ({ page }) => {
  await addPlayers(page, 10);

  // Roster list should render 10 rows
  await expect(page.locator('#rosterList > li')).toHaveCount(10);

  const storage = await dumpStorage(page);
  const rosterKey = Object.keys(storage).find(k => k.endsWith('_roster'));
  const roster = JSON.parse(storage[rosterKey]);
  expect(Object.keys(roster.players)).toHaveLength(10);
});

test('set position preference on a player, verify weight persisted', async ({ page }) => {
  await addPlayer(page, { name: 'Alex', number: 7 });

  // Open the player modal by tapping the row
  await page.locator('#rosterList li').first().click();
  await page.locator('#playerModal').waitFor({ state: 'visible' });

  // Tap the first weight cell once to cycle Normal → Prefer.
  await page.locator('#weightGrid .weight-item').first().click();
  await page.locator('#playerModal button[onclick="savePlayer()"]').click();
  await page.locator('#playerModal').waitFor({ state: 'hidden' });

  const storage = await dumpStorage(page);
  const rosterKey = Object.keys(storage).find(k => k.endsWith('_roster'));
  const roster = JSON.parse(storage[rosterKey]);
  const player = Object.values(roster.players)[0];
  // Any non-default weight (1) means the cycle fired. Key is `positionWeights`.
  const weights = Object.values(player.positionWeights || {});
  expect(weights.some(w => w !== 1)).toBe(true);
});
