// tests/test_credit.mjs — v4 Fractional Credit System tests
import { suite, assert, assertEqual, assertThrows, assertApprox, assertNoThrow, createContext, run } from './helpers.mjs';

function freshCtx() { return createContext(); }

// ── Credit Arithmetic ───────────────────────────────────────────────

suite('entryCredit — basic');
{
  const ctx = freshCtx();
  assertApprox(
    run(ctx, "entryCredit({ pid: 'p01', timeIn: 0.0, timeOut: 1.0 })"),
    1.0, 0.001, 'full period = 1.0'
  );
  assertApprox(
    run(ctx, "entryCredit({ pid: 'p01', timeIn: 0.0, timeOut: 0.5 })"),
    0.5, 0.001, 'half period = 0.5'
  );
  assertApprox(
    run(ctx, "entryCredit({ pid: 'p01', timeIn: 0.25, timeOut: 0.75 })"),
    0.5, 0.001, 'middle half = 0.5'
  );
  assertApprox(
    run(ctx, "entryCredit({ pid: 'p01', timeIn: 0.0, timeOut: 1/3 })"),
    1/3, 0.001, 'one third'
  );
}

suite('slotCredit — single and multiple entries');
{
  const ctx = freshCtx();
  assertApprox(
    run(ctx, "slotCredit([{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }])"),
    1.0, 0.001, 'single full entry'
  );
  assertApprox(
    run(ctx, "slotCredit([{ pid: 'p01', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }])"),
    1.0, 0.001, 'two halves sum to 1.0'
  );
  assertApprox(
    run(ctx, "slotCredit([{ pid: 'p01', timeIn: 0.0, timeOut: 1/3 }, { pid: 'p02', timeIn: 1/3, timeOut: 1.0 }])"),
    1.0, 0.001, 'third + two-thirds sums to 1.0'
  );
}

suite('slotRemaining');
{
  const ctx = freshCtx();
  assertApprox(
    run(ctx, "slotRemaining([{ pid: 'p01', timeIn: 0.0, timeOut: 0.25 }])"),
    0.75, 0.001, '0.75 remaining after quarter'
  );
  assertApprox(
    run(ctx, "slotRemaining([{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }])"),
    0.0, 0.001, 'nothing remaining after full period'
  );
}

suite('playerCreditInSlot — single entry');
{
  const ctx = freshCtx();
  assertApprox(
    run(ctx, "playerCreditInSlot([{ pid: 'p01', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }], 'p01')"),
    0.5, 0.001, 'p01 gets 0.5'
  );
  assertApprox(
    run(ctx, "playerCreditInSlot([{ pid: 'p01', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }], 'p02')"),
    0.5, 0.001, 'p02 gets 0.5'
  );
  assertApprox(
    run(ctx, "playerCreditInSlot([{ pid: 'p01', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }], 'p03')"),
    0.0, 0.001, 'p03 not in slot = 0'
  );
}

suite('playerCreditInSlot — re-entry (same pid twice)');
{
  const ctx = freshCtx();
  // p02 plays 0.0→0.25 and 0.75→1.0 = total 0.5
  assertApprox(
    run(ctx, `playerCreditInSlot([
      { pid: 'p02', timeIn: 0.0, timeOut: 0.25 },
      { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
      { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }
    ], 'p02')`),
    0.5, 0.001, 'p02 re-entry aggregates to 0.5'
  );
  assertApprox(
    run(ctx, `playerCreditInSlot([
      { pid: 'p02', timeIn: 0.0, timeOut: 0.25 },
      { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
      { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }
    ], 'p08')`),
    0.5, 0.001, 'p08 gets 0.5'
  );
}

suite('occupantAtTime');
{
  const ctx = freshCtx();
  run(ctx, `globalThis._occ = [
    { pid: 'p01', timeIn: 0.0, timeOut: 0.5 },
    { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }
  ]`);

  const atStart = run(ctx, "occupantAtTime(globalThis._occ, 0.0)");
  assertEqual(atStart.pid, 'p01', 'at t=0.0 -> p01');

  const atMid = run(ctx, "occupantAtTime(globalThis._occ, 0.25)");
  assertEqual(atMid.pid, 'p01', 'at t=0.25 -> p01');

  const atBoundary = run(ctx, "occupantAtTime(globalThis._occ, 0.5)");
  assertEqual(atBoundary.pid, 'p02', 'at t=0.5 boundary -> p02 (new occupant)');

  const atLate = run(ctx, "occupantAtTime(globalThis._occ, 0.9)");
  assertEqual(atLate.pid, 'p02', 'at t=0.9 -> p02');

  const atEnd = run(ctx, "occupantAtTime(globalThis._occ, 1.0)");
  assertEqual(atEnd, null, 'at t=1.0 -> null (period over)');
}

// ── Rest arithmetic — no floating point drift ───────────────────────

suite('Rest produces exact 1.0 sum');
{
  const ctx = freshCtx();
  // Two 1/3 entries, rest should be exactly 1.0 - 2/3
  const remaining = run(ctx, `
    const existing = [
      { pid: 'p01', timeIn: 0.0, timeOut: 1/3 },
      { pid: 'p02', timeIn: 1/3, timeOut: 2/3 }
    ];
    const rem = slotRemaining(existing);
    // Simulate Rest: new entry timeIn = 2/3, timeOut = 2/3 + rem = 1.0
    const withRest = [...existing, { pid: 'p03', timeIn: 2/3, timeOut: 2/3 + rem }];
    slotCredit(withRest);
  `);
  assertApprox(remaining, 1.0, 0.001, 'rest after two thirds sums to exactly 1.0');
}

// ── Format Conversion ───────────────────────────────────────────────

suite('wrapEngineOutput — v3 to v4');
{
  const ctx = freshCtx();
  const wrapped = run(ctx, `wrapEngineOutput({ GK: 'p01', CB: 'p02' })`);
  assert(Array.isArray(wrapped.GK), 'GK is array');
  assertEqual(wrapped.GK.length, 1, 'GK has one entry');
  assertEqual(wrapped.GK[0].pid, 'p01', 'GK pid correct');
  assertApprox(wrapped.GK[0].timeIn, 0.0, 0.001, 'GK timeIn = 0');
  assertApprox(wrapped.GK[0].timeOut, 1.0, 0.001, 'GK timeOut = 1');
  assertEqual(wrapped.CB[0].pid, 'p02', 'CB pid correct');
}

suite('wrapEngineOutput — idempotent on v4');
{
  const ctx = freshCtx();
  const result = run(ctx, `wrapEngineOutput({
    GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }]
  })`);
  assertEqual(result.GK.length, 2, 'preserves two entries');
  assertEqual(result.GK[0].pid, 'p01', 'first entry preserved');
  assertEqual(result.GK[1].pid, 'p02', 'second entry preserved');
}

suite('v4AssignmentsToPrimary');
{
  const ctx = freshCtx();
  const primary = run(ctx, `v4AssignmentsToPrimary({
    GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
    CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1.0 }]
  })`);
  assertEqual(primary.GK, 'p01', 'GK primary is sole occupant');
  assertEqual(primary.CB, 'p03', 'CB primary is last occupant (most recent)');
}

suite('v4AssignmentsToPrimary — passthrough for v3');
{
  const ctx = freshCtx();
  const primary = run(ctx, `v4AssignmentsToPrimary({ GK: 'p01', CB: 'p02' })`);
  assertEqual(primary.GK, 'p01', 'v3 string passed through');
  assertEqual(primary.CB, 'p02', 'v3 string passed through');
}

suite('extractPidsFromAssignments — v4');
{
  const ctx = freshCtx();
  const pids = run(ctx, `extractPidsFromAssignments({
    GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
    CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1.0 }]
  })`);
  assertEqual(pids.sort(), ['p01', 'p02', 'p03'], 'all pids extracted');
}

suite('extractPidsFromAssignments — v3 fallback');
{
  const ctx = freshCtx();
  const pids = run(ctx, `extractPidsFromAssignments({ GK: 'p01', CB: 'p02' })`);
  assertEqual(pids.sort(), ['p01', 'p02'], 'v3 pids extracted');
}

suite('extractPidsFromAssignments — re-entry deduplication');
{
  const ctx = freshCtx();
  const pids = run(ctx, `extractPidsFromAssignments({
    CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.25 },
         { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
         { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }]
  })`);
  assertEqual(pids.sort(), ['p02', 'p08'], 're-entry pid appears once');
}

suite('isV4Assignments');
{
  const ctx = freshCtx();
  assertEqual(run(ctx, "isV4Assignments({ GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }] })"), true, 'v4 detected');
  assertEqual(run(ctx, "isV4Assignments({ GK: 'p01' })"), false, 'v3 detected');
  assertEqual(run(ctx, "isV4Assignments({})"), true, 'empty is valid v4');
}

// ── Validation ──────────────────────────────────────────────────────

suite('validateSlot — valid cases');
{
  const ctx = freshCtx();
  assertEqual(
    run(ctx, "validateSlot([{ pid: 'p01', timeIn: 0, timeOut: 1 }])"),
    null, 'single full entry is valid'
  );
  assertEqual(
    run(ctx, "validateSlot([{ pid: 'p01', timeIn: 0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }])"),
    null, 'two halves is valid'
  );
  // Re-entry: valid
  assertEqual(
    run(ctx, `validateSlot([
      { pid: 'p02', timeIn: 0.0, timeOut: 0.25 },
      { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
      { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }
    ])`),
    null, 'valid re-entry (same pid, non-overlapping)'
  );
}

suite('validateSlot — rejects bad data');
{
  const ctx = freshCtx();
  // timeIn >= timeOut
  const r1 = run(ctx, "validateSlot([{ pid: 'p01', timeIn: 0.5, timeOut: 0.5 }])");
  assert(r1 !== null, 'rejects timeIn == timeOut');

  // Overlapping entries
  const r2 = run(ctx, "validateSlot([{ pid: 'p01', timeIn: 0, timeOut: 0.6 }, { pid: 'p02', timeIn: 0.4, timeOut: 1.0 }])");
  assert(r2 !== null, 'rejects overlapping entries');

  // Sum != 1.0
  const r3 = run(ctx, "validateSlot([{ pid: 'p01', timeIn: 0, timeOut: 0.5 }])");
  assert(r3 !== null, 'rejects sum < 1.0');
  assert(r3.includes('0.500'), 'error message includes actual sum');

  // Empty
  const r4 = run(ctx, "validateSlot([])");
  assert(r4 !== null, 'rejects empty array');
}

suite('validatePeriodAssignment');
{
  const ctx = freshCtx();
  assertEqual(
    run(ctx, `validatePeriodAssignment({
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
        CB: [{ pid: 'p02', timeIn: 0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1 }]
      }
    })`),
    null, 'valid period assignment'
  );

  const err = run(ctx, `validatePeriodAssignment({
    assignments: {
      GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
      CB: [{ pid: 'p02', timeIn: 0, timeOut: 0.3 }]
    }
  })`);
  assert(err !== null && err.startsWith('CB:'), 'error identifies position CB');
}

// ── Migration ───────────────────────────────────────────────────────

suite('migrateGamesToV4 — v3 game');
{
  const ctx = freshCtx();
  const migrated = run(ctx, `migrateGamesToV4([{
    date: '2026-03-22', numPeriods: 2, availablePlayers: ['p01','p02','p03'],
    periodAssignments: [
      { period: 1, assignments: { GK: 'p01', CB: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { GK: 'p02', CB: 'p01' }, bench: ['p03'] }
    ]
  }])`);

  const pa1 = migrated[0].periodAssignments[0];
  assert(Array.isArray(pa1.assignments.GK), 'GK is now array');
  assertEqual(pa1.assignments.GK[0].pid, 'p01', 'GK pid preserved');
  assertApprox(pa1.assignments.GK[0].timeIn, 0.0, 0.001, 'timeIn = 0');
  assertApprox(pa1.assignments.GK[0].timeOut, 1.0, 0.001, 'timeOut = 1');
  assertEqual(pa1.bench, ['p03'], 'bench unchanged');
}

suite('migrateGamesToV4 — v4 passthrough');
{
  const ctx = freshCtx();
  const input = [{
    date: '2026-03-22', numPeriods: 1, availablePlayers: ['p01'],
    periodAssignments: [{
      period: 1,
      assignments: { GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }] },
      bench: []
    }]
  }];
  const migrated = run(ctx, `migrateGamesToV4(${JSON.stringify(input)})`);
  assertEqual(migrated[0].periodAssignments[0].assignments.GK[0].pid, 'p01', 'already v4 passes through');
}

suite('migrateGamesToV4 — mixed v3/v4 periods');
{
  const ctx = freshCtx();
  const migrated = run(ctx, `migrateGamesToV4([{
    date: '2026-03-22', numPeriods: 2, availablePlayers: ['p01','p02'],
    periodAssignments: [
      { period: 1, assignments: { GK: 'p01' }, bench: ['p02'] },
      { period: 2, assignments: { GK: [{ pid: 'p02', timeIn: 0, timeOut: 1 }] }, bench: ['p01'] }
    ]
  }])`);
  assert(Array.isArray(migrated[0].periodAssignments[0].assignments.GK), 'period 1 migrated');
  assert(Array.isArray(migrated[0].periodAssignments[1].assignments.GK), 'period 2 already v4');
}

// ── Display Helpers ─────────────────────────────────────────────────

suite('fmtPeriods');
{
  const ctx = freshCtx();
  assertEqual(run(ctx, "fmtPeriods(9)"), '9', 'integer shows as integer');
  assertEqual(run(ctx, "fmtPeriods(0)"), '0', 'zero shows as zero');
  assertEqual(run(ctx, "fmtPeriods(8.667)"), '8.7', 'fractional shows one decimal');
  assertEqual(run(ctx, "fmtPeriods(8.005)"), '8', 'near-integer rounds to integer');
  assertEqual(run(ctx, "fmtPeriods(3.5)"), '3.5', 'exact half shows .5');
  assertEqual(run(ctx, "fmtPeriods(1.0)"), '1', '1.0 shows as 1');
  assertEqual(run(ctx, "fmtPeriods(2.999)"), '3', '2.999 rounds to 3');
}

// ── Storage: auto-migration on load ─────────────────────────────────

suite('Storage — loadAllGames auto-migrates v3 to v4');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','CB'] })");

  // Write raw v3 data directly to localStorage
  run(ctx, `localStorage.setItem('rot_t1_s1_games', JSON.stringify([{
    gameId: 'g1', date: '2026-04-01', numPeriods: 2,
    availablePlayers: ['p01','p02','p03'],
    periodAssignments: [
      { period: 1, assignments: { GK: 'p01', CB: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { GK: 'p02', CB: 'p01' }, bench: ['p03'] }
    ]
  }]))`);

  const games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  assert(Array.isArray(games[0].periodAssignments[0].assignments.GK), 'auto-migrated to v4');
  assertEqual(games[0].periodAssignments[0].assignments.GK[0].pid, 'p01', 'pid preserved');

  // Verify it was re-saved — loading raw should now be v4
  const raw = run(ctx, "JSON.parse(localStorage.getItem('rot_t1_s1_games'))");
  assert(Array.isArray(raw[0].periodAssignments[0].assignments.GK), 're-saved as v4');
}

// ── Storage: getSeasonStats with fractional data ────────────────────

suite('Storage — getSeasonStats with v4 fractional data');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','CB'] })");

  // Save a game with fractional assignments
  run(ctx, `Storage.saveGame('t1', 's1', {
    gameId: 'g1', date: '2026-04-01', numPeriods: 1,
    availablePlayers: ['p01','p02','p03'],
    periodAssignments: [{
      period: 1,
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
        CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1.0 }]
      },
      bench: []
    }]
  })`);

  const stats = run(ctx, "Storage.getSeasonStats('t1', 's1')");
  assertApprox(stats.p01.totalPeriodsPlayed, 1.0, 0.001, 'p01 played 1.0');
  assertApprox(stats.p02.totalPeriodsPlayed, 0.5, 0.001, 'p02 played 0.5 (first half)');
  assertApprox(stats.p03.totalPeriodsPlayed, 0.5, 0.001, 'p03 played 0.5 (second half)');
  assertApprox(stats.p02.periodsByPosition.CB, 0.5, 0.001, 'p02 CB = 0.5');
  assertApprox(stats.p03.periodsByPosition.CB, 0.5, 0.001, 'p03 CB = 0.5');
}

suite('Storage — getSeasonStats with re-entry');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','CB'] })");

  run(ctx, `Storage.saveGame('t1', 's1', {
    gameId: 'g1', date: '2026-04-01', numPeriods: 1,
    availablePlayers: ['p01','p02','p08'],
    periodAssignments: [{
      period: 1,
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
        CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.25 },
             { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
             { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }]
      },
      bench: []
    }]
  })`);

  const stats = run(ctx, "Storage.getSeasonStats('t1', 's1')");
  assertApprox(stats.p02.totalPeriodsPlayed, 0.5, 0.001, 'p02 re-entry total = 0.5');
  assertApprox(stats.p08.totalPeriodsPlayed, 0.5, 0.001, 'p08 total = 0.5');
  assertApprox(stats.p02.periodsByPosition.CB, 0.5, 0.001, 'p02 CB credit = 0.5');
}

suite('Storage — getSeasonStats field-to-field shift');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','CB','LW'] })");

  // Jordan and Maya shift positions at half
  run(ctx, `Storage.saveGame('t1', 's1', {
    gameId: 'g1', date: '2026-04-01', numPeriods: 1,
    availablePlayers: ['p01','p02','p03'],
    periodAssignments: [{
      period: 1,
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
        CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1.0 }],
        LW: [{ pid: 'p03', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p02', timeIn: 0.5, timeOut: 1.0 }]
      },
      bench: []
    }]
  })`);

  const stats = run(ctx, "Storage.getSeasonStats('t1', 's1')");
  assertApprox(stats.p02.totalPeriodsPlayed, 1.0, 0.001, 'p02 total = 1.0 (half CB + half LW)');
  assertApprox(stats.p03.totalPeriodsPlayed, 1.0, 0.001, 'p03 total = 1.0 (half LW + half CB)');
  assertApprox(stats.p02.periodsByPosition.CB, 0.5, 0.001, 'p02 CB = 0.5');
  assertApprox(stats.p02.periodsByPosition.LW, 0.5, 0.001, 'p02 LW = 0.5');
}

// ── Import: v3 data auto-migrates ───────────────────────────────────

suite('Storage — importBackup v3 auto-migrates games');
{
  const ctx = freshCtx();
  const backup = {
    version: 3, app: 'roster-rotation',
    exportedAt: '2026-04-01T00:00:00.000Z',
    context: null, teams: [{
      slug: 'team1', name: 'Team 1',
      seasons: [{
        slug: 's1', name: 'Spring', preset: null, positions: ['GK','CB'],
        roster: { positions: ['GK','CB'], players: { p01: { name: 'Alex', positionWeights: {} } } },
        games: [{
          gameId: 'g1', date: '2026-04-01', numPeriods: 1,
          availablePlayers: ['p01','p02'],
          periodAssignments: [
            { period: 1, assignments: { GK: 'p01', CB: 'p02' }, bench: [] }
          ]
        }],
        plays: []
      }]
    }],
    standalonePlays: []
  };
  run(ctx, `Storage.importBackup(${JSON.stringify(backup)})`);
  const games = run(ctx, "Storage.loadAllGames('team1', 's1')");
  assert(Array.isArray(games[0].periodAssignments[0].assignments.GK), 'v3 import migrated to v4');
  assertEqual(games[0].periodAssignments[0].assignments.GK[0].pid, 'p01', 'pid preserved after import migration');
}

suite('Storage — importBackup v4 passes through');
{
  const ctx = freshCtx();
  const backup = {
    version: 4, app: 'roster-rotation',
    exportedAt: '2026-04-01T00:00:00.000Z',
    context: null, teams: [{
      slug: 'team1', name: 'Team 1',
      seasons: [{
        slug: 's1', name: 'Spring', preset: null, positions: ['GK','CB'],
        roster: { positions: ['GK','CB'], players: {} },
        games: [{
          gameId: 'g1', date: '2026-04-01', numPeriods: 1,
          availablePlayers: ['p01','p02'],
          periodAssignments: [{
            period: 1,
            assignments: {
              GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
              CB: [{ pid: 'p02', timeIn: 0, timeOut: 1 }]
            },
            bench: []
          }]
        }],
        plays: []
      }]
    }],
    standalonePlays: []
  };
  assertNoThrow(() => run(ctx, `Storage.importBackup(${JSON.stringify(backup)})`), 'v4 import succeeds');
  const games = run(ctx, "Storage.loadAllGames('team1', 's1')");
  assertEqual(games[0].periodAssignments[0].assignments.GK[0].pid, 'p01', 'v4 data intact');
}

suite('Storage — importBackup rejects version 2');
{
  const ctx = freshCtx();
  assertThrows(
    () => run(ctx, `Storage.importBackup({ version: 2, teams: [] })`),
    'rejects version 2'
  );
}

suite('Storage — importSharedTeam v3 auto-migrates');
{
  const ctx = freshCtx();
  const shared = {
    version: 3, teams: [{
      slug: 'team1', name: 'Team 1',
      seasons: [{
        slug: 's1', name: 'Spring', preset: null, positions: ['GK'],
        roster: { positions: ['GK'], players: {} },
        games: [{
          gameId: 'g1', date: '2026-04-01', numPeriods: 1,
          availablePlayers: ['p01'],
          periodAssignments: [{ period: 1, assignments: { GK: 'p01' }, bench: [] }]
        }],
        plays: []
      }]
    }]
  };
  run(ctx, `Storage.importSharedTeam(${JSON.stringify(shared)})`);
  const games = run(ctx, "Storage.loadAllGames('team1', 's1')");
  assert(Array.isArray(games[0].periodAssignments[0].assignments.GK), 'shared team v3 migrated');
}

// ── Engine: getPlayerSummary with v4 data ───────────────────────────

suite('Engine — getPlayerSummary with v4 whole periods');
{
  const ctx = freshCtx();
  const summary = run(ctx, `getPlayerSummary({
    availablePlayers: ['p01','p02','p03'],
    numPeriods: 2,
    periodAssignments: [
      { period: 1,
        assignments: {
          GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
          CB: [{ pid: 'p02', timeIn: 0, timeOut: 1 }]
        },
        bench: ['p03'] },
      { period: 2,
        assignments: {
          GK: [{ pid: 'p02', timeIn: 0, timeOut: 1 }],
          CB: [{ pid: 'p03', timeIn: 0, timeOut: 1 }]
        },
        bench: ['p01'] }
    ]
  })`);
  assertApprox(summary.p01.periodsPlayed, 1, 0.001, 'p01 played 1 period');
  assertApprox(summary.p02.periodsPlayed, 2, 0.001, 'p02 played 2 periods');
  assertApprox(summary.p03.periodsPlayed, 1, 0.001, 'p03 played 1 period');
  assertEqual(summary.p01.benched, 1, 'p01 benched once');
  assertEqual(summary.p03.benched, 1, 'p03 benched once');
}

suite('Engine — getPlayerSummary with v4 fractional data');
{
  const ctx = freshCtx();
  const summary = run(ctx, `getPlayerSummary({
    availablePlayers: ['p01','p02','p03'],
    numPeriods: 1,
    periodAssignments: [{
      period: 1,
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
        CB: [{ pid: 'p02', timeIn: 0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1 }]
      },
      bench: ['p03']
    }]
  })`);
  assertApprox(summary.p01.periodsPlayed, 1.0, 0.001, 'p01 full period');
  assertApprox(summary.p02.periodsPlayed, 0.5, 0.001, 'p02 half period');
  assertApprox(summary.p03.periodsPlayed, 0.5, 0.001, 'p03 half period');
  assertEqual(summary.p02.positions, ['CB'], 'p02 played CB');
  assertEqual(summary.p03.positions, ['CB'], 'p03 played CB');
}

suite('Engine — getPlayerSummary with re-entry');
{
  const ctx = freshCtx();
  const summary = run(ctx, `getPlayerSummary({
    availablePlayers: ['p02','p08'],
    numPeriods: 1,
    periodAssignments: [{
      period: 1,
      assignments: {
        CB: [{ pid: 'p02', timeIn: 0, timeOut: 0.25 },
             { pid: 'p08', timeIn: 0.25, timeOut: 0.75 },
             { pid: 'p02', timeIn: 0.75, timeOut: 1.0 }]
      },
      bench: []
    }]
  })`);
  assertApprox(summary.p02.periodsPlayed, 0.5, 0.001, 'p02 re-entry total 0.5');
  assertApprox(summary.p08.periodsPlayed, 0.5, 0.001, 'p08 total 0.5');
  // Position recorded once per slot per period (not per entry)
  assertEqual(summary.p02.positions, ['CB'], 'p02 position recorded once');
  assertEqual(summary.p08.positions, ['CB'], 'p08 position recorded once');
}

// ── Engine: rebalanceFromPeriod with v4 frozen periods ──────────────

suite('Engine — rebalance reads v4 frozen periods correctly');
{
  const ctx = freshCtx();
  const positions = ['GK', 'CB', 'LB', 'RB', 'CM'];
  const roster = { positions, players: {} };
  for (let i = 1; i <= 7; i++) {
    roster.players['p' + String(i).padStart(2, '0')] = { name: `P${i}`, positionWeights: {} };
  }

  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
  `);

  // Create a plan with v4 frozen periods
  run(ctx, `
    globalThis._plan = {
      date: '2026-04-01', numPeriods: 4,
      availablePlayers: ['p01','p02','p03','p04','p05','p06','p07'],
      periodAssignments: [
        { period: 1,
          assignments: {
            GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
            CB: [{ pid: 'p02', timeIn: 0, timeOut: 1 }],
            LB: [{ pid: 'p03', timeIn: 0, timeOut: 1 }],
            RB: [{ pid: 'p04', timeIn: 0, timeOut: 1 }],
            CM: [{ pid: 'p05', timeIn: 0, timeOut: 1 }]
          },
          bench: ['p06','p07'] },
        { period: 2,
          assignments: {
            GK: [{ pid: 'p06', timeIn: 0, timeOut: 1 }],
            CB: [{ pid: 'p07', timeIn: 0, timeOut: 1 }],
            LB: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
            RB: [{ pid: 'p02', timeIn: 0, timeOut: 1 }],
            CM: [{ pid: 'p03', timeIn: 0, timeOut: 1 }]
          },
          bench: ['p04','p05'] },
        { period: 3, assignments: { GK: 'p04', CB: 'p05', LB: 'p06', RB: 'p07', CM: 'p01' }, bench: ['p02','p03'] },
        { period: 4, assignments: { GK: 'p02', CB: 'p03', LB: 'p04', RB: 'p05', CM: 'p06' }, bench: ['p01','p07'] }
      ]
    };
  `);

  // Rebalance from period 2 (freeze period 1 which is v4)
  assertNoThrow(
    () => run(ctx, `globalThis._rebalanced = globalThis._engine.rebalanceFromPeriod(globalThis._plan, 1, [], {})`),
    'rebalance with v4 frozen period does not throw'
  );

  const rebalanced = run(ctx, 'globalThis._rebalanced');
  assertEqual(rebalanced.periodAssignments.length, 4, 'rebalanced has 4 periods');

  // Frozen period should be unchanged
  const frozenPA = rebalanced.periodAssignments[0];
  assert(Array.isArray(frozenPA.assignments.GK), 'frozen period stays v4');
  assertEqual(frozenPA.assignments.GK[0].pid, 'p01', 'frozen GK pid unchanged');
}

suite('Engine — rebalance with fractional frozen credit');
{
  const ctx = freshCtx();
  const positions = ['GK', 'CB'];
  const roster = { positions, players: {} };
  for (let i = 1; i <= 4; i++) {
    roster.players['p' + String(i).padStart(2, '0')] = { name: `P${i}`, positionWeights: {} };
  }

  run(ctx, `
    globalThis._roster = ${JSON.stringify(roster)};
    globalThis._engine = new RotationEngine(globalThis._roster, {});
  `);

  // Frozen period has fractional assignments
  run(ctx, `
    globalThis._plan = {
      date: '2026-04-01', numPeriods: 2,
      availablePlayers: ['p01','p02','p03','p04'],
      periodAssignments: [
        { period: 1,
          assignments: {
            GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }],
            CB: [{ pid: 'p02', timeIn: 0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1 }]
          },
          bench: ['p04'] },
        { period: 2,
          assignments: { GK: 'p04', CB: 'p01' },
          bench: ['p02','p03'] }
      ]
    };
  `);

  assertNoThrow(
    () => run(ctx, `globalThis._rebalanced = globalThis._engine.rebalanceFromPeriod(globalThis._plan, 1, [], {})`),
    'rebalance with fractional frozen credit does not throw'
  );

  const rebalanced = run(ctx, 'globalThis._rebalanced');
  assertEqual(rebalanced.periodAssignments.length, 2, 'still 2 periods');
  // Regenerated period should have proper assignments (2 positions, so 2 players play)
  const regen = rebalanced.periodAssignments[1];
  const regenPids = Object.values(regen.assignments);
  assertEqual(regenPids.length, 2, 'regenerated period has 2 position assignments');
}

// ── Export/Import roundtrip with v4 data ────────────────────────────

suite('Storage — v4 export/import roundtrip preserves fractional data');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','CB'] })");
  run(ctx, "Storage.saveRoster('t1', 's1', { positions: ['GK','CB'], players: { p01: { name: 'A', positionWeights: {} } } })");

  run(ctx, `Storage.saveGame('t1', 's1', {
    gameId: 'g1', date: '2026-04-01', numPeriods: 1,
    availablePlayers: ['p01','p02','p03'],
    periodAssignments: [{
      period: 1,
      assignments: {
        GK: [{ pid: 'p01', timeIn: 0.0, timeOut: 1.0 }],
        CB: [{ pid: 'p02', timeIn: 0.0, timeOut: 0.5 }, { pid: 'p03', timeIn: 0.5, timeOut: 1.0 }]
      },
      bench: []
    }]
  })`);

  // Export
  const exported = run(ctx, "Storage.exportAll()");
  assertEqual(exported.version, 4, 'exports as v4');

  // Clear and reimport
  run(ctx, "Storage.clearAll()");
  run(ctx, `Storage.importBackup(${JSON.stringify(exported)})`);

  // Verify fractional data survived
  const games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  const cb = games[0].periodAssignments[0].assignments.CB;
  assertEqual(cb.length, 2, 'CB still has 2 entries after roundtrip');
  assertEqual(cb[0].pid, 'p02', 'first entry pid preserved');
  assertApprox(cb[0].timeOut, 0.5, 0.001, 'first entry timeOut preserved');
  assertEqual(cb[1].pid, 'p03', 'second entry pid preserved');
}

// ── Future-prep helpers ─────────────────────────────────────────────

suite('gamePlayedFraction');
{
  const ctx = freshCtx();
  const fraction = run(ctx, `gamePlayedFraction('p02', {
    numPeriods: 4,
    periodAssignments: [
      { period: 1, assignments: { GK: [{ pid: 'p01', timeIn: 0, timeOut: 1 }], CB: [{ pid: 'p02', timeIn: 0, timeOut: 1 }] }, bench: [] },
      { period: 2, assignments: { GK: [{ pid: 'p02', timeIn: 0, timeOut: 1 }], CB: [{ pid: 'p01', timeIn: 0, timeOut: 1 }] }, bench: [] }
    ]
  }, 1)`);
  assertApprox(fraction, 0.5, 0.001, 'p02 played 2/4 periods through idx 1 = 0.5');
}

suite('seasonFairnessRatio');
{
  const ctx = freshCtx();
  // Player on track: same as average
  const ratio = run(ctx, `seasonFairnessRatio('p01', {
    p01: { totalPeriodsPlayed: 5, totalPeriodsAvailable: 10 },
    p02: { totalPeriodsPlayed: 5, totalPeriodsAvailable: 10 }
  })`);
  assertApprox(ratio, 1.0, 0.001, 'equal playing time = 1.0');

  // Player underplayed
  const ratio2 = run(ctx, `seasonFairnessRatio('p01', {
    p01: { totalPeriodsPlayed: 3, totalPeriodsAvailable: 10 },
    p02: { totalPeriodsPlayed: 7, totalPeriodsAvailable: 10 }
  })`);
  assert(ratio2 < 1.0, 'underplayed < 1.0');

  // No history
  const ratio3 = run(ctx, `seasonFairnessRatio('p03', {
    p01: { totalPeriodsPlayed: 5, totalPeriodsAvailable: 10 }
  })`);
  assertEqual(ratio3, null, 'missing player returns null');
}
