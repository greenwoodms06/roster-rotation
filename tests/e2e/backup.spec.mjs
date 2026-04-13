import { test, expect } from '@playwright/test';
import { resetApp, createTeam, createSeason, addPlayers } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('backup, clear data, restore, verify teams present', async ({ page }) => {
  // Seed data
  await createTeam(page, 'Team A');
  await createSeason(page, { name: 'S1' });
  await addPlayers(page, 5);

  // Back up via the ⋮ menu; Playwright catches the `<a>.click()` download.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('.header-menu-btn').click();
  await page.getByRole('button', { name: /back up/i }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import('fs/promises');
  const backupJson = await fs.readFile(path, 'utf8');
  expect(backupJson).toContain('"version"');

  // Clear all data
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#contextLabel')).toHaveText(/no team/i);

  // Restore. The Restore menu item triggers `fileImportInput.click()`,
  // which in Chromium opens a file chooser — intercept it via
  // page.waitForEvent('filechooser') so we can supply the backup file.
  await page.locator('.header-menu-btn').click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /restore/i }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupJson),
  });

  // Confirm the destructive "Replace" modal (showModal with confirmLabel='Replace')
  await page.locator('#customModalConfirm').click();

  const storage = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
  const teams = JSON.parse(storage.rot_teams || '[]');
  expect(teams.some(t => t.name === 'Team A')).toBe(true);
});
