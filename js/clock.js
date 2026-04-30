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
  _stopAlertRepeat();
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
  clockAlertFired = false;
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
  const elapsed = clockGetElapsed();
  const frac = Math.min(clockGetFraction(), 1.0);
  const timeDisp = getActiveTimeDisplay();
  el.textContent = timeDisp === 'remaining'
    ? fractionToRemaining(frac, pd)
    : fractionToElapsed(frac, pd);
  el.classList.toggle('running', clockRunning);
  el.classList.toggle('done', elapsed >= pd);

  if (elapsed < pd) {
    clockAlertFired = false;
    _stopAlertRepeat();
  } else if (clockRunning && !clockAlertFired) {
    clockAlertFired = true;
    playPeriodEndAlert();
    _scheduleAlertRepeat();
  }
}

// ── Period-end alert (sound / vibrate) ──
//
// Triggered the first tick the clock crosses its period duration while running.
// Repeats every ALERT_REPEAT_MS until the user pauses, resets, advances the
// period, or extends it (elapsed drops below pd).
// Both signals degrade silently on platforms that don't support them
// (iOS PWA has no vibrate; tests have no AudioContext).

let _alertAudioCtx = null;
let _alertRepeatTimer = null;
const ALERT_REPEAT_MS = 3000;

function playPeriodEndAlert(mode) {
  // mode: undefined → use settings; 'sound' | 'vibrate' | 'both' → forced (test button)
  let wantSound, wantVibrate;
  if (mode === 'sound')        { wantSound = true;  wantVibrate = false; }
  else if (mode === 'vibrate') { wantSound = false; wantVibrate = true; }
  else if (mode === 'both')    { wantSound = true;  wantVibrate = true; }
  else {
    const s = (typeof loadSettings === 'function') ? loadSettings() : {};
    wantSound = s.endOfPeriodSound !== false;
    wantVibrate = s.endOfPeriodVibrate !== false;
  }
  if (wantSound) _playAlertSound();
  if (wantVibrate) _playAlertVibrate();
}

function _playAlertSound() {
  try {
    const Ctx = (typeof AudioContext !== 'undefined') ? AudioContext
              : (typeof webkitAudioContext !== 'undefined') ? webkitAudioContext
              : null;
    if (!Ctx) return;
    if (!_alertAudioCtx) _alertAudioCtx = new Ctx();
    const ctx = _alertAudioCtx;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    // Two short beeps: 880Hz then 1320Hz, ~180ms each, tiny gap between.
    const beep = (freq, startOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + startOffset;
      const dur = 0.18;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.25, t0 + 0.01);
      gain.gain.setValueAtTime(0.25, t0 + dur - 0.04);
      gain.gain.linearRampToValueAtTime(0, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    };
    beep(880, 0);
    beep(1320, 0.22);
  } catch (e) { /* no-op */ }
}

function _playAlertVibrate() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([220, 110, 220]);
    }
  } catch (e) { /* no-op */ }
}

function _scheduleAlertRepeat() {
  if (_alertRepeatTimer) clearTimeout(_alertRepeatTimer);
  _alertRepeatTimer = setTimeout(() => {
    _alertRepeatTimer = null;
    if (!clockRunning) return;
    const pd = getActivePeriodDuration();
    if (!pd || clockGetElapsed() < pd) return;
    playPeriodEndAlert();
    _scheduleAlertRepeat();
  }, ALERT_REPEAT_MS);
}

function _stopAlertRepeat() {
  if (_alertRepeatTimer) { clearTimeout(_alertRepeatTimer); _alertRepeatTimer = null; }
}

function toggleTimeDisplay() {
  if (!currentPlan || !ctx) return;
  currentPlan.timeDisplay = getActiveTimeDisplay() === 'elapsed' ? 'remaining' : 'elapsed';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}
