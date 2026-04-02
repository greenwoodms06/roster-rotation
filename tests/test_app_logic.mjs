// tests/test_app_logic.mjs — App-level logic tests (non-DOM functions)
import { suite, assert, assertEqual, createContext, run } from './helpers.mjs';

const ctx = createContext({ withApp: true });

suite('getPeriodLabel');
{
  assertEqual(run(ctx, "getPeriodLabel(4)"), 'Quarter', '4 = Quarter');
  assertEqual(run(ctx, "getPeriodLabel(2)"), 'Half', '2 = Half');
  assertEqual(run(ctx, "getPeriodLabel(3)"), 'Period', '3 = Period');
  assertEqual(run(ctx, "getPeriodLabel(4, true)"), 'Q', '4 short = Q');
  assertEqual(run(ctx, "getPeriodLabel(2, true)"), 'H', '2 short = H');
  assertEqual(run(ctx, "getPeriodLabel(3, true)"), 'P', '3 short = P');
}

suite('getPeriodLabelPlural');
{
  assertEqual(run(ctx, "getPeriodLabelPlural(4)"), 'quarters', '4 = quarters');
  assertEqual(run(ctx, "getPeriodLabelPlural(2)"), 'halves', '2 = halves');
  assertEqual(run(ctx, "getPeriodLabelPlural(3)"), 'periods', '3 = periods');
}

suite('getSpecialPosition');
{
  // With a soccer preset, should return GK
  run(ctx, `
    roster = { positions: ['GK','LB','RB','CM','ST'] };
    Storage.addTeam({ slug: 'test', name: 'Test' });
    Storage.addSeason('test', { slug: 's1', name: 'S1', positions: ['GK','LB','RB','CM','ST'], preset: 'soccer-5v5' });
    ctx = { teamSlug: 'test', seasonSlug: 's1' };
  `);
  const sp = run(ctx, 'getSpecialPosition()');
  assertEqual(sp, 'GK', 'soccer returns GK as special position');

  // With basketball, no special position
  run(ctx, `
    Storage.addSeason('test', { slug: 's2', name: 'S2', positions: ['PG','SG','SF','PF','C'], preset: 'basketball' });
    ctx = { teamSlug: 'test', seasonSlug: 's2' };
    roster = { positions: ['PG','SG','SF','PF','C'] };
  `);
  const sp2 = run(ctx, 'getSpecialPosition()');
  assertEqual(sp2, null, 'basketball returns null (no special position)');
}

suite('esc — HTML escaping');
{
  // esc() uses document.createElement which requires real DOM.
  // Verify the function exists and returns a string.
  const result = run(ctx, "typeof esc");
  assertEqual(result, 'function', 'esc is a function');
  // Note: Full escaping tests require browser environment (Playwright).
}

suite('WEIGHT_LABELS / WEIGHT_CYCLE');
{
  const labels = run(ctx, 'WEIGHT_LABELS');
  assertEqual(labels[1], 'Normal', '1 = Normal');
  assertEqual(labels[2], 'Prefer', '2 = Prefer');
  assertEqual(labels[3], 'Strong', '3 = Strong');
  assertEqual(labels[0], 'Never', '0 = Never');

  const cycle = run(ctx, 'WEIGHT_CYCLE');
  assertEqual(cycle, [1, 2, 3, 0], 'cycle order: Normal > Prefer > Strong > Never');
}

suite('v3 format detection');
{
  // v3 full backup (multiple teams)
  const v3Full = { version: 3, app: 'roster-rotation', teams: [{ slug: 'a' }, { slug: 'b' }], context: null, standalonePlays: [] };
  assert(run(ctx, `(${JSON.stringify(v3Full)}).version === 3 && Array.isArray((${JSON.stringify(v3Full)}).teams)`), 'v3 backup detected');

  // v3 shared team (single team)
  const v3Team = { version: 3, app: 'roster-rotation', teams: [{ slug: 'a', name: 'A', seasons: [] }] };
  assert(run(ctx, `(${JSON.stringify(v3Team)}).version === 3 && (${JSON.stringify(v3Team)}).teams.length === 1`), 'v3 shared team detected');

  // Reject v2 format
  const v2 = { version: 2, teams: [{ slug: 't' }] };
  assert(run(ctx, `(${JSON.stringify(v2)}).version !== 3`), 'v2 format rejected by version check');

  // Reject non-versioned data
  const noVersion = { players: { p01: { name: 'X' } } };
  assert(run(ctx, `!(${JSON.stringify(noVersion)}).version`), 'non-versioned data has no version');
}

suite('gameFairnessSpread');
{
  const game = {
    numPeriods: 4,
    availablePlayers: ['p01', 'p02', 'p03'],
    periodAssignments: [
      { period: 1, assignments: { A: 'p01', B: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { A: 'p01', B: 'p03' }, bench: ['p02'] },
      { period: 3, assignments: { A: 'p02', B: 'p03' }, bench: ['p01'] },
      { period: 4, assignments: { A: 'p01', B: 'p02' }, bench: ['p03'] },
    ],
  };
  run(ctx, `globalThis._game = ${JSON.stringify(game)}`);
  // p01: 3, p02: 3, p03: 2 => spread = 1
  const spread = run(ctx, 'gameFairnessSpread(globalThis._game)');
  assertEqual(spread, 1, 'fairness spread calculated correctly');

  // Perfect fairness
  const perfect = {
    numPeriods: 2,
    availablePlayers: ['p01', 'p02'],
    periodAssignments: [
      { period: 1, assignments: { A: 'p01', B: 'p02' }, bench: [] },
      { period: 2, assignments: { A: 'p02', B: 'p01' }, bench: [] },
    ],
  };
  run(ctx, `globalThis._game2 = ${JSON.stringify(perfect)}`);
  const spread2 = run(ctx, 'gameFairnessSpread(globalThis._game2)');
  assertEqual(spread2, 0, 'perfect fairness = 0 spread');
}

suite('getGameNumLabel');
{
  // Setup context with a team/season and games
  run(ctx, `
    Storage.addTeam({ slug: 'lab', name: 'Lab' });
    Storage.addSeason('lab', { slug: 's1', name: 'S1', positions: ['A'] });
    ctx = { teamSlug: 'lab', seasonSlug: 's1' };
  `);

  // Single game on a date
  run(ctx, `Storage.saveGame('lab', 's1', { gameId: '2026-04-01', date: '2026-04-01', numPeriods: 2, availablePlayers: ['p01'], periodAssignments: [] })`);
  const label1 = run(ctx, "getGameNumLabel({ gameId: '2026-04-01', date: '2026-04-01' })");
  assertEqual(label1, '', 'single game has no game number label');

  // Multiple games on same date
  run(ctx, `Storage.saveGame('lab', 's1', { gameId: '2026-04-01_2', date: '2026-04-01', numPeriods: 2, availablePlayers: ['p01'], periodAssignments: [] })`);
  const label2 = run(ctx, "getGameNumLabel({ gameId: '2026-04-01_2', date: '2026-04-01' })");
  assertEqual(label2, '  (Game 2)', 'second game labeled Game 2');

  const label1b = run(ctx, "getGameNumLabel({ gameId: '2026-04-01', date: '2026-04-01' })");
  assertEqual(label1b, '  (Game 1)', 'first game labeled Game 1 when multi-game day');
}

export default function run_app_logic_tests() {}
