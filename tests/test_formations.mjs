// tests/test_formations.mjs — SPORTS, presets, formations, preset matching
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

  // Every sport has name, icon, formats array
  for (const key of sportKeys) {
    const sport = run(ctx, `SPORTS['${key}']`);
    assert(sport.name, `${key} has name`);
    assert(sport.icon, `${key} has icon`);
    assert(Array.isArray(sport.formats), `${key} has formats array`);
    assert(sport.formats.length >= 1, `${key} has at least 1 format`);

    // Each format has key, name, positions
    for (const fmt of sport.formats) {
      assert(fmt.name, `${key}/${fmt.key} has name`);
      assert(Array.isArray(fmt.positions), `${key}/${fmt.key} has positions array`);
    }
  }
}

suite('SPORTS — soccer formats');
{
  const fmts = run(ctx, `SPORTS.soccer.formats.map(f => f.key)`);
  assert(fmts.includes('5v5'), 'soccer has 5v5');
  assert(fmts.includes('7v7'), 'soccer has 7v7');
  assert(fmts.includes('9v9'), 'soccer has 9v9');
  assert(fmts.includes('11v11'), 'soccer has 11v11');

  const pos5 = run(ctx, `SPORTS.soccer.formats.find(f=>f.key==='5v5').positions`);
  assertEqual(pos5.length, 5, 'soccer 5v5 has 5 positions');
  assert(pos5.includes('GK'), 'soccer 5v5 has GK');
}

suite('SPORTS — basketball formats');
{
  const fmts = run(ctx, `SPORTS.basketball.formats.map(f => f.key)`);
  assert(fmts.includes('3v3'), 'basketball has 3v3');

  const pos3 = run(ctx, `SPORTS.basketball.formats.find(f=>f.key==='3v3').positions`);
  assertEqual(pos3.length, 3, 'basketball 3v3 has 3 positions');
}

suite('POSITION_PRESETS — derived correctly');
{
  const presetKeys = run(ctx, 'Object.keys(POSITION_PRESETS)');
  assert(presetKeys.includes('soccer-5v5'), 'has soccer-5v5 preset');
  assert(presetKeys.includes('soccer-7v7'), 'has soccer-7v7 preset');
  assert(presetKeys.includes('basketball'), 'has basketball preset');
  assert(presetKeys.includes('basketball-3v3'), 'has basketball-3v3 preset');
  assert(presetKeys.includes('hockey'), 'has hockey preset');
  assert(presetKeys.includes('custom'), 'has custom preset');

  // Verify positions match SPORTS definitions
  const soccer7 = run(ctx, 'POSITION_PRESETS["soccer-7v7"]');
  assertEqual(soccer7.length, 7, 'soccer-7v7 has 7 positions');

  const bball3 = run(ctx, 'POSITION_PRESETS["basketball-3v3"]');
  assertEqual(bball3, ['G', 'F', 'C'], 'basketball-3v3 positions correct');
}

suite('SPORT_ICONS — derived correctly');
{
  const soccer7Icon = run(ctx, 'SPORT_ICONS["soccer-7v7"]');
  assert(soccer7Icon === '⚽', 'soccer-7v7 icon is soccer ball');

  const bballIcon = run(ctx, 'SPORT_ICONS["basketball"]');
  assert(bballIcon, 'basketball has icon');

  const bball3Icon = run(ctx, 'SPORT_ICONS["basketball-3v3"]');
  assertEqual(bballIcon, bball3Icon, 'basketball 3v3 shares sport icon');
}

suite('DEFAULT_POSITIONS');
{
  const dp = run(ctx, 'DEFAULT_POSITIONS');
  assertEqual(dp, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'], 'defaults to soccer-7v7');
}

suite('makePresetKey / parsePresetKey');
{
  assertEqual(run(ctx, "makePresetKey('soccer', '7v7')"), 'soccer-7v7', 'makes soccer-7v7');
  assertEqual(run(ctx, "makePresetKey('basketball', '')"), 'basketball', 'makes basketball (empty key)');
  assertEqual(run(ctx, "makePresetKey('basketball', '3v3')"), 'basketball-3v3', 'makes basketball-3v3');

  const parsed = run(ctx, "parsePresetKey('soccer-7v7')");
  assertEqual(parsed, { sport: 'soccer', format: '7v7' }, 'parses soccer-7v7');

  const parsed2 = run(ctx, "parsePresetKey('basketball')");
  assertEqual(parsed2, { sport: 'basketball', format: '' }, 'parses basketball');

  const parsed3 = run(ctx, "parsePresetKey('nonexistent')");
  assertEqual(parsed3, { sport: 'custom', format: '' }, 'unknown preset falls back to custom');
}

suite('matchPresetFromPositions');
{
  assertEqual(run(ctx, "matchPresetFromPositions(['GK','LB','RB','LW','CM','RW','ST'])"), 'soccer-7v7', 'matches soccer-7v7');
  assertEqual(run(ctx, "matchPresetFromPositions(['GK','LB','RB','CM','ST'])"), 'soccer-5v5', 'matches soccer-5v5');
  assertEqual(run(ctx, "matchPresetFromPositions(['G','F','C'])"), 'basketball-3v3', 'matches basketball-3v3');
  assertEqual(run(ctx, "matchPresetFromPositions(['PG','SG','SF','PF','C'])"), 'basketball', 'matches basketball 5v5');

  // Order shouldn't matter
  assertEqual(run(ctx, "matchPresetFromPositions(['ST','GK','CM','RB','LB'])"), 'soccer-5v5', 'matches regardless of order');

  // Unknown positions
  assertEqual(run(ctx, "matchPresetFromPositions(['X','Y','Z'])"), null, 'returns null for unknown');
}

suite('FORMATIONS — all presets have layouts');
{
  const formKeys = run(ctx, 'Object.keys(FORMATIONS)');

  // Key formations exist
  assert(formKeys.includes('soccer-5v5'), 'has soccer-5v5 formation');
  assert(formKeys.includes('soccer-7v7'), 'has soccer-7v7 formation');
  assert(formKeys.includes('basketball'), 'has basketball formation');
  assert(formKeys.includes('basketball-3v3'), 'has basketball-3v3 formation');
  assert(formKeys.includes('hockey'), 'has hockey formation');

  // Each formation has fieldType and at least one layout
  for (const key of formKeys) {
    const f = run(ctx, `FORMATIONS['${key}']`);
    assert(f.fieldType, `${key} has fieldType`);
    assert(f.layouts.length >= 1, `${key} has at least 1 layout`);

    // Each layout has name and coords
    for (const layout of f.layouts) {
      assert(layout.name, `${key}/${layout.name} has name`);
      assert(layout.coords, `${key}/${layout.name} has coords`);

      // Coords should match the preset's position count
      const presetKey = key;
      const presetPositions = run(ctx, `POSITION_PRESETS['${presetKey}'] || null`);
      if (presetPositions) {
        const coordKeys = Object.keys(layout.coords);
        assertEqual(coordKeys.length, presetPositions.length,
          `${key}/${layout.name} coord count matches preset`);
      }
    }
  }
}

suite('FORMATIONS — coord values are valid percentages');
{
  const formKeys = run(ctx, 'Object.keys(FORMATIONS)');
  for (const key of formKeys) {
    const f = run(ctx, `FORMATIONS['${key}']`);
    for (const layout of f.layouts) {
      for (const [pos, coord] of Object.entries(layout.coords)) {
        assert(coord[0] >= 0 && coord[0] <= 100, `${key}/${layout.name}/${pos} x in [0,100]`);
        assert(coord[1] >= 0 && coord[1] <= 100, `${key}/${layout.name}/${pos} y in [0,100]`);
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

  // All coords should be in valid range
  for (const [pos, [x, y]] of Object.entries(coords)) {
    assert(x > 0 && x < 100, `${pos} x in range`);
    assert(y >= 15 && y <= 85, `${pos} y in range`);
  }
}

export default function run_formations_tests() {}
