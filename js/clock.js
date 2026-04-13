/**
 * clock.js — Game clock state + time/fraction conversion helpers.
 *
 * Clock state is pure UI (not persisted, resets on reload). These
 * functions read/write globals declared in app.js (clockRunning,
 * clockStartTime, clockElapsed, clockInterval, clockPeriodIdx,
 * currentPlan, ctx) and call back into app.js renderers.
 */

// ── Time ↔ fraction conversion ──

function timeToFraction(seconds, periodDuration) {
  if (!periodDuration || periodDuration <= 0) return 0;
  return Math.min(1.0, Math.max(0, seconds / periodDuration));
}

function fractionToElapsed(f, periodDuration) {
  if (!periodDuration) return '00:00';
  const s = Math.round(f * periodDuration);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fractionToRemaining(f, periodDuration) {
  return fractionToElapsed(1.0 - f, periodDuration);
}

function fractionToDisplay(f, periodDuration) {
  return getActiveTimeDisplay() === 'remaining'
    ? fractionToRemaining(f, periodDuration)
    : fractionToElapsed(f, periodDuration);
}

// ── Game Clock ──

function clockGetElapsed() {
  let total = clockElapsed;
  if (clockRunning && clockStartTime) {
    total += (Date.now() - clockStartTime) / 1000;
  }
  return total;
}

function clockGetFraction() {
  const pd = getActivePeriodDuration();
  if (!pd) return 0;
  return Math.min(1.0, clockGetElapsed() / pd);
}

function clockStart() {
  if (clockRunning) return;
  clockRunning = true;
  clockStartTime = Date.now();
  clockInterval = setInterval(updateClockDisplay, 1000);
  updateClockDisplay();
}

function clockStop() {
  if (!clockRunning) return;
  clockElapsed += (Date.now() - clockStartTime) / 1000;
  clockRunning = false;
  clockStartTime = null;
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  updateClockDisplay();
}

function clockReset() {
  clockStop();
  clockElapsed = 0;
  updateClockDisplay();
  renderLineup();
}

function clockToggle() {
  clockRunning ? clockStop() : clockStart();
  renderLineup();
}

function clockAdvancePeriod(newPeriodIdx) {
  clockReset();
  clockPeriodIdx = newPeriodIdx;
}

function updateClockDisplay() {
  const el = document.getElementById('gameClock');
  if (!el) return;
  const pd = getActivePeriodDuration();
  if (!pd) { el.textContent = '0:00'; return; }
  const frac = Math.min(clockGetFraction(), 1.0);
  const timeDisp = getActiveTimeDisplay();
  el.textContent = timeDisp === 'remaining'
    ? fractionToRemaining(frac, pd)
    : fractionToElapsed(frac, pd);
  el.classList.toggle('running', clockRunning);
  el.classList.toggle('done', clockGetElapsed() >= pd);
}

function toggleTimeDisplay() {
  if (!currentPlan || !ctx) return;
  currentPlan.timeDisplay = getActiveTimeDisplay() === 'elapsed' ? 'remaining' : 'elapsed';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}
