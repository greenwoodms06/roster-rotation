// tests/test_swap.mjs — Swap, Sub, Replace, and Derived Bench tests
import { suite, assert, assertEqual, assertApprox, createContext, run } from './helpers.mjs';

function freshCtx() { return createContext({ withApp: true }); }

/** Set up a game plan with the given assignments in the test context. */
function setupGame(ctx, positions, assignmentsInput, available) {
  const roster = { positions, players: {} };
  for (const pid of available) {
    roster.players[pid] = { name: pid, positionWeights: {} };
  }
  // Accept single period object or array of periods
  const assignmentsArr = Array.isArray(assignmentsInput) ? assignmentsInput : [assignmentsInput];
  const periodAssignments = assignmentsArr.map((a, i) => ({
    period: i + 1,
    assignments: a,
    bench: available.filter(p => {
      for (const occ of Object.values(a)) {
        const entries = Array.isArray(occ) ? occ : [{ pid: occ }];
        if (entries.some(e => e.pid === p)) return false;
      }
      return true;
    }),
  }));
  run(ctx, `
    Storage.addTeam({ slug: 'test', name: 'Test' });
    Storage.addSeason('test', { slug: 's1', name: 'S1', positions: ${JSON.stringify(positions)} });
    Storage.saveRoster('test', 's1', ${JSON.stringify(roster)});
    ctx = { teamSlug: 'test', seasonSlug: 's1' };
    roster = ${JSON.stringify(roster)};
    currentPlan = {
      gameId: 'g1', date: '2026-04-01', numPeriods: ${assignmentsArr.length},
      availablePlayers: ${JSON.stringify(available)},
      periodAssignments: ${JSON.stringify(periodAssignments)},
      trackingMode: 'fine', periodDuration: 720
    };
    Storage.saveGame('test', 's1', currentPlan);
  `);
}

// ── resolveSwapLocations ──────────────────────────────────────────

suite('resolveSwapLocations — basic');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  const locs = run(ctx, "resolveSwapLocations(0, 'A', 'C')");
  assertEqual(locs.A.type, 'field', 'A is on field');
  assertEqual(locs.A.pos, 'GK', 'A is at GK');
  assertEqual(locs.C.type, 'bench', 'C is on bench');
}

suite('resolveSwapLocations — after mid-period sub');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'C', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  const locs = run(ctx, "resolveSwapLocations(0, 'B', 'C')");
  assertEqual(locs.B.type, 'bench', 'B was subbed out — now bench');
  assertEqual(locs.C.type, 'field', 'C is current occupant of CB');
  assertEqual(locs.C.pos, 'CB', 'C at CB');
}

// ── deriveVisualBench ─────────────────────────────────────────────

suite('deriveVisualBench — after generation');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  const bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assertEqual(bench, ['C'], 'only C is on bench');
}

suite('deriveVisualBench — after mid-period sub');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'C', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  const bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assertEqual(bench, ['B'], 'B was subbed out, appears on bench; C is on field');
}

// ── splitSlotEntry ────────────────────────────────────────────────

suite('splitSlotEntry — basic split at half');
{
  const ctx = freshCtx();
  const result = run(ctx, `
    const occ = [{ pid: 'A', timeIn: 0, timeOut: 1 }];
    splitSlotEntry(occ, 0.5, 'A', 'B');
    occ;
  `);
  assertEqual(result.length, 2, 'two entries after split');
  assertEqual(result[0].pid, 'A', 'first entry is A');
  assertApprox(result[0].timeOut, 0.5, 0.001, 'A ends at 0.5');
  assertEqual(result[1].pid, 'B', 'second entry is B');
  assertApprox(result[1].timeIn, 0.5, 0.001, 'B starts at 0.5');
  assertApprox(result[1].timeOut, 1.0, 0.001, 'B ends at 1.0');
}

suite('splitSlotEntry — second split on already-split slot');
{
  const ctx = freshCtx();
  const result = run(ctx, `
    const occ = [
      { pid: 'A', timeIn: 0, timeOut: 0.5 },
      { pid: 'B', timeIn: 0.5, timeOut: 1 }
    ];
    splitSlotEntry(occ, 0.75, 'B', 'C');
    occ;
  `);
  assertEqual(result.length, 3, 'three entries after second split');
  assertEqual(result[0].pid, 'A', 'A still first');
  assertEqual(result[1].pid, 'B', 'B second');
  assertApprox(result[1].timeOut, 0.75, 0.001, 'B ends at 0.75');
  assertEqual(result[2].pid, 'C', 'C third');
  assertApprox(result[2].timeIn, 0.75, 0.001, 'C starts at 0.75');
}

suite('splitSlotEntry — fails when fraction outside entry');
{
  const ctx = freshCtx();
  const result = run(ctx, `
    const occ = [{ pid: 'A', timeIn: 0.5, timeOut: 1 }];
    splitSlotEntry(occ, 0.25, 'A', 'B');
  `);
  assertEqual(result, false, 'returns false when fraction is before entry');
}

// ── executeSwap — field ↔ field ───────────────────────────────────

suite('executeSwap — two clean field players');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB', 'CM'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  run(ctx, "executeSwap(0, 'B', 'C')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB[0].pid, 'C', 'CB now has C');
  assertEqual(pa.assignments.CM[0].pid, 'B', 'CM now has B');
  assertEqual(pa.assignments.GK[0].pid, 'A', 'GK unchanged');
}

suite('executeSwap — after shift, swap with third player (user scenario)');
{
  const ctx = freshCtx();
  // After A↔B shift at 0.5
  setupGame(ctx, ['CB', 'LW', 'CM'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // Swap A (at LW) with C (at CM)
  run(ctx, "executeSwap(0, 'A', 'C')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  // CB should be unchanged
  assertEqual(pa.assignments.CB.length, 2, 'CB still has 2 entries');
  assertEqual(pa.assignments.CB[0].pid, 'A', 'CB first half is A');
  assertEqual(pa.assignments.CB[1].pid, 'B', 'CB second half is B');

  // LW: B first half, then C takes over from A
  assertEqual(pa.assignments.LW.length, 2, 'LW has 2 entries');
  assertEqual(pa.assignments.LW[0].pid, 'B', 'LW first half is B');
  assertEqual(pa.assignments.LW[1].pid, 'C', 'LW second half is C (was A)');

  // CM: C first half (split), then A takes over
  assertEqual(pa.assignments.CM.length, 2, 'CM has 2 entries (was split)');
  assertEqual(pa.assignments.CM[0].pid, 'C', 'CM first half is C');
  assertApprox(pa.assignments.CM[0].timeOut, 0.5, 0.001, 'CM split at 0.5');
  assertEqual(pa.assignments.CM[1].pid, 'A', 'CM second half is A');
  assertApprox(pa.assignments.CM[1].timeIn, 0.5, 0.001, 'A starts at 0.5');
}

suite('executeSwap — both players shifted at same time');
{
  const ctx = freshCtx();
  // A and B shifted at 0.5 (simultaneous)
  setupGame(ctx, ['CB', 'LW'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B']);

  // Swap back A and B — should just change pids, no new splits
  run(ctx, "executeSwap(0, 'A', 'B')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  assertEqual(pa.assignments.CB.length, 2, 'CB still 2 entries');
  assertEqual(pa.assignments.CB[1].pid, 'A', 'CB second half back to A');
  assertEqual(pa.assignments.LW.length, 2, 'LW still 2 entries');
  assertEqual(pa.assignments.LW[1].pid, 'B', 'LW second half back to B');
}

suite('executeSwap — different start times, later entry needs no split');
{
  const ctx = freshCtx();
  // A subbed into CB at 0.75, C has been at CM since start
  setupGame(ctx, ['CB', 'CM'], {
    CB: [{ pid: 'X', timeIn: 0, timeOut: 0.75 }, { pid: 'A', timeIn: 0.75, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'C', 'X']);

  run(ctx, "executeSwap(0, 'A', 'C')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  // CB: X 0→0.75, then C (was A)
  assertEqual(pa.assignments.CB[1].pid, 'C', 'CB last entry changed to C');
  assertApprox(pa.assignments.CB[1].timeIn, 0.75, 0.001, 'starts at 0.75');

  // CM: C 0→0.75 (split), then A
  assertEqual(pa.assignments.CM.length, 2, 'CM was split');
  assertEqual(pa.assignments.CM[0].pid, 'C', 'CM first part is C');
  assertApprox(pa.assignments.CM[0].timeOut, 0.75, 0.001, 'C ends at 0.75');
  assertEqual(pa.assignments.CM[1].pid, 'A', 'CM second part is A');
}

// ── executeSwap — bench ↔ field ───────────────────────────────────

suite('executeSwap — bench player swaps with field player');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  run(ctx, "executeSwap(0, 'B', 'C')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB[0].pid, 'C', 'C took B\'s spot');
  const bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assert(bench.includes('B'), 'B is now on bench');
  assert(!bench.includes('C'), 'C is no longer on bench');
}

// ── executeFullReplace ────────────────────────────────────────────

suite('executeFullReplace — cleans slot to single entry');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'C', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // Replace C (current at CB) with D (bench)
  run(ctx, "executeFullReplace(0, 'C', 'D')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB.length, 1, 'CB cleaned to single entry');
  assertEqual(pa.assignments.CB[0].pid, 'D', 'D has full period');
  assertApprox(pa.assignments.CB[0].timeOut, 1.0, 0.001, 'full period');
}

suite('executeFullReplace — field↔field clean swap');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B']);

  run(ctx, "executeFullReplace(0, 'A', 'B')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.GK[0].pid, 'B', 'GK now B');
  assertEqual(pa.assignments.CB[0].pid, 'A', 'CB now A');
}

// ── executeMidPeriodSub ───────────────────────────────────────────

suite('executeMidPeriodSub — bench to field at half');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  run(ctx, "executeMidPeriodSub(0, 'B', 'C', 0.5)");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB.length, 2, 'CB split into 2');
  assertEqual(pa.assignments.CB[0].pid, 'B', 'B played first half');
  assertApprox(pa.assignments.CB[0].timeOut, 0.5, 0.001, 'B ends at 0.5');
  assertEqual(pa.assignments.CB[1].pid, 'C', 'C plays second half');
  assertApprox(pa.assignments.CB[1].timeIn, 0.5, 0.001, 'C starts at 0.5');
}

suite('executeMidPeriodSub — field↔field shift at third');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB', 'LW'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
    LW: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  run(ctx, `executeMidPeriodSub(0, 'B', 'C', ${1/3})`);
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  // CB: B→C, LW: C→B
  assertEqual(pa.assignments.CB[0].pid, 'B', 'CB first third is B');
  assertEqual(pa.assignments.CB[1].pid, 'C', 'CB remainder is C');
  assertEqual(pa.assignments.LW[0].pid, 'C', 'LW first third is C');
  assertEqual(pa.assignments.LW[1].pid, 'B', 'LW remainder is B');
}

suite('executeMidPeriodSub — second sub in same slot');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'C', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // Sub D in for C at 0.75
  run(ctx, "executeMidPeriodSub(0, 'C', 'D', 0.75)");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB.length, 3, 'CB has 3 entries');
  assertEqual(pa.assignments.CB[0].pid, 'B', 'B: 0→0.5');
  assertEqual(pa.assignments.CB[1].pid, 'C', 'C: 0.5→0.75');
  assertApprox(pa.assignments.CB[1].timeOut, 0.75, 0.001, 'C ends at 0.75');
  assertEqual(pa.assignments.CB[2].pid, 'D', 'D: 0.75→1');
}

// ── Tap order independence ────────────────────────────────────────

suite('executeMidPeriodSub — tap order does not matter (bench first)');
{
  const ctx1 = freshCtx();
  setupGame(ctx1, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  // "Tap B (field) then C (bench)"
  run(ctx1, "executeMidPeriodSub(0, 'B', 'C', 0.5)");
  const r1 = run(ctx1, 'currentPlan.periodAssignments[0].assignments.CB');

  const ctx2 = freshCtx();
  setupGame(ctx2, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  // "Tap C (bench) then B (field)" — same pids, reversed order
  run(ctx2, "executeMidPeriodSub(0, 'C', 'B', 0.5)");
  const r2 = run(ctx2, 'currentPlan.periodAssignments[0].assignments.CB');

  assertEqual(r1.length, r2.length, 'same number of entries regardless of tap order');
  assertEqual(r1[0].pid, r2[0].pid, 'first entry same pid');
  assertEqual(r1[1].pid, r2[1].pid, 'second entry same pid');
}

suite('executeSwap — tap order does not matter');
{
  const ctx1 = freshCtx();
  setupGame(ctx1, ['CB', 'LW'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B']);

  run(ctx1, "executeSwap(0, 'A', 'B')");
  const cb1 = run(ctx1, 'currentPlan.periodAssignments[0].assignments.CB[0].pid');
  const lw1 = run(ctx1, 'currentPlan.periodAssignments[0].assignments.LW[0].pid');

  const ctx2 = freshCtx();
  setupGame(ctx2, ['CB', 'LW'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B']);

  run(ctx2, "executeSwap(0, 'B', 'A')");
  const cb2 = run(ctx2, 'currentPlan.periodAssignments[0].assignments.CB[0].pid');
  const lw2 = run(ctx2, 'currentPlan.periodAssignments[0].assignments.LW[0].pid');

  assertEqual(cb1, cb2, 'CB same regardless of tap order');
  assertEqual(lw1, lw2, 'LW same regardless of tap order');
}

// ── Credit integrity after operations ─────────────────────────────

suite('slot credits sum to 1.0 after all operations');
{
  const ctx = freshCtx();
  setupGame(ctx, ['CB', 'LW', 'CM'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // Sub D in for A at CB at 0.25
  run(ctx, "executeMidPeriodSub(0, 'A', 'D', 0.25)");
  // Shift B and C at 0.5
  run(ctx, "executeMidPeriodSub(0, 'B', 'C', 0.5)");
  // Swap D and C
  run(ctx, "executeSwap(0, 'D', 'C')");

  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  for (const [pos, occ] of Object.entries(pa.assignments)) {
    const total = occ.reduce((s, e) => s + (e.timeOut - e.timeIn), 0);
    assertApprox(total, 1.0, 0.001, `${pos} credits sum to 1.0`);
  }
}

suite('slot credits sum to 1.0 after replace on complex slot');
{
  const ctx = freshCtx();
  setupGame(ctx, ['CB'], {
    CB: [
      { pid: 'A', timeIn: 0, timeOut: 0.25 },
      { pid: 'B', timeIn: 0.25, timeOut: 0.5 },
      { pid: 'C', timeIn: 0.5, timeOut: 1 },
    ],
  }, ['A', 'B', 'C', 'D']);

  run(ctx, "executeFullReplace(0, 'C', 'D')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');
  assertEqual(pa.assignments.CB.length, 1, 'replace cleans to 1 entry');
  assertApprox(pa.assignments.CB[0].timeOut - pa.assignments.CB[0].timeIn, 1.0, 0.001, 'full period');
}

// ── Derived bench correctness through operations ──────────────────

suite('deriveVisualBench — tracks through multiple subs');
{
  const ctx = freshCtx();
  setupGame(ctx, ['GK', 'CB'], {
    GK: [{ pid: 'A', timeIn: 0, timeOut: 1 }],
    CB: [{ pid: 'B', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  let bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assertEqual(bench, ['C'], 'initially C on bench');

  // Sub C in for B
  run(ctx, "executeMidPeriodSub(0, 'B', 'C', 0.5)");
  bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assertEqual(bench, ['B'], 'after sub: B on bench, C on field');

  // Replace C with B (undo)
  run(ctx, "executeFullReplace(0, 'C', 'B')");
  bench = run(ctx, "deriveVisualBench(currentPlan, 0)");
  assertEqual(bench, ['C'], 'after replace: back to C on bench');
}

// ── removePlayerFromOtherPositions ────────────────────

suite('Replace cleans up player entries from other positions');
{
  const ctx = freshCtx();
  // A shifted with B at 0.5, then Replace puts A at CM
  setupGame(ctx, ['CB', 'LW', 'CM'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // Replace C at CM with A (from bench — A is on field at LW but Replace gives full period)
  run(ctx, "executeFullReplace(0, 'A', 'C')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  // A should only be at LW (current location), C goes to CM? No — Replace resolves locations:
  // A is at LW (field), C is at CM (field) → field↔field replace
  // LW gets C full period, CM gets A full period
  // A's old entry at CB should be cleaned up

  // Verify A is NOT in CB anymore
  const cbHasA = pa.assignments.CB.some(e => e.pid === 'A');
  assert(!cbHasA, 'A cleaned out of CB after replace');

  // Verify total credit for A in this period
  let totalA = 0;
  for (const occ of Object.values(pa.assignments)) {
    for (const e of occ) { if (e.pid === 'A') totalA += (e.timeOut - e.timeIn); }
  }
  assertApprox(totalA, 1.0, 0.01, 'A total credit is 1.0 after replace cleanup');
}

suite('Replace bench→field cleans up bench player stale entries');
{
  const ctx = freshCtx();
  // B subbed in for A at 0.5 in CB, then we Replace B into LW
  setupGame(ctx, ['CB', 'LW'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  // A is on bench (was subbed out of CB)
  // Replace C at LW with A
  run(ctx, "executeFullReplace(0, 'C', 'A')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  // A now at LW for full period. A's old CB entry (0→0.5) should be cleaned up
  const cbHasA = pa.assignments.CB.some(e => e.pid === 'A');
  assert(!cbHasA, 'A cleaned out of CB after replace from bench');

  // B should have expanded to fill A's gap in CB
  assertApprox(pa.assignments.CB[0].timeIn, 0, 0.001, 'CB gap filled — starts at 0');
  assertApprox(pa.assignments.CB[0].timeOut, 1, 0.001, 'CB gap filled — ends at 1');
}

// ── resetPlayerInPeriod ───────────────────────────────

suite('resetPlayerInPeriod — resets to clean full period');
{
  const ctx = freshCtx();
  setupGame(ctx, ['CB', 'LW', 'CM'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 1 }],
  }, ['A', 'B', 'C']);

  // A is currently at LW. Reset should give A full period at LW, remove from CB
  run(ctx, "resetPlayerInPeriod(0, 'A')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  assertEqual(pa.assignments.LW.length, 1, 'LW is clean single entry');
  assertEqual(pa.assignments.LW[0].pid, 'A', 'LW is A');
  assertApprox(pa.assignments.LW[0].timeOut, 1.0, 0.001, 'A owns full period at LW');

  // A should not appear in CB
  const cbHasA = pa.assignments.CB.some(e => e.pid === 'A');
  assert(!cbHasA, 'A removed from CB');

  // B should fill the gap in CB
  assertApprox(pa.assignments.CB[0].timeOut, 1.0, 0.001, 'B expanded to fill CB');
}

// ── Slot credits sum to 1.0 after replace cleanup ─────

suite('all slots sum to 1.0 after replace with cleanup');
{
  const ctx = freshCtx();
  setupGame(ctx, ['CB', 'LW', 'CM'], {
    CB: [{ pid: 'A', timeIn: 0, timeOut: 0.5 }, { pid: 'B', timeIn: 0.5, timeOut: 1 }],
    LW: [{ pid: 'B', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
    CM: [{ pid: 'C', timeIn: 0, timeOut: 0.5 }, { pid: 'A', timeIn: 0.5, timeOut: 1 }],
  }, ['A', 'B', 'C', 'D']);

  // A is at CM, LW, CB (>100% — broken state). Replace A with D at CM.
  run(ctx, "executeFullReplace(0, 'A', 'D')");
  const pa = run(ctx, 'currentPlan.periodAssignments[0]');

  for (const [pos, occ] of Object.entries(pa.assignments)) {
    const total = occ.reduce((s, e) => s + (e.timeOut - e.timeIn), 0);
    assertApprox(total, 1.0, 0.01, `${pos} credits sum to 1.0`);
  }

  // A should have <= 1.0 total credit
  let totalA = 0;
  for (const occ of Object.values(pa.assignments)) {
    for (const e of occ) { if (e.pid === 'A') totalA += (e.timeOut - e.timeIn); }
  }
  assert(totalA <= 1.01, `A total credit (${totalA}) is <= 1.0`);
}
