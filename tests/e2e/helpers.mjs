/**
 * e2e helpers — shared flows and selectors.
 *
 * Every test starts with a clean localStorage via `resetApp()`.
 * Higher-level flows (createTeamAndSeason, addPlayer) build on that
 * so individual specs stay focused on the behavior they verify.
 */

/** Wipe localStorage (including rot_settings) and reload to a clean app. */
export async function resetApp(page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

/**
 * Create a team via the context picker. The picker renders a "+ New"
 * button inside the Team section (saveTeam() then auto-opens the
 * season modal). Assumes the app is in empty state (no teams).
 */
export async function createTeam(page, teamName) {
  await page.locator('#contextLabel').click();
  const picker = page.locator('#contextModal');
  await picker.waitFor({ state: 'visible' });
  // The Team section's "+ New" is the first such chip when no team is picked.
  await picker.locator('.ctx-chip.add-new').first().click();
  await page.locator('#teamModal').waitFor({ state: 'visible' });
  await page.locator('#teamNameInput').fill(teamName);
  await page.locator('#teamModal').getByRole('button', { name: /save team/i }).click();
  await page.locator('#teamModal').waitFor({ state: 'hidden' });
}

/**
 * Create a season after a team is active. Fills name + positions, submits.
 *
 * saveSeason() auto-seeds a default roster (positions.length + 3 generic
 * players) when no prior season exists. For tests that want to start from
 * an empty roster, pass `{ clearDefaultRoster: true }` (default).
 */
export async function createSeason(page, { name, positions, clearDefaultRoster = true } = {}) {
  const seasonModal = page.locator('#seasonModal');
  if (!(await seasonModal.isVisible())) {
    await page.locator('#contextLabel').click();
    await page.locator('#contextModal').waitFor({ state: 'visible' });
    // After picking a team, the Season section's "+ New" is the last .add-new chip.
    await page.locator('#contextModal .ctx-chip.add-new').last().click();
  }
  await seasonModal.waitFor({ state: 'visible' });
  await page.locator('#seasonNameInput').fill(name || 'Test Season');
  if (positions) {
    await page.locator('#positionsInput').fill(positions);
  }
  await seasonModal.getByRole('button', { name: /create season/i }).click();
  await seasonModal.waitFor({ state: 'hidden' });

  if (clearDefaultRoster) {
    // saveSeason seeds `Player 1..Player N` defaults. Wipe them via storage so
    // roster tests start clean. We keep the roster object (with positions).
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('_roster'));
      if (!key) return;
      const roster = JSON.parse(localStorage.getItem(key));
      roster.players = {};
      localStorage.setItem(key, JSON.stringify(roster));
    });
    await page.reload();
  }
}

/** Open Add Player modal, fill name (+ optional number), save. */
export async function addPlayer(page, { name, number }) {
  // The "+ Add" button in the Roster card-title opens the player modal.
  // Scope to the Roster tab so we don't collide with other "+ Add" buttons.
  await page.locator('#tab-roster button[onclick="openPlayerModal()"]').click();
  const modal = page.locator('#playerModal');
  await modal.waitFor({ state: 'visible' });
  await page.locator('#modalPlayerName').fill(name);
  if (number) await page.locator('#modalPlayerNum').fill(String(number));
  await modal.locator('button[onclick="savePlayer()"]').click();
  await modal.waitFor({ state: 'hidden' });
}

/** Convenience: add N generic players numbered 1..N. */
export async function addPlayers(page, n) {
  for (let i = 1; i <= n; i++) {
    await addPlayer(page, { name: `Player${i}`, number: i });
  }
}

export async function switchTab(page, name) {
  // Nav buttons have aria-label="Roster" / "Game Day" / "Lineup" / etc.
  await page.locator(`nav button[aria-label="${name}"]`).click();
}

/** Click the "All →" button that moves all roster players to Available. */
export async function selectAllPlayers(page) {
  await page.locator('.pickup-col-left .pickup-action').click();
}

/** Dump localStorage as a JSON object — useful for assertions. */
export async function dumpStorage(page) {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out[k] = localStorage.getItem(k);
    }
    return out;
  });
}
