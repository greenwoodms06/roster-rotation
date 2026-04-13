// tests/test_formations.mjs — SPORTS, positions, formations, legacy compat
import { suite, assert, assertEqual, createContext, run } from './helpers.mjs';

const ctx = createContext();

suite('SPORTS — structure');
{
  const sportKeys = run(ctx, 'Object.keys(SPORTS)');
  assert(sportKeys.includes('soccer'), 'has soccer');
  assert(sportKeys.includes('football'), 'has football');
  assert(sportKeys.includes('baseball'), 'has baseball');
  assert(sportKeys.includes('basketball'), 'has basketball');
  assert(sportKeys.includes('hockey'), 'has hockey');
  assert(sportKeys.includes('lacrosse'), 'has lacrosse');
  assert(sportKeys.includes('custom'), 'has custom');

  for (const key of sportKeys) {
    const sport = run(ctx, `SPORTS['${key}']`);
    assert(sport.name, `${key} has name`);
    assert(sport.icon, `${key} has icon`);
    assert(sport.fieldBg, `${key} has fieldBg`);
    assert(typeof sport.defaultN === 'number', `${key} has numeric defaultN`);
    assert(typeof sport.hasSpecialFirst === 'boolean', `${key} has hasSpecialFirst flag`);
    assert(Array.isArray(sport.positionPool), `${key} has positionPool array`);
    assert(typeof sport.byCount === 'object', `${key} has byCount object`);
  }
}

suite('SPORTS — soccer byCount');
{
  const soccerCounts = run(ctx, 'Object.keys(SPORTS.soccer.byCount).map(Number).sort((a,b)=>a-b)');
  assertEqual(soccerCounts, [5, 7, 9, 11], 'soccer has byCount 5, 7, 9, 11');

  const pos7 = run(ctx, 'SPORTS.soccer.byCount[7].positions');
  assertEqual(pos7.length, 7, 'soccer 7 has 7 positions');
  assert(pos7.includes('GK'), 'soccer 7 has GK');

  const formations7 = run(ctx, 'SPORTS.soccer.byCount[7].formations');
  assert(formations7.length >= 2, 'soccer 7 has multiple formations');
}

suite('SPORTS — basketball byCount');
{
  const counts = run(ctx, 'Object.keys(SPORTS.basketball.byCount).map(Number).sort((a,b)=>a-b)');
  assertEqual(counts, [3, 5], 'basketball has byCount 3, 5');

  assertEqual(run(ctx, 'SPORTS.basketball.byCount[3].positions'), ['G', 'F', 'C'], 'basketball 3 positions');
}

suite('getPositionsForCount');
{
  // Exact preset match
  assertEqual(run(ctx, 'getPositionsForCount("soccer", 7)'), ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'], 'soccer 7 = exact preset');
  assertEqual(run(ctx, 'getPositionsForCount("basketball", 3)'), ['G', 'F', 'C'], 'basketball 3 = exact preset');

  // Intermediate value from pool
  const soccer6 = run(ctx, 'getPositionsForCount("soccer", 6)');
  assertEqual(soccer6.length, 6, 'soccer 6 returns 6 positions');
  assertEqual(soccer6[0], 'GK', 'soccer 6 starts with GK (first in pool)');

  // Overflow past pool → generic P#
  const custom20 = run(ctx, 'getPositionsForCount("custom", 3)');
  assertEqual(custom20, ['P1', 'P2', 'P3'], 'custom 3 generates P1..P3');

  // Past soccer pool → pool + P#
  const soccer20 = run(ctx, 'getPositionsForCount("soccer", 15)');
  assertEqual(soccer20.length, 15, 'soccer 15 returns 15 positions');
  assertEqual(soccer20[14], 'P15', 'soccer 15 ends with P15 (pool + generic overflow)');
}

suite('getFormationsForCount');
{
  const f7 = run(ctx, 'getFormationsForCount("soccer", 7)');
  assert(f7.length >= 2, 'soccer 7 has multiple formations');
  assert(f7[0].name, 'formations have names');
  assert(f7[0].coords, 'formations have coords');

  const f6 = run(ctx, 'getFormationsForCount("soccer", 6)');
  assertEqual(f6, [], 'soccer 6 has no preset formations (auto-layout fallback)');
}

suite('getFieldBg');
{
  assertEqual(run(ctx, 'getFieldBg("soccer")'), 'soccer', 'soccer → soccer bg');
  assertEqual(run(ctx, 'getFieldBg("custom")'), 'generic', 'custom → generic bg');
  assertEqual(run(ctx, 'getFieldBg("unknown")'), 'generic', 'unknown → generic bg');
}

suite('findSportAndCount');
{
  assertEqual(run(ctx, 'findSportAndCount(["GK","LB","RB","LW","CM","RW","ST"])'), { sport: 'soccer', n: 7 }, 'matches soccer 7');
  assertEqual(run(ctx, 'findSportAndCount(["GK","LB","RB","CM","ST"])'), { sport: 'soccer', n: 5 }, 'matches soccer 5');
  assertEqual(run(ctx, 'findSportAndCount(["G","F","C"])'), { sport: 'basketball', n: 3 }, 'matches basketball 3');
  assertEqual(run(ctx, 'findSportAndCount(["PG","SG","SF","PF","C"])'), { sport: 'basketball', n: 5 }, 'matches basketball 5');
  // Order independent
  assertEqual(run(ctx, 'findSportAndCount(["ST","GK","CM","RB","LB"])'), { sport: 'soccer', n: 5 }, 'matches regardless of order');
  assertEqual(run(ctx, 'findSportAndCount(["X","Y","Z"])'), null, 'returns null for unknown');
}

suite('parseLegacyPresetKey');
{
  assertEqual(run(ctx, 'parseLegacyPresetKey("soccer-7v7")'), { sport: 'soccer', n: 7 }, 'parses soccer-7v7');
  assertEqual(run(ctx, 'parseLegacyPresetKey("soccer-11v11")'), { sport: 'soccer', n: 11 }, 'parses soccer-11v11');
  assertEqual(run(ctx, 'parseLegacyPresetKey("basketball-3v3")'), { sport: 'basketball', n: 3 }, 'parses basketball-3v3');
  assertEqual(run(ctx, 'parseLegacyPresetKey("hockey")'), { sport: 'hockey', n: 6 }, 'parses hockey (uses defaultN)');
  assertEqual(run(ctx, 'parseLegacyPresetKey("baseball")'), { sport: 'baseball', n: 9 }, 'parses baseball (uses defaultN)');
  assertEqual(run(ctx, 'parseLegacyPresetKey("custom")'), { sport: 'custom', n: 6 }, 'parses custom');
  assertEqual(run(ctx, 'parseLegacyPresetKey("nonexistent")'), null, 'unknown → null');
  assertEqual(run(ctx, 'parseLegacyPresetKey(null)'), null, 'null input → null');
}

suite('DEFAULT_POSITIONS');
{
  assertEqual(run(ctx, 'DEFAULT_POSITIONS'), ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'], 'defaults to soccer 7');
}

suite('Formations — coord values are valid percentages');
{
  const sportKeys = run(ctx, 'Object.keys(SPORTS)');
  for (const sportKey of sportKeys) {
    const counts = run(ctx, `Object.keys(SPORTS["${sportKey}"].byCount)`);
    for (const nStr of counts) {
      const formations = run(ctx, `SPORTS["${sportKey}"].byCount[${nStr}].formations`);
      for (const layout of formations) {
        for (const [pos, coord] of Object.entries(layout.coords)) {
          assert(coord[0] >= 0 && coord[0] <= 100, `${sportKey}/${nStr}/${layout.name}/${pos} x in [0,100]`);
          assert(coord[1] >= 0 && coord[1] <= 100, `${sportKey}/${nStr}/${layout.name}/${pos} y in [0,100]`);
        }
      }
    }
  }
}

suite('Formations — coord count matches positions');
{
  const sportKeys = run(ctx, 'Object.keys(SPORTS)');
  for (const sportKey of sportKeys) {
    const counts = run(ctx, `Object.keys(SPORTS["${sportKey}"].byCount)`);
    for (const nStr of counts) {
      const positions = run(ctx, `SPORTS["${sportKey}"].byCount[${nStr}].positions`);
      const formations = run(ctx, `SPORTS["${sportKey}"].byCount[${nStr}].formations`);
      for (const layout of formations) {
        const coordKeys = Object.keys(layout.coords);
        assertEqual(coordKeys.length, positions.length,
          `${sportKey}/${nStr}/${layout.name} coord count matches position count`);
      }
    }
  }
}

suite('generateAutoLayout');
{
  const coords = run(ctx, "generateAutoLayout(['A','B','C','D','E'])");
  assertEqual(Object.keys(coords).length, 5, 'generates 5 coordinates');
  assert(coords['A'], 'coord for A exists');
  assert(coords['E'], 'coord for E exists');
  for (const [pos, [x, y]] of Object.entries(coords)) {
    assert(x > 0 && x < 100, `${pos} x in range`);
    assert(y >= 15 && y <= 85, `${pos} y in range`);
  }
}

export default function run_formations_tests() {}
