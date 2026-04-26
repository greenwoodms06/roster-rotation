/**
 * formations.js — Sports, position pools, formation layouts, and lookups
 * used by both app.js and field.js. Never touches the rotation engine.
 *
 * Coordinates: [x, y] as percentages (0–100).
 *   x: 0 = left sideline, 100 = right sideline
 *   y: 0 = attacking goal, 100 = own goal (GK end)
 *
 * Each sport has:
 *   - positionPool: canonical vocabulary ordered from essential → specialized,
 *     used to derive positions for player counts with no exact preset.
 *   - defaultN: the typical player count for this sport
 *   - hasSpecialFirst: if true, positions[0] is the keeper/goalie-like role
 *     that often gets max-period constraints
 *   - byCount: map of N → { positions, formations: [{name, coords}] }
 */

const SPORTS = {
  soccer: {
    name: 'Soccer',
    icon: '\u26BD',
    fieldBg: 'soccer',
    defaultN: 7,
    hasSpecialFirst: true,
    positionPool: ['GK', 'CM', 'ST', 'LB', 'RB', 'LW', 'RW', 'CB', 'LM', 'RM', 'LCB', 'RCB', 'LF', 'RF'],
    byCount: {
      5: {
        positions: ['GK', 'LB', 'RB', 'CM', 'ST'],
        formations: [
          { name: '2-1-1', coords: {
              'GK': [50, 91], 'LB': [25, 68], 'RB': [75, 68],
              'CM': [50, 44], 'ST': [50, 18] } },
          { name: '1-2-1', coords: {
              'GK': [50, 91], 'LB': [50, 72],
              'RB': [25, 44], 'CM': [75, 44],
              'ST': [50, 18] } },
        ],
      },
      7: {
        positions: ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'],
        formations: [
          { name: '2-3-1', coords: {
              'GK': [50, 91], 'LB': [22, 72], 'RB': [78, 72],
              'LW': [15, 44], 'CM': [50, 50], 'RW': [85, 44],
              'ST': [50, 16] } },
          { name: '2-1-2-1', coords: {
              'GK': [50, 91], 'LB': [25, 72], 'RB': [75, 72],
              'CM': [50, 58], 'LW': [25, 38], 'RW': [75, 38],
              'ST': [50, 16] } },
        ],
      },
      9: {
        positions: ['GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LF', 'RF'],
        formations: [
          { name: '3-3-2', coords: {
              'GK': [50, 91], 'LB': [20, 72], 'CB': [50, 75], 'RB': [80, 72],
              'LM': [20, 48], 'CM': [50, 50], 'RM': [80, 48],
              'LF': [35, 20], 'RF': [65, 20] } },
          { name: '3-2-3', coords: {
              'GK': [50, 91], 'LB': [20, 72], 'CB': [50, 75], 'RB': [80, 72],
              'LM': [30, 50], 'RM': [70, 50],
              'LF': [18, 22], 'CM': [50, 28], 'RF': [82, 22] } },
        ],
      },
      11: {
        positions: ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LM', 'CM', 'RM', 'LW', 'RW', 'ST'],
        formations: [
          { name: '4-3-3', coords: {
              'GK': [50, 91], 'LB': [12, 70], 'LCB': [35, 74], 'RCB': [65, 74], 'RB': [88, 70],
              'LM': [22, 48], 'CM': [50, 50], 'RM': [78, 48],
              'LW': [12, 24], 'RW': [88, 24], 'ST': [50, 18] } },
          { name: '4-4-2', coords: {
              'GK': [50, 91], 'LB': [12, 70], 'LCB': [37, 74], 'RCB': [63, 74], 'RB': [88, 70],
              'LM': [12, 48], 'CM': [38, 50], 'RM': [88, 48], 'LW': [62, 50],
              'RW': [35, 22], 'ST': [65, 22] } },
        ],
      },
    },
  },

  football: {
    name: 'Football',
    icon: '\uD83C\uDFC8',
    fieldBg: 'football',
    defaultN: 7,
    hasSpecialFirst: true,
    positionPool: ['QB', 'C', 'RB', 'TE', 'WR1', 'WR2', 'WR3', 'LG', 'RG', 'LT', 'RT', 'FB'],
    byCount: {
      5: {
        positions: ['QB', 'C', 'WR1', 'WR2', 'RB'],
        formations: [
          { name: 'Spread', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'WR1': [12, 47], 'WR2': [88, 47],
              'RB': [50, 65] } },
          { name: 'Trips Right', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'WR1': [72, 47], 'WR2': [90, 49],
              'RB': [38, 64] } },
        ],
      },
      6: {
        positions: ['QB', 'C', 'WR1', 'WR2', 'RB', 'TE'],
        formations: [
          { name: 'Spread', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'WR1': [10, 47], 'WR2': [90, 47],
              'TE': [70, 47], 'RB': [50, 65] } },
          { name: 'Shotgun', coords: {
              'QB': [50, 64], 'C': [50, 47],
              'WR1': [8, 47], 'WR2': [92, 47],
              'TE': [30, 47], 'RB': [38, 64] } },
        ],
      },
      7: {
        positions: ['QB', 'C', 'WR1', 'WR2', 'WR3', 'RB', 'TE'],
        formations: [
          { name: 'Spread', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'WR1': [8, 47], 'WR2': [92, 47], 'WR3': [80, 49],
              'RB': [50, 65], 'TE': [30, 47] } },
          { name: 'Trips Right', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'WR1': [75, 47], 'WR2': [85, 49], 'WR3': [92, 47],
              'RB': [40, 64], 'TE': [15, 47] } },
          { name: 'Shotgun', coords: {
              'QB': [50, 62], 'C': [50, 47],
              'WR1': [10, 47], 'WR2': [90, 47], 'WR3': [78, 49],
              'RB': [35, 62], 'TE': [65, 47] } },
        ],
      },
      8: {
        positions: ['QB', 'C', 'LG', 'RG', 'WR1', 'WR2', 'RB', 'TE'],
        formations: [
          { name: 'I-Formation', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'LG': [38, 47], 'RG': [62, 47],
              'WR1': [10, 47], 'WR2': [90, 47],
              'TE': [74, 47], 'RB': [50, 70] } },
          { name: 'Shotgun Spread', coords: {
              'QB': [50, 62], 'C': [50, 47],
              'LG': [38, 47], 'RG': [62, 47],
              'WR1': [8, 47], 'WR2': [92, 47],
              'TE': [74, 47], 'RB': [35, 62] } },
        ],
      },
      11: {
        positions: ['QB', 'C', 'LG', 'RG', 'LT', 'RT', 'WR1', 'WR2', 'TE', 'RB', 'FB'],
        formations: [
          { name: 'I-Formation', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 47], 'RT': [72, 47],
              'WR1': [8, 47], 'WR2': [92, 47],
              'TE': [82, 47], 'FB': [50, 63], 'RB': [50, 70] } },
          { name: 'Shotgun Spread', coords: {
              'QB': [50, 62], 'C': [50, 47],
              'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 47], 'RT': [72, 47],
              'WR1': [5, 47], 'WR2': [95, 47],
              'TE': [85, 47], 'RB': [38, 62], 'FB': [62, 62] } },
          { name: 'Pro Set', coords: {
              'QB': [50, 57], 'C': [50, 47],
              'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 47], 'RT': [72, 47],
              'WR1': [8, 47], 'WR2': [92, 47],
              'TE': [82, 47], 'RB': [38, 64], 'FB': [62, 64] } },
        ],
      },
    },
  },

  baseball: {
    name: 'Baseball / Softball',
    icon: '\u26BE',
    fieldBg: 'baseball',
    defaultN: 9,
    hasSpecialFirst: true, // Pitcher is the max-period-candidate role
    positionPool: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'],
    byCount: {
      9: {
        positions: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'],
        formations: [
          { name: 'Standard', coords: {
              'P':  [50, 68], 'C':  [50, 87],
              '1B': [70, 62], '2B': [60, 48], 'SS': [40, 48], '3B': [30, 62],
              'LF': [18, 25], 'CF': [50, 15], 'RF': [82, 25] } },
        ],
      },
      10: {
        positions: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'LCF', 'RCF', 'RF'],
        formations: [
          { name: 'Standard', coords: {
              'P':  [50, 68], 'C':  [50, 87],
              '1B': [70, 62], '2B': [60, 48], 'SS': [40, 48], '3B': [30, 62],
              'LF': [16, 28], 'LCF': [38, 14], 'RCF': [62, 14], 'RF': [84, 28] } },
        ],
      },
    },
  },

  basketball: {
    name: 'Basketball',
    icon: '\uD83C\uDFC0',
    fieldBg: 'basketball',
    defaultN: 5,
    hasSpecialFirst: false,
    positionPool: ['PG', 'SG', 'SF', 'PF', 'C'],
    byCount: {
      3: {
        positions: ['G', 'F', 'C'],
        formations: [
          { name: 'Standard', coords: { 'G': [50, 22], 'F': [78, 48], 'C': [22, 48] } },
        ],
      },
      5: {
        positions: ['PG', 'SG', 'SF', 'PF', 'C'],
        formations: [
          { name: 'Standard', coords: {
              'PG': [50, 20], 'SG': [82, 32], 'SF': [18, 32],
              'PF': [72, 58], 'C': [50, 68] } },
        ],
      },
    },
  },

  hockey: {
    name: 'Hockey',
    icon: '\uD83C\uDFD2',
    fieldBg: 'hockey',
    defaultN: 6,
    hasSpecialFirst: true,
    positionPool: ['G', 'C', 'LD', 'RD', 'LW', 'RW'],
    byCount: {
      4: {
        positions: ['G', 'D', 'LW', 'RW'],
        formations: [
          { name: 'Standard', coords: {
              'G': [50, 88], 'D': [50, 60],
              'LW': [25, 32], 'RW': [75, 32] } },
        ],
      },
      6: {
        positions: ['G', 'LD', 'RD', 'LW', 'C', 'RW'],
        formations: [
          { name: 'Standard', coords: {
              'G': [50, 88], 'LD': [28, 65], 'RD': [72, 65],
              'LW': [18, 35], 'C': [50, 38], 'RW': [82, 35] } },
        ],
      },
    },
  },

  lacrosse: {
    name: 'Lacrosse',
    icon: '\uD83E\uDD4D',
    fieldBg: 'lacrosse',
    defaultN: 10,
    hasSpecialFirst: true,
    positionPool: ['G', 'D1', 'M1', 'A1', 'D2', 'M2', 'A2', 'D3', 'M3', 'A3'],
    byCount: {
      6: {
        positions: ['G', 'D1', 'D2', 'M', 'A1', 'A2'],
        formations: [
          { name: 'Box', coords: {
              'G': [50, 88], 'D1': [30, 70], 'D2': [70, 70],
              'M': [50, 48],
              'A1': [30, 22], 'A2': [70, 22] } },
        ],
      },
      10: {
        positions: ['G', 'D1', 'D2', 'D3', 'M1', 'M2', 'M3', 'A1', 'A2', 'A3'],
        formations: [
          { name: 'Standard', coords: {
              'G': [50, 88], 'D1': [25, 73], 'D2': [50, 78], 'D3': [75, 73],
              'M1': [22, 48], 'M2': [50, 46], 'M3': [78, 48],
              'A1': [25, 22], 'A2': [50, 18], 'A3': [75, 22] } },
        ],
      },
      12: {
        positions: ['G', 'D1', 'D2', 'D3', 'D4', 'D5', 'M1', 'M2', 'M3', 'A1', 'A2', 'A3'],
        formations: [
          { name: 'Standard', coords: {
              'G': [50, 90],
              'D1': [16, 75], 'D2': [38, 78], 'D3': [50, 82], 'D4': [62, 78], 'D5': [84, 75],
              'M1': [22, 50], 'M2': [50, 48], 'M3': [78, 50],
              'A1': [25, 22], 'A2': [50, 18], 'A3': [75, 22] } },
        ],
      },
    },
  },

  custom: {
    name: 'Custom',
    icon: '\uD83C\uDFC5',
    fieldBg: 'generic',
    defaultN: 6,
    hasSpecialFirst: false,
    positionPool: [], // empty — custom generates P1..Pn
    byCount: {},
  },
};

/**
 * Returns the position list for a given sport + player count.
 * Priority:
 *   1. Exact byCount match → use preset positions
 *   2. Sport has a pool → pool.slice(0, n), padded with P{i} if n > pool.length
 *   3. No pool (custom) → P1..Pn
 */
function getPositionsForCount(sportKey, n) {
  const sport = SPORTS[sportKey];
  if (!sport) return genericPositions(n);
  const exact = sport.byCount[n];
  if (exact) return exact.positions.slice();
  const pool = sport.positionPool || [];
  if (pool.length === 0) return genericPositions(n);
  const result = pool.slice(0, n);
  for (let i = result.length; i < n; i++) result.push(`P${i + 1}`);
  return result;
}

function genericPositions(n) {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

/**
 * Returns the formations array for a given sport + player count.
 * Only returns layouts when byCount has an exact match; otherwise empty
 * so callers can fall back to generateAutoLayout.
 */
function getFormationsForCount(sportKey, n) {
  const sport = SPORTS[sportKey];
  if (!sport) return [];
  const exact = sport.byCount[n];
  return exact ? exact.formations : [];
}

/** Field background key for a sport (e.g., 'soccer', 'basketball', 'generic'). */
function getFieldBg(sportKey) {
  return SPORTS[sportKey]?.fieldBg || 'generic';
}

/**
 * Given a position list, find a matching { sport, n } from any byCount entry,
 * comparing as sorted sets. Returns null if no match.
 */
function findSportAndCount(positions) {
  const posStr = JSON.stringify(positions.slice().sort());
  for (const [sportKey, sport] of Object.entries(SPORTS)) {
    for (const [nStr, entry] of Object.entries(sport.byCount)) {
      if (JSON.stringify(entry.positions.slice().sort()) === posStr) {
        return { sport: sportKey, n: parseInt(nStr) };
      }
    }
  }
  return null;
}

/**
 * Parse a legacy preset key like "soccer-7v7" or "hockey" into { sport, n }.
 * Returns null if the key can't be resolved.
 */
function parseLegacyPresetKey(presetKey) {
  if (!presetKey || typeof presetKey !== 'string') return null;
  if (presetKey === 'custom') return { sport: 'custom', n: SPORTS.custom.defaultN };
  const dash = presetKey.indexOf('-');
  let sportKey, fmtPart;
  if (dash === -1) {
    sportKey = presetKey;
    fmtPart = '';
  } else {
    sportKey = presetKey.slice(0, dash);
    fmtPart = presetKey.slice(dash + 1);
  }
  const sport = SPORTS[sportKey];
  if (!sport) return null;
  // Try to pull a digit out of "7v7", "11v11", etc.
  const m = fmtPart.match(/^(\d+)v\d+$/);
  if (m) return { sport: sportKey, n: parseInt(m[1]) };
  // No format → use defaultN
  return { sport: sportKey, n: sport.defaultN };
}

/**
 * Returns the season's { sport, n } based on stored metadata.
 * Accepts modern shape (season.sport + season.playerCount) and
 * legacy shape (season.preset = "soccer-7v7"). Falls back to
 * findSportAndCount on the roster positions.
 * Requires: Storage (storage.js), ctx and roster globals (app.js).
 */
function getSeasonSport() {
  if (!ctx) return null;
  const seasons = Storage.loadSeasons(ctx.teamSlug);
  const season = seasons.find(s => s.slug === ctx.seasonSlug);
  if (season) {
    if (season.sport && season.playerCount) {
      return { sport: season.sport, n: season.playerCount };
    }
    if (season.preset && season.preset !== 'custom') {
      const parsed = parseLegacyPresetKey(season.preset);
      if (parsed) return parsed;
    }
  }
  if (!roster) return null;
  return findSportAndCount(roster.positions);
}

// ── Auto-layout for unknown / partial counts ───────────────────────
function generateAutoLayout(positions) {
  const n = positions.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const coords = {};
  let idx = 0;
  for (let r = 0; r < rows && idx < n; r++) {
    const rowCount = Math.min(cols, n - idx);
    for (let c = 0; c < rowCount; c++) {
      const x = (c + 1) / (rowCount + 1) * 100;
      const y = 15 + (r / Math.max(rows - 1, 1)) * 70;
      coords[positions[idx]] = [x, y];
      idx++;
    }
  }
  return coords;
}

// Default positions for initial roster before any sport is chosen
const DEFAULT_POSITIONS = SPORTS.soccer.byCount[7].positions.slice();
