/**
 * credit.js — v4 Fractional Credit System Utilities
 * Pure functions, zero dependencies. Shared by engine.js, storage.js, and app.js.
 *
 * v4 period assignment format:
 *   assignments: { position: [{ pid, timeIn, timeOut }, ...] }
 *   (v3 was: { position: playerId })
 *
 * Time values are normalized fractions 0.0–1.0 (fraction of period, not seconds).
 * Credit for an entry = timeOut - timeIn. Slot entries must sum to 1.0.
 */

// ── Entry-Level Helpers ─────────────────────────────────────────────

/** Credit for a single slot entry. */
function entryCredit(entry) {
  return entry.timeOut - entry.timeIn;
}

/** Total credit consumed across all entries in a slot. */
function slotCredit(occupants) {
  return occupants.reduce((sum, e) => sum + entryCredit(e), 0);
}

/** Remaining credit available in a slot (1.0 - used). */
function slotRemaining(occupants) {
  return 1.0 - slotCredit(occupants);
}

/**
 * Total credit for a specific player across all their entries in a slot.
 * Handles re-entry: same pid may appear multiple times.
 */
function playerCreditInSlot(occupants, pid) {
  return occupants
    .filter(e => e.pid === pid)
    .reduce((sum, e) => sum + entryCredit(e), 0);
}

/**
 * Which player is occupying a slot at a given fractional time?
 * Returns the entry whose interval contains t, or null.
 * At exact boundaries, the departing player owns the instant (timeIn <= t < timeOut).
 */
function occupantAtTime(occupants, t) {
  return occupants.find(e => e.timeIn <= t && t < e.timeOut) || null;
}

// ── Format Conversion ───────────────────────────────────────────────

/**
 * Wrap engine output { pos: pid } → v4 format (whole period, no mid-period changes).
 * Idempotent: if value is already an array, returns it unchanged.
 */
function wrapEngineOutput(assignments) {
  const result = {};
  for (const [pos, val] of Object.entries(assignments)) {
    if (Array.isArray(val)) {
      // Already v4 — pass through
      result[pos] = val;
    } else {
      // v3 string → v4 array
      result[pos] = [{ pid: val, timeIn: 0.0, timeOut: 1.0 }];
    }
  }
  return result;
}

/**
 * Extract primary player per position from v4 assignments.
 * Returns v3-shaped { pos: pid } for engine internals (continuity, etc.).
 * Uses the last occupant (highest timeOut) as the "current" player.
 */
function v4AssignmentsToPrimary(v4Assignments) {
  const result = {};
  for (const [pos, val] of Object.entries(v4Assignments)) {
    if (Array.isArray(val)) {
      // v4: take last occupant as primary
      result[pos] = val[val.length - 1].pid;
    } else {
      // Already v3 string
      result[pos] = val;
    }
  }
  return result;
}

/**
 * Extract unique player IDs from a v4 period assignment's assignments object.
 * Works with both v3 (string values) and v4 (array values) for safety.
 */
function extractPidsFromAssignments(assignments) {
  const pids = new Set();
  for (const val of Object.values(assignments)) {
    if (Array.isArray(val)) {
      for (const e of val) pids.add(e.pid);
    } else {
      pids.add(val);
    }
  }
  return [...pids];
}

/**
 * Check if a period assignment's assignments object uses v4 format.
 * v3: { pos: "pid" }, v4: { pos: [{pid, timeIn, timeOut}] }
 */
function isV4Assignments(assignments) {
  const vals = Object.values(assignments);
  if (vals.length === 0) return true; // empty is valid for either
  return Array.isArray(vals[0]);
}

// ── Validation ──────────────────────────────────────────────────────

/**
 * Validate a single slot's occupant entries.
 * Returns null if valid, or an error string if invalid.
 */
function validateSlot(occupants) {
  if (!Array.isArray(occupants) || occupants.length === 0) {
    return 'Slot has no entries';
  }

  // 1. Each entry must have timeIn < timeOut
  for (const e of occupants) {
    if (e.timeIn >= e.timeOut) {
      return `Entry for ${e.pid} has timeIn (${e.timeIn}) >= timeOut (${e.timeOut})`;
    }
  }

  // 2. Entries must be sorted by timeIn, no overlaps
  for (let i = 1; i < occupants.length; i++) {
    if (occupants[i].timeIn < occupants[i - 1].timeOut - 0.001) {
      return `Entries overlap or are out of order at index ${i}`;
    }
  }

  // 3. Total credit sums to 1.0 ± 0.001
  const total = occupants.reduce((s, e) => s + (e.timeOut - e.timeIn), 0);
  if (Math.abs(total - 1.0) > 0.001) {
    return `Slot credits sum to ${total.toFixed(3)}, expected 1.0`;
  }

  return null; // valid
}

/**
 * Validate all slots in a period assignment.
 * Returns null if valid, or an error string like "CB: Slot credits sum to 0.75".
 */
function validatePeriodAssignment(pa) {
  for (const [pos, occupants] of Object.entries(pa.assignments)) {
    // Skip v3 format (string values) — only validate v4
    if (!Array.isArray(occupants)) continue;
    const err = validateSlot(occupants);
    if (err) return `${pos}: ${err}`;
  }
  return null;
}

// ── Migration ───────────────────────────────────────────────────────

/**
 * Migrate a single period assignment from v3 to v4 format.
 * Pure function — does not mutate the input.
 * If already v4, returns unchanged.
 */
function migratePeriodAssignment(pa) {
  if (isV4Assignments(pa.assignments)) return pa;

  const newAssignments = {};
  for (const [pos, pid] of Object.entries(pa.assignments)) {
    newAssignments[pos] = [{ pid, timeIn: 0.0, timeOut: 1.0 }];
  }
  return { ...pa, assignments: newAssignments };
}

/**
 * Migrate a full games array from v3 to v4.
 * Pure function — returns a new array. Input is not mutated.
 * Mixed arrays (some v3, some v4 periods) are handled per-period.
 */
function migrateGamesToV4(games) {
  return games.map(game => ({
    ...game,
    periodAssignments: game.periodAssignments.map(migratePeriodAssignment),
  }));
}

// ── Display Helpers ─────────────────────────────────────────────────

/**
 * Format a period count (possibly fractional) for display.
 * Integer values show as integers; fractional values show one decimal place.
 */
function fmtPeriods(n) {
  if (Number.isInteger(n) || Math.abs(n - Math.round(n)) < 0.01) {
    return Math.round(n).toString();
  }
  return n.toFixed(1);
}

// ── Season Fairness Helpers (prep for future playing-time indicator) ─

/**
 * Fraction of game played for a player through a given period index.
 * Returns 0.0 to 1.0.
 */
function gamePlayedFraction(pid, plan, throughPeriodIdx) {
  let credit = 0;
  for (let i = 0; i <= throughPeriodIdx; i++) {
    const pa = plan.periodAssignments[i];
    if (!pa) break;
    for (const occupants of Object.values(pa.assignments)) {
      if (Array.isArray(occupants)) {
        credit += playerCreditInSlot(occupants, pid);
      } else if (occupants === pid) {
        credit += 1;
      }
    }
  }
  return credit / plan.numPeriods;
}

/**
 * Season fairness ratio for a player vs team average.
 * Returns null if no history, or a ratio where 1.0 = on track.
 */
function seasonFairnessRatio(pid, seasonStats) {
  const s = seasonStats[pid];
  if (!s || s.totalPeriodsAvailable === 0) return null;
  const playerRatio = s.totalPeriodsPlayed / s.totalPeriodsAvailable;
  const allRatios = Object.values(seasonStats)
    .filter(st => st.totalPeriodsAvailable > 0)
    .map(st => st.totalPeriodsPlayed / st.totalPeriodsAvailable);
  if (allRatios.length === 0) return null;
  const teamAvg = allRatios.reduce((a, b) => a + b, 0) / allRatios.length;
  if (teamAvg === 0) return null;
  return playerRatio / teamAvg;
}
