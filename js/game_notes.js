/**
 * game_notes.js — Notes input, game-label input, scrimmage toggle,
 * and per-period collapse toggle. All persist through Storage.saveGame.
 * Reads/writes globals from app.js: currentPlan, ctx, collapsedPeriods.
 */

function saveGameNotes() {
  if (!currentPlan || !ctx) return;
  const ta = document.getElementById('gameNotesInput');
  if (!ta) return;
  currentPlan.notes = ta.value;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
}

function insertNoteBullet() {
  const ta = document.getElementById('gameNotesInput');
  if (!ta) return;
  ta.focus();
  const start = ta.selectionStart;
  const val = ta.value;
  const prefix = (start === 0 || val[start - 1] === '\n') ? '' : '\n';
  const insert = prefix + '\u2022 ';
  ta.setRangeText(insert, start, start, 'end');
  currentPlan.notes = ta.value;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
}

function saveGameLabel() {
  if (!currentPlan || !ctx) return;
  const input = document.getElementById('gameLabelInput');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    currentPlan.label = val;
  } else {
    delete currentPlan.label;
  }
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  const labelEl = document.getElementById('lineupLabelText');
  if (labelEl) {
    if (currentPlan.label) {
      labelEl.textContent = currentPlan.label;
      labelEl.style.display = '';
    } else {
      labelEl.textContent = '';
      labelEl.style.display = 'none';
    }
  }
}

function toggleScrimmage() {
  if (!currentPlan || !ctx) return;
  currentPlan.exhibition = !currentPlan.exhibition;
  if (!currentPlan.exhibition) delete currentPlan.exhibition;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  const el = document.getElementById('scrimmageCheck');
  if (el) el.classList.toggle('checked', !!currentPlan.exhibition);
}

function togglePeriodCollapse(pi) {
  if (collapsedPeriods.has(pi)) collapsedPeriods.delete(pi);
  else collapsedPeriods.add(pi);
  renderLineup();
}
