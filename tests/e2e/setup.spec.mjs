import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, dumpStorage } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('create team + default season, verify persistence in localStorage', async ({ page }) => {
  await createTeam(page, 'U10 Lightning');
  await createSeason(page, { name: 'Spring 2026', clearDefaultRoster: false });

  await expect(page.locator('#contextLabel')).not.toHaveText(/no team/i);

  const storage = await dumpStorage(page);
  expect(storage.rot_teams).toBeTruthy();
  expect(JSON.parse(storage.rot_teams)).toHaveLength(1);
  expect(storage.rot_context).toBeTruthy();

  // saveSeason seeds a default roster of (positions.length + 3) = 10 players
  const rosterKey = Object.keys(storage).find(k => k.endsWith('_roster'));
  const roster = JSON.parse(storage[rosterKey]);
  expect(roster.positions.length).toBe(7);
  expect(Object.keys(roster.players).length).toBe(10);
});

test('create season with non-default player count (6v6)', async ({ page }) => {
  await createTeam(page, 'U8 Sharks');

  const seasonModal = page.locator('#seasonModal');
  await expect(seasonModal).toBeVisible();

  // Step player count down from 7 to 6. Stepper buttons are aria-labeled
  // "Decrease" / "Increase" (see renderStepperHtml).
  await page.locator('#seasonCountStepper button[aria-label="Decrease"]').click();

  await page.locator('#seasonNameInput').fill('Spring 6v6');
  await seasonModal.getByRole('button', { name: /create season/i }).click();
  await seasonModal.waitFor({ state: 'hidden' });

  const storage = await dumpStorage(page);
  const rosterKey = Object.keys(storage).find(k => k.endsWith('_roster'));
  const roster = JSON.parse(storage[rosterKey]);
  expect(roster.positions.length).toBe(6);
});

test('create custom-sport season, sport=custom in saved season', async ({ page }) => {
  await createTeam(page, 'Lacrosse Team');

  const seasonModal = page.locator('#seasonModal');
  await page.locator('#sportSelect').selectOption('custom');
  await page.locator('#seasonNameInput').fill('Custom 6p');
  await seasonModal.getByRole('button', { name: /create season/i }).click();
  await seasonModal.waitFor({ state: 'hidden' });

  const storage = await dumpStorage(page);
  const seasonsKey = Object.keys(storage).find(k => k.endsWith('_seasons'));
  const seasons = JSON.parse(storage[seasonsKey]);
  expect(seasons[0].sport).toBe('custom');
});
