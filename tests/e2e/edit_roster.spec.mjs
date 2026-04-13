import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, addPlayers, addPlayer, switchTab, selectAllPlayers } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
  await createTeam(page, 'Team A');
  await createSeason(page, { name: '2026' });
  // Add 10 players + 1 reserve. Only the first 10 go into the game;
  // the 11th ("Reserve") is the late-arrival candidate.
  await addPlayers(page, 10);
  await addPlayer(page, { name: 'Reserve', number: 11 });
  await switchTab(page, 'Game Day');
  // Select only the first 10 (not Reserve). Easiest: click All, then
  // click the Reserve row to deselect.
  await selectAllPlayers(page);
  // Deselect Reserve via its × button (aria-label="Remove Reserve #11")
  await page.locator('button[aria-label^="Remove Reserve"]').click();
  await page.locator('#generateBtn').click();
});

test('add late-arrival player via Edit Lineup, verify storage updates', async ({ page }) => {
  // Edit Lineup button lives in the lineup header (class btn btn-sm btn-outline)
  await page.getByRole('button', { name: /edit lineup/i }).click();
  const modal = page.locator('#editRosterModal');
  await modal.waitFor({ state: 'visible' });

  // Default tab is Add — dropdown #editAddPlayer is pre-filled with Reserve
  // (the only roster player not in the game). Confirm.
  await modal.locator('#editAddPlayer').waitFor();
  await modal.getByRole('button', { name: /add.*rebalance/i }).click();
  await modal.waitFor({ state: 'hidden' });

  // Verify Reserve is now in availablePlayers
  const availablePlayers = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(k => k.endsWith('_games'));
    const games = JSON.parse(localStorage.getItem(key));
    return games[0].availablePlayers;
  });
  expect(availablePlayers.length).toBe(11);
});
