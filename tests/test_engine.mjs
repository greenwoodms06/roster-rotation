// tests/test_engine.mjs — Rotation Engine algorithm tests
import { suite, assert, assertEqual, assertThrows, assertApprox, createContext, run } from './helpers.mjs';

const ctx = createContext();

// ── Helper: build a roster with N players ──────────────────────
function makeRoster(n, positions, weights = {}) {
  const players = {};
  for (let i = 1; i <= n; i++) {
    const pid = 'p' + String(i).padStart(2, '0');
    players[pid] = { name: `Player ${i}`, positionWeights: weights[pid] || {} };
  }
  return { positions, players };
}

function pids(n) {
  return Array.from({ length: n }, (_, i) => 'p' + String(i + 1).padStart(2, '0'));
}

// ── Tests ────────────────────────────────────────────────────────

suite('Engine — basic generation');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false);
  `);
  const plan = run(ctx, 'globalThis._plan');

  assertEqual(plan.numPeriods, 4, 'plan has 4 periods');
  assertEqual(plan.availablePlayers.length, 10, 'plan has 10 available players');
  assertEqual(plan.periodAssignments.length, 4, 'plan has 4 period assignments');

  for (let i = 0; i < 4; i++) {
    const pa = plan.periodAssignments[i];
    assertEqual(Object.keys(pa.assignments).length, 7, `period ${i + 1} has 7 assignments`);
    assertEqual(pa.bench.length, 3, `period ${i + 1} has 3 benched`);
    assertEqual(pa.period, i + 1, `period ${i + 1} number is correct`);
  }
}

suite('Engine — equal playing time within a game');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._summary = getPlayerSummary(globalThis._plan);
  `);
  const summary = run(ctx, 'globalThis._summary');

  const played = Object.values(summary).map(s => s.periodsPlayed);
  const maxP = Math.max(...played);
  const minP = Math.min(...played);
  assert(maxP - minP <= 1, `playing time spread <= 1 (got ${minP}-${maxP})`);

  // 10 players, 7 positions, 4 periods = 28 slots. 28/10 = 2.8, so expect 2 or 3 each
  assert(minP >= 2, `minimum periods >= 2 (got ${minP})`);
  assert(maxP <= 3, `maximum periods <= 3 (got ${maxP})`);
}

suite('Engine — exact fit (7 players, 7 positions)');
{
  const roster = makeRoster(7, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(7))}, 4, false);
    globalThis._summary = getPlayerSummary(globalThis._plan);
  `);
  const summary = run(ctx, 'globalThis._summary');

  for (const s of Object.values(summary)) {
    assertEqual(s.periodsPlayed, 4, 'every player plays all 4 periods (exact fit)');
    assertEqual(s.benched, 0, 'no one benched (exact fit)');
  }
}

suite('Engine — minimum players error');
{
  const roster = makeRoster(5, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(roster)};`);

  assertThrows(() => {
    run(ctx, `
      globalThis._eng = new RotationEngine(globalThis._roster, {});
      eng.generateGamePlan('2026-03-25', ${JSON.stringify(pids(5))}, 4, false);
    `);
  }, 'throws when fewer players than positions');
}

suite('Engine — position exclusion (weight=0)');
{
  const weights = { p01: { GK: 0 }, p02: { GK: 0 }, p03: { GK: 0 } };
  const roster = makeRoster(8, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'], weights);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(8))}, 4, false);
  `);
  const plan = run(ctx, 'globalThis._plan');

  for (const pa of plan.periodAssignments) {
    assert(!['p01', 'p02', 'p03'].includes(pa.assignments['GK']),
      `excluded players not assigned to GK in period ${pa.period}`);
  }
}

suite('Engine — first_available_start');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, true);
  `);
  const plan = run(ctx, 'globalThis._plan');
  const p1players = Object.values(plan.periodAssignments[0].assignments);
  const starters = pids(7); // first 7

  for (const pid of starters) {
    assert(p1players.includes(pid), `starter ${pid} plays period 1`);
  }
}

suite('Engine — position locks');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
      locks: [{ pid: 'p01', position: 'GK' }]
    });
  `);
  const plan = run(ctx, 'globalThis._plan');

  for (const pa of plan.periodAssignments) {
    const p1Playing = Object.values(pa.assignments).includes('p01');
    if (p1Playing) {
      assertEqual(pa.assignments['GK'], 'p01', `p01 locked to GK in period ${pa.period}`);
    }
  }
}

suite('Engine — lock validation errors');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST'],
    { p01: { GK: 0 } });
  run(ctx, `globalThis._roster = ${JSON.stringify(roster)};`);

  assertThrows(() => {
    run(ctx, `
      globalThis._eng = new RotationEngine(globalThis._roster, {});
      eng.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
        locks: [{ pid: 'p01', position: 'GK' }]
      });
    `);
  }, 'throws when player locked to excluded position');

  assertThrows(() => {
    run(ctx, `
      globalThis._eng = new RotationEngine(globalThis._roster, {});
      eng.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
        locks: [{ pid: 'p02', position: 'GK' }, { pid: 'p03', position: 'GK' }]
      });
    `);
  }, 'throws when two players locked to same position');
}

suite('Engine — specialPosMax');
{
  const roster = makeRoster(8, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(8))}, 4, false, {
      specialPosMax: 1
    });
  `);
  const plan = run(ctx, 'globalThis._plan');

  // Count GK assignments per player
  const gkCounts = {};
  for (const pa of plan.periodAssignments) {
    const gkPid = pa.assignments['GK'];
    gkCounts[gkPid] = (gkCounts[gkPid] || 0) + 1;
  }
  for (const [pid, count] of Object.entries(gkCounts)) {
    assert(count <= 1, `player ${pid} plays GK at most 1 time (got ${count})`);
  }
}

suite('Engine — continuity (high keeps same positions)');
{
  const roster = makeRoster(7, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(7))}, 4, false, {
      continuity: 2
    });
  `);
  const plan = run(ctx, 'globalThis._plan');

  // With 7 players = 7 positions (exact fit) and high continuity,
  // each player should keep the same position across all periods
  const p1Assignments = plan.periodAssignments[0].assignments;
  let sameCount = 0;
  let totalChecks = 0;
  for (let i = 1; i < plan.periodAssignments.length; i++) {
    for (const [pos, pid] of Object.entries(p1Assignments)) {
      totalChecks++;
      if (plan.periodAssignments[i].assignments[pos] === pid) sameCount++;
    }
  }
  // With exact fit + high continuity, should be 100% same positions
  assertEqual(sameCount, totalChecks, 'all positions maintained with high continuity (exact fit)');
}

suite('Engine — season deficit prioritization');
{
  const roster = makeRoster(8, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  // p01 has played less (season deficit)
  const stats = {
    p01: { gamesAttended: 2, totalPeriodsPlayed: 4, totalPeriodsAvailable: 8, periodsByPosition: {} },
    p02: { gamesAttended: 2, totalPeriodsPlayed: 7, totalPeriodsAvailable: 8, periodsByPosition: {} },
  };
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, ${JSON.stringify(stats)});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(8))}, 4, false);
    globalThis._summary = getPlayerSummary(globalThis._plan);
  `);
  const summary = run(ctx, 'globalThis._summary');

  assert(summary.p01.periodsPlayed >= summary.p02.periodsPlayed,
    'deficit player (p01) plays at least as much as surplus player (p02)');
}

suite('Engine — 2 halves format');
{
  const roster = makeRoster(9, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(9))}, 2, false);
  `);
  const plan = run(ctx, 'globalThis._plan');
  assertEqual(plan.periodAssignments.length, 2, 'generates 2 halves');
  assertEqual(Object.keys(plan.periodAssignments[0].assignments).length, 7, '7 players assigned per half');
}

suite('Engine — different position counts (5v5)');
{
  const roster = makeRoster(7, ['GK', 'LB', 'RB', 'CM', 'ST']);
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(7))}, 4, false);
  `);
  const plan = run(ctx, 'globalThis._plan');
  assertEqual(Object.keys(plan.periodAssignments[0].assignments).length, 5, '5 assignments for 5v5');
  assertEqual(plan.periodAssignments[0].bench.length, 2, '2 benched for 5v5 with 7 players');
}

suite('Engine — getPlayerSummary');
{
  const plan = {
    availablePlayers: ['p01', 'p02', 'p03'],
    numPeriods: 2,
    periodAssignments: [
      { period: 1, assignments: { GK: 'p01', ST: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { GK: 'p03', ST: 'p01' }, bench: ['p02'] },
    ],
  };
  run(ctx, `globalThis._plan = ${JSON.stringify(plan)};`);
  const summary = run(ctx, 'getPlayerSummary(globalThis._plan)');

  assertEqual(summary.p01.periodsPlayed, 2, 'p01 played 2');
  assertEqual(summary.p01.benched, 0, 'p01 benched 0');
  assertEqual(summary.p01.positions, ['GK', 'ST'], 'p01 positions');
  assertEqual(summary.p02.periodsPlayed, 1, 'p02 played 1');
  assertEqual(summary.p02.benched, 1, 'p02 benched 1');
  assertEqual(summary.p03.periodsPlayed, 1, 'p03 played 1');
}

export default function run_engine_tests() {}

// ── globalMaxPeriods constraint tests ─────────────────────────

suite('Engine — globalMaxPeriods caps playing time');
{
  // 10 players, 7 positions, 4 quarters, max 3 per player
  const roster10 = makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(roster10)};`);
  const capPlan = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
      globalMaxPeriods: 3
    });
  `);

  // No player should play more than 3 periods
  const capCounts = {};
  for (const pa of capPlan.periodAssignments) {
    for (const pid of Object.values(pa.assignments)) {
      capCounts[pid] = (capCounts[pid] || 0) + 1;
    }
  }
  for (const [pid, c] of Object.entries(capCounts)) {
    assert(c <= 3, `${pid} plays at most 3 periods (got ${c})`);
  }
  // All 28 slots should still be filled (7 positions × 4 periods)
  let capSlots = 0;
  for (const pa of capPlan.periodAssignments) {
    capSlots += Object.keys(pa.assignments).length;
  }
  assertEqual(capSlots, 28, 'all 28 slots filled with cap=3');
}

suite('Engine — globalMaxPeriods null behaves like no cap');
{
  const rosterNull = makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(rosterNull)};`);
  const nullPlan = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
      globalMaxPeriods: null
    });
  `);

  assertEqual(nullPlan.periodAssignments.length, 4, 'null cap: 4 periods generated');
  for (let i = 0; i < nullPlan.periodAssignments.length; i++) {
    assertEqual(Object.keys(nullPlan.periodAssignments[i].assignments).length, 7, `null cap: period ${i+1} has 7 assignments`);
  }
}

suite('Engine — globalMaxPeriods error when too restrictive');
{
  // 8 players, 7 positions, 4 quarters, max 1 → 8 slots < 28 needed
  const rosterErr = makeRoster(8, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(rosterErr)};`);
  assertThrows(() => {
    run(ctx, `
      globalThis._eng = new RotationEngine(globalThis._roster, {});
      eng.generateGamePlan('2026-03-25', ${JSON.stringify(pids(8))}, 4, false, {
        globalMaxPeriods: 1
      });
    `);
  }, 'throws when cap is too low to fill game');
}

suite('Engine — globalMaxPeriods with positionMax both enforced');
{
  // 10 players, 7 positions, 4 quarters, max 3 global + max 1 at GK
  const rosterBoth = makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(rosterBoth)};`);
  const bothPlan = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false, {
      globalMaxPeriods: 3,
      positionMax: { GK: 1 }
    });
  `);

  const bothCounts = {};
  const bothGkCounts = {};
  for (const pa of bothPlan.periodAssignments) {
    for (const [pos, pid] of Object.entries(pa.assignments)) {
      bothCounts[pid] = (bothCounts[pid] || 0) + 1;
      if (pos === 'GK') bothGkCounts[pid] = (bothGkCounts[pid] || 0) + 1;
    }
  }
  for (const [pid, c] of Object.entries(bothCounts)) {
    assert(c <= 3, `both constraints: ${pid} plays at most 3 globally (got ${c})`);
  }
  for (const [pid, c] of Object.entries(bothGkCounts)) {
    assert(c <= 1, `both constraints: ${pid} plays GK at most 1 (got ${c})`);
  }
}

// ── rebalanceFromPeriod tests ─────────────────────────────────

suite('Engine — rebalanceFromPeriod frozen periods unchanged');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']))};`);

  const rebResult = run(ctx, `
    globalThis._eng = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._frozenOrig = JSON.stringify(globalThis._plan.periodAssignments.slice(0, 2));
    globalThis._reb = globalThis._eng.rebalanceFromPeriod(globalThis._plan, 2, [], {});
    globalThis._frozenAfter = JSON.stringify(globalThis._reb.periodAssignments.slice(0, 2));
    ({ frozenOrig: globalThis._frozenOrig, frozenAfter: globalThis._frozenAfter, numPAs: globalThis._reb.periodAssignments.length });
  `);

  assertEqual(rebResult.frozenOrig, rebResult.frozenAfter, 'frozen periods are byte-identical');
  assertEqual(rebResult.numPAs, 4, 'still has 4 period assignments');
}

suite('Engine — rebalanceFromPeriod period numbers correct');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']))};`);

  const periods = run(ctx, `
    globalThis._eng = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._reb = globalThis._eng.rebalanceFromPeriod(globalThis._plan, 2, [], {});
    globalThis._reb.periodAssignments.map(function(pa) { return pa.period; });
  `);

  assertEqual(periods, [1, 2, 3, 4], 'period numbers are 1,2,3,4');
}

suite('Engine — rebalanceFromPeriod late arrival appears');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(11, ['GK','CB','LB','RB','CM','LW','ST']))};`);

  const lateResult = run(ctx, `
    globalThis._eng = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._reb = globalThis._eng.rebalanceFromPeriod(globalThis._plan, 2, ['p11'], {});
    ({
      available: globalThis._reb.availablePlayers,
      q3players: Object.values(globalThis._reb.periodAssignments[2].assignments),
      q4players: Object.values(globalThis._reb.periodAssignments[3].assignments),
      q3bench: globalThis._reb.periodAssignments[2].bench,
      q4bench: globalThis._reb.periodAssignments[3].bench,
    });
  `);

  assert(lateResult.available.includes('p11'), 'p11 in availablePlayers');
  const p11InQ3 = lateResult.q3players.includes('p11') || lateResult.q3bench.includes('p11');
  const p11InQ4 = lateResult.q4players.includes('p11') || lateResult.q4bench.includes('p11');
  assert(p11InQ3 || p11InQ4, 'p11 appears in Q3 or Q4');
  const p11Plays = (lateResult.q3players.includes('p11') ? 1 : 0) + (lateResult.q4players.includes('p11') ? 1 : 0);
  assert(p11Plays >= 1, 'late arrival p11 plays at least 1 remaining period');
}

suite('Engine — rebalanceFromPeriod bench is correct');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']))};`);

  const benchResult = run(ctx, `
    globalThis._eng = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._reb = globalThis._eng.rebalanceFromPeriod(globalThis._plan, 1, [], {});
    globalThis._reb.periodAssignments.map(function(pa) {
      return {
        onField: Object.values(pa.assignments).sort(),
        bench: pa.bench.sort(),
        total: Object.values(pa.assignments).length + pa.bench.length,
      };
    });
  `);

  for (let i = 0; i < benchResult.length; i++) {
    assertEqual(benchResult[i].total, 10, `period ${i+1}: field + bench = 10`);
    const fieldSet = new Set(benchResult[i].onField);
    const benchOverlap = benchResult[i].bench.filter(p => fieldSet.has(p));
    assertEqual(benchOverlap.length, 0, `period ${i+1}: no player on field and bench`);
  }
}

suite('Engine — rebalanceFromPeriod fair playing time');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']))};`);

  const fairResult = run(ctx, `
    globalThis._eng = new RotationEngine(globalThis._roster, {});
    globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
    globalThis._reb = globalThis._eng.rebalanceFromPeriod(globalThis._plan, 2, [], {});
    globalThis._rc = {};
    for (var i = 0; i < globalThis._reb.periodAssignments.length; i++) {
      var pids2 = Object.values(globalThis._reb.periodAssignments[i].assignments);
      for (var j = 0; j < pids2.length; j++) {
        globalThis._rc[pids2[j]] = (globalThis._rc[pids2[j]] || 0) + 1;
      }
    }
    var vals = Object.values(globalThis._rc);
    ({ min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) });
  `);

  const spread = fairResult.max - fairResult.min;
  assert(spread <= 1, `playing time spread <= 1 (got ${spread}: min=${fairResult.min}, max=${fairResult.max})`);
}

suite('Engine — rebalanceFromPeriod no remaining error');
{
  run(ctx, `globalThis._roster = ${JSON.stringify(makeRoster(10, ['GK','CB','LB','RB','CM','LW','ST']))};`);
  assertThrows(() => {
    run(ctx, `
      globalThis._eng = new RotationEngine(globalThis._roster, {});
      globalThis._plan = globalThis._eng.generateGamePlan('2026-04-01', ${JSON.stringify(pids(10))}, 4, false);
      globalThis._eng.rebalanceFromPeriod(globalThis._plan, 4, [], {});
    `);
  }, 'throws when no periods remaining');
}

suite('Engine — 9 players firstAvailableStart no empty positions');
{
  const roster9 = makeRoster(9, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(roster9)};`);
  const plan9 = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._engine.generateGamePlan('2026-04-01', ${JSON.stringify(pids(9))}, 4, true);
  `);

  assertEqual(plan9.periodAssignments.length, 4, '9 players: 4 periods generated');
  for (let i = 0; i < 4; i++) {
    const pa = plan9.periodAssignments[i];
    assertEqual(Object.keys(pa.assignments).length, 7, `9 players: period ${i+1} has 7 assignments`);
    for (const [pos, pid] of Object.entries(pa.assignments)) {
      assert(pid && pid.startsWith('p'), `9 players: period ${i+1} ${pos} has a valid player (got ${pid})`);
    }
  }

  // Verify first 7 are starters in period 1
  const p1players = Object.values(plan9.periodAssignments[0].assignments);
  for (const pid of pids(7)) {
    assert(p1players.includes(pid), `9 players: starter ${pid} plays period 1`);
  }
}

suite('Engine — 8 players firstAvailableStart no empty positions');
{
  const roster8 = makeRoster(8, ['GK','CB','LB','RB','CM','LW','ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(roster8)};`);
  const plan8 = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, {});
    globalThis._engine.generateGamePlan('2026-04-01', ${JSON.stringify(pids(8))}, 4, true);
  `);

  for (let i = 0; i < 4; i++) {
    const pa = plan8.periodAssignments[i];
    assertEqual(Object.keys(pa.assignments).length, 7, `8 players: period ${i+1} has 7 assignments`);
    for (const [pos, pid] of Object.entries(pa.assignments)) {
      assert(pid && pid.startsWith('p'), `8 players: period ${i+1} ${pos} has a valid player (got ${pid})`);
    }
  }
}

suite('Engine — 9 players firstAvailableStart non-starter gets extra period');
{
  // Give starters (p01-p07) season stats so they have higher ratio (lower priority)
  // Leave p08-p09 with no stats (score=-1, highest priority for extra periods)
  const roster9s = makeRoster(9, ['GK','CB','LB','RB','CM','LW','ST']);
  const seasonStats = {};
  for (let i = 1; i <= 7; i++) {
    const pid = 'p' + String(i).padStart(2, '0');
    seasonStats[pid] = { gamesAttended: 3, totalPeriodsPlayed: 9, totalPeriodsAvailable: 12, periodsByPosition: {} };
  }
  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster9s)};
    globalThis._stats = ${JSON.stringify(seasonStats)};
  `);
  const plan9s = run(ctx, `
    globalThis._engine = new RotationEngine(globalThis._roster, globalThis._stats);
    globalThis._engine.generateGamePlan('2026-04-01', ${JSON.stringify(pids(9))}, 4, true);
  `);

  for (let i = 0; i < 4; i++) {
    const pa = plan9s.periodAssignments[i];
    assertEqual(Object.keys(pa.assignments).length, 7, `9p season-stats: period ${i+1} has 7 assignments`);
    for (const [pos, pid] of Object.entries(pa.assignments)) {
      assert(pid && pid.startsWith('p'), `9p season-stats: period ${i+1} ${pos} has valid player (got ${pid})`);
    }
  }

  // p08 or p09 (non-starters) should still only play at most 3 periods
  const counts = {};
  for (const pa of plan9s.periodAssignments) {
    for (const pid of Object.values(pa.assignments)) {
      counts[pid] = (counts[pid] || 0) + 1;
    }
  }
  assert((counts['p08'] || 0) <= 3, `non-starter p08 plays at most 3 (got ${counts['p08'] || 0})`);
  assert((counts['p09'] || 0) <= 3, `non-starter p09 plays at most 3 (got ${counts['p09'] || 0})`);
}

suite('Engine — jitter produces varied but fair plans');
{
  const roster = makeRoster(10, ['GK', 'LB', 'RB', 'LW', 'CM', 'RW', 'ST']);
  run(ctx, `globalThis._roster = ${JSON.stringify(roster)};`);

  // Generate multiple plans and check that:
  // 1. All plans are structurally valid (fairness holds)
  // 2. Not all plans are identical (jitter introduces variety)
  const plans = [];
  for (let trial = 0; trial < 5; trial++) {
    run(ctx, `
      globalThis._engine = new RotationEngine(globalThis._roster, {});
      globalThis._plan = globalThis._engine.generateGamePlan('2026-03-25', ${JSON.stringify(pids(10))}, 4, false);
    `);
    const plan = run(ctx, 'globalThis._plan');
    plans.push(plan);

    // Verify fairness invariant holds for each plan
    const summary = {};
    for (const pid of plan.availablePlayers) summary[pid] = 0;
    for (const pa of plan.periodAssignments) {
      assertEqual(Object.keys(pa.assignments).length, 7, `trial ${trial}: period has 7 assignments`);
      for (const pid of Object.values(pa.assignments)) summary[pid]++;
    }
    const played = Object.values(summary);
    const spread = Math.max(...played) - Math.min(...played);
    assert(spread <= 1, `trial ${trial}: playing time spread <= 1 (got ${spread})`);
  }

  // Check for variety: serialize position assignments and see if at least 2 differ
  const sigs = plans.map(p =>
    p.periodAssignments.map(pa =>
      Object.entries(pa.assignments).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}:${v}`).join(',')
    ).join('|')
  );
  const unique = new Set(sigs).size;
  assert(unique >= 2, `jitter produces variety: ${unique} unique plans out of 5`);
}
