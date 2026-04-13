/**
 * fairness.js — Fairness color palette + spread math.
 * Pure helpers; no DOM. Calls loadSettings() at runtime for colorblind flag.
 */

// -- Fairness Color System (colorblind-aware) ----------------------------

/** Returns the three fairness colors based on colorblind setting */
function fairnessColors() {
  const s = loadSettings();
  if (s.colorblind) return { good: '#42a5f5', warn: '#ff9800', bad: '#e53935' };
  return { good: '#00e676', warn: '#fdd835', bad: '#ff5252' };
}

/** Returns fairness color labels for chart subtitles */
function fairnessLabels() {
  const s = loadSettings();
  if (s.colorblind) return { good: 'blue', warn: 'orange', bad: 'red' };
  return { good: 'green', warn: 'yellow', bad: 'red' };
}

/** Picks good/warn/bad color based on deviation from average */
function fairnessBarColor(devFromAvg) {
  const c = fairnessColors();
  return devFromAvg <= 0.05 ? c.good : devFromAvg <= 0.10 ? c.warn : c.bad;
}

/** Picks good/warn/bad color based on fairness spread */
function fairnessSpreadColor(spread) {
  const c = fairnessColors();
  return spread <= 1 ? c.good : spread <= 2 ? c.warn : c.bad;
}

/** Returns W/L/D color */
function wldColor(result) {
  const c = fairnessColors();
  if (result === 'W') return c.good;
  if (result === 'L') return c.bad;
  return c.warn;
}

/** Returns goal differential color */
function diffColor(diff) {
  const c = fairnessColors();
  if (diff > 0) return c.good;
  if (diff < 0) return c.bad;
  return 'var(--fg2)';
}

// -- Per-game fairness: max-min periods spread ---------------------------

function gameFairnessSpread(game) {
  let min = game.numPeriods, max = 0;
  for (const pid of game.availablePlayers) {
    let played = 0;
    for (const pa of game.periodAssignments) {
      for (const val of Object.values(pa.assignments)) {
        if (Array.isArray(val)) {
          played += playerCreditInSlot(val, pid);
        } else if (val === pid) {
          played++;
        }
      }
    }
    if (played < min) min = played;
    if (played > max) max = played;
  }
  return max - min;
}
