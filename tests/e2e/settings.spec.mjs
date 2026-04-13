import { test, expect } from '@playwright/test';
import { resetApp } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await resetApp(page);
});

test('toggle theme + colorblind, verify persistence across reload', async ({ page }) => {
  // Open Settings via ⋮ menu
  await page.locator('.header-menu-btn').click();
  await page.getByRole('button', { name: /settings/i }).click();

  // Click the "Light" theme option.
  // TODO(selectors): theme buttons live inside the settings modal —
  // likely `.theme-option[data-theme="light"]`. Inspect on first run.
  await page.getByRole('button', { name: /^light$/i }).click();

  // Toggle colorblind mode
  await page.getByRole('switch', { name: /colorblind/i }).click();

  // Close settings (Esc or close button)
  await page.keyboard.press('Escape');

  // Verify <html> has theme-light class + setting persisted
  await expect(page.locator('html')).toHaveClass(/theme-light/);
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('rot_settings')));
  expect(settings.theme).toBe('light');
  expect(settings.colorblind).toBe(true);

  await page.reload();

  // After reload, class + setting should still be present
  await expect(page.locator('html')).toHaveClass(/theme-light/);
  const settings2 = await page.evaluate(() => JSON.parse(localStorage.getItem('rot_settings')));
  expect(settings2.theme).toBe('light');
  expect(settings2.colorblind).toBe(true);
});
