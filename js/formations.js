/**
 * formations.js — Sports, position presets, formation layouts, sport icons,
 * and preset-matching utilities used by both app.js and field.js.
 * Never touches the rotation engine.
 *
 * Coordinates: [x, y] as percentages (0–100).
 *   x: 0 = left sideline, 100 = right sideline
 *   y: 0 = attacking goal, 100 = own goal (GK end)
 */

// ── Sports (single source of truth) ──────────────────────────────
const SPORTS = {
  soccer: {
    name: 'Soccer',
    icon: '\u26BD',
    formats: [
      { key: '5v5',   name: '5v5',   positions: ['GK', 'LB', 'RB', 'CM', 'ST'] },
      { key: '7v7',   name: '7v7',   positions: ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'] },
      { key: '9v9',   name: '9v9',   positions: ['GK', 'LB', 'CB', 'RB', 'LM', 'CM', 'RM', 'LF', 'RF'] },
      { key: '11v11', name: '11v11', positions: ['GK', 'LB', 'LCB', 'RCB', 'RB', 'LM', 'CM', 'RM', 'LW', 'RW', 'ST'] },
    ],
  },
  football: {
    name: 'Football',
    icon: '\uD83C\uDFC8',
    formats: [
      { key: '7v7',   name: '7v7 (Flag)', positions: ['QB', 'C', 'WR1', 'WR2', 'WR3', 'RB', 'TE'] },
      { key: '11v11', name: '11v11',       positions: ['QB', 'C', 'LG', 'RG', 'LT', 'RT', 'WR1', 'WR2', 'TE', 'RB', 'FB'] },
    ],
  },
  baseball: {
    name: 'Baseball / Softball',
    icon: '\u26BE',
    formats: [
      { key: '', name: '9-player', positions: ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'] },
    ],
  },
  basketball: {
    name: 'Basketball',
    icon: '\uD83C\uDFC0',
    formats: [
      { key: '',    name: '5v5', positions: ['PG', 'SG', 'SF', 'PF', 'C'] },
      { key: '3v3', name: '3v3', positions: ['G', 'F', 'C'] },
    ],
  },
  hockey: {
    name: 'Hockey',
    icon: '\uD83C\uDFD2',
    formats: [
      { key: '', name: '6v6', positions: ['G', 'LD', 'RD', 'LW', 'C', 'RW'] },
    ],
  },
  lacrosse: {
    name: 'Lacrosse',
    icon: '\uD83E\uDD4D',
    formats: [
      { key: '', name: '10v10', positions: ['G', 'D1', 'D2', 'D3', 'M1', 'M2', 'M3', 'A1', 'A2', 'A3'] },
    ],
  },
  custom: {
    name: 'Custom',
    icon: '\uD83C\uDFC5',
    formats: [
      { key: '', name: 'Custom', positions: [] },
    ],
  },
};

/** Compose preset key from sport + format keys */
function makePresetKey(sportKey, formatKey) {
  return formatKey ? `${sportKey}-${formatKey}` : sportKey;
}

/** Parse preset key into { sport, format } */
function parsePresetKey(preset) {
  for (const [sportKey, sport] of Object.entries(SPORTS)) {
    for (const fmt of sport.formats) {
      if (makePresetKey(sportKey, fmt.key) === preset) {
        return { sport: sportKey, format: fmt.key };
      }
    }
  }
  return { sport: 'custom', format: '' };
}

// ── Derived: Position Presets & Sport Icons ───────────────────────
const POSITION_PRESETS = {};
const SPORT_ICONS = {};
for (const [sportKey, sport] of Object.entries(SPORTS)) {
  for (const fmt of sport.formats) {
    const key = makePresetKey(sportKey, fmt.key);
    POSITION_PRESETS[key] = fmt.positions;
    SPORT_ICONS[key] = sport.icon;
  }
}

const DEFAULT_POSITIONS = POSITION_PRESETS['soccer-7v7'];

// ── Formation Layouts ──────────────────────────────────────────────
const FORMATIONS = {
  'soccer-5v5': {
    fieldType: 'soccer',
    layouts: [
      {
        name: '2-1-1',
        coords: {
          'GK': [50, 91], 'LB': [25, 68], 'RB': [75, 68],
          'CM': [50, 44], 'ST': [50, 18]
        }
      },
      {
        name: '1-2-1',
        coords: {
          'GK': [50, 91], 'LB': [50, 72],
          'RB': [25, 44], 'CM': [75, 44],
          'ST': [50, 18]
        }
      }
    ]
  },
  'soccer-7v7': {
    fieldType: 'soccer',
    layouts: [
      {
        name: '2-3-1',
        coords: {
          'GK': [50, 91], 'LB': [22, 72], 'RB': [78, 72],
          'LW': [15, 44], 'CM': [50, 50], 'RW': [85, 44],
          'ST': [50, 16]
        }
      },
      {
        name: '2-3-1 Narrow',
        coords: {
          'GK': [50, 91], 'LB': [32, 72], 'RB': [68, 72],
          'LW': [25, 46], 'CM': [50, 50], 'RW': [75, 46],
          'ST': [50, 16]
        }
      },
      {
        name: '2-1-2-1',
        coords: {
          'GK': [50, 91], 'LB': [25, 72], 'RB': [75, 72],
          'CM': [50, 58], 'LW': [25, 38], 'RW': [75, 38],
          'ST': [50, 16]
        }
      }
    ]
  },
  'soccer-9v9': {
    fieldType: 'soccer',
    layouts: [
      {
        name: '3-3-2',
        coords: {
          'GK': [50, 91], 'LB': [20, 72], 'CB': [50, 75], 'RB': [80, 72],
          'LM': [20, 48], 'CM': [50, 50], 'RM': [80, 48],
          'LF': [35, 20], 'RF': [65, 20]
        }
      },
      {
        name: '3-2-3',
        coords: {
          'GK': [50, 91], 'LB': [20, 72], 'CB': [50, 75], 'RB': [80, 72],
          'LM': [30, 50], 'RM': [70, 50],
          'LF': [18, 22], 'CM': [50, 28], 'RF': [82, 22]
        }
      }
    ]
  },
  'soccer-11v11': {
    fieldType: 'soccer',
    layouts: [
      {
        name: '4-3-3',
        coords: {
          'GK': [50, 91], 'LB': [12, 70], 'LCB': [35, 74], 'RCB': [65, 74], 'RB': [88, 70],
          'LM': [22, 48], 'CM': [50, 50], 'RM': [78, 48],
          'LW': [12, 24], 'RW': [88, 24], 'ST': [50, 18]
        }
      },
      {
        name: '4-4-2',
        coords: {
          'GK': [50, 91], 'LB': [12, 70], 'LCB': [37, 74], 'RCB': [63, 74], 'RB': [88, 70],
          'LM': [12, 48], 'CM': [38, 50], 'RM': [88, 48], 'LW': [62, 50],
          'RW': [35, 22], 'ST': [65, 22]
        }
      }
    ]
  },
  'basketball': {
    fieldType: 'basketball',
    layouts: [
      {
        name: 'Standard',
        coords: {
          'PG': [50, 20], 'SG': [82, 32], 'SF': [18, 32],
          'PF': [72, 58], 'C': [50, 68]
        }
      },
      {
        name: 'Spread',
        coords: {
          'PG': [50, 18], 'SG': [88, 38], 'SF': [12, 38],
          'PF': [75, 62], 'C': [25, 62]
        }
      }
    ]
  },
  'basketball-3v3': {
    fieldType: 'basketball',
    layouts: [
      {
        name: 'Standard',
        coords: {
          'G': [50, 22], 'F': [78, 48], 'C': [22, 48]
        }
      },
      {
        name: 'Triangle',
        coords: {
          'G': [50, 20], 'F': [72, 55], 'C': [28, 55]
        }
      }
    ]
  },
  'hockey': {
    fieldType: 'hockey',
    layouts: [
      {
        name: 'Standard',
        coords: {
          'G': [50, 88], 'LD': [28, 65], 'RD': [72, 65],
          'LW': [18, 35], 'C': [50, 38], 'RW': [82, 35]
        }
      }
    ]
  },
  'lacrosse': {
    fieldType: 'lacrosse',
    layouts: [
      {
        name: 'Standard',
        coords: {
          'G': [50, 88], 'D1': [25, 73], 'D2': [50, 78], 'D3': [75, 73],
          'M1': [22, 48], 'M2': [50, 46], 'M3': [78, 48],
          'A1': [25, 22], 'A2': [50, 18], 'A3': [75, 22]
        }
      }
    ]
  },
  'football-7v7': {
    fieldType: 'football',
    layouts: [
      {
        name: 'Spread',
        coords: {
          'QB': [50, 57], 'C': [50, 47],
          'WR1': [8, 46], 'WR2': [92, 46], 'WR3': [80, 42],
          'RB': [50, 65], 'TE': [30, 47]
        }
      },
      {
        name: 'Trips Right',
        coords: {
          'QB': [50, 57], 'C': [50, 47],
          'WR1': [75, 46], 'WR2': [88, 40], 'WR3': [92, 48],
          'RB': [40, 64], 'TE': [15, 47]
        }
      },
      {
        name: 'Shotgun',
        coords: {
          'QB': [50, 62], 'C': [50, 47],
          'WR1': [10, 46], 'WR2': [90, 46], 'WR3': [78, 40],
          'RB': [35, 62], 'TE': [65, 47]
        }
      }
    ]
  },
  'football-11v11': {
    fieldType: 'football',
    layouts: [
      {
        name: 'I-Formation',
        coords: {
          'QB': [50, 57], 'C': [50, 47],
          'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 48], 'RT': [72, 48],
          'WR1': [8, 46], 'WR2': [92, 46],
          'TE': [82, 47], 'FB': [50, 63], 'RB': [50, 70]
        }
      },
      {
        name: 'Shotgun Spread',
        coords: {
          'QB': [50, 62], 'C': [50, 47],
          'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 48], 'RT': [72, 48],
          'WR1': [5, 46], 'WR2': [95, 46],
          'TE': [85, 47], 'RB': [38, 62], 'FB': [62, 62]
        }
      },
      {
        name: 'Pro Set',
        coords: {
          'QB': [50, 57], 'C': [50, 47],
          'LG': [40, 47], 'RG': [60, 47], 'LT': [28, 48], 'RT': [72, 48],
          'WR1': [8, 46], 'WR2': [92, 46],
          'TE': [82, 47], 'RB': [38, 64], 'FB': [62, 64]
        }
      }
    ]
  },
  'baseball': {
    fieldType: 'baseball',
    layouts: [
      {
        name: 'Standard',
        coords: {
          'P':  [50, 68],
          'C':  [50, 87],
          '1B': [70, 62],
          '2B': [60, 48],
          'SS': [40, 48],
          '3B': [30, 62],
          'LF': [18, 25],
          'CF': [50, 15],
          'RF': [82, 25]
        }
      },
      {
        name: 'Shift Right',
        coords: {
          'P':  [50, 68],
          'C':  [50, 87],
          '1B': [70, 62],
          '2B': [66, 48],
          'SS': [52, 48],
          '3B': [30, 62],
          'LF': [22, 25],
          'CF': [55, 15],
          'RF': [82, 25]
        }
      }
    ]
  }
};

// ── Auto-layout for custom/unknown positions ───────────────────────
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

// ── Preset Matching Utilities ─────────────────────────────────────

/** Match a position list to a known preset key, or null. */
function matchPresetFromPositions(positions) {
  const posStr = JSON.stringify(positions.slice().sort());
  for (const [key, presetPositions] of Object.entries(POSITION_PRESETS)) {
    if (key === 'custom' || presetPositions.length === 0) continue;
    if (JSON.stringify(presetPositions.slice().sort()) === posStr) return key;
  }
  return null;
}

/**
 * Returns the season's preset key (e.g. 'soccer-7v7') from stored season
 * metadata, falling back to auto-detection from positions.
 * Requires: Storage (from storage.js), ctx and roster globals (from app.js).
 */
function getSeasonPreset() {
  if (!ctx) return null;
  const seasons = Storage.loadSeasons(ctx.teamSlug);
  const season = seasons.find(s => s.slug === ctx.seasonSlug);
  if (season?.preset && season.preset !== 'custom') return season.preset;
  if (!roster) return null;
  return matchPresetFromPositions(roster.positions);
}
