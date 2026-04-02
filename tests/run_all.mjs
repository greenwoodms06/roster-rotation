#!/usr/bin/env node
// run_all.mjs — Run all test suites
import { report, resetCounts } from './helpers.mjs';

console.log('╔══════════════════════════════════════╗');
console.log('║   Rotation Manager — Test Runner     ║');
console.log('╚══════════════════════════════════════╝');

const suites = [
  ['Engine',     './test_engine.mjs'],
  ['Formations', './test_formations.mjs'],
  ['Storage',    './test_storage.mjs'],
  ['App Logic',  './test_app_logic.mjs'],
];

let totalFailed = 0;

for (const [name, path] of suites) {
  console.log(`\n━━━ ${name} Tests ━━━`);
  resetCounts();
  try {
    await import(path);
    totalFailed += report();
  } catch (err) {
    console.error(`  ✗ SUITE CRASHED: ${err.message}`);
    console.error(err.stack);
    totalFailed++;
  }
}

console.log('═'.repeat(40));
if (totalFailed === 0) {
  console.log('  ✓ All tests passed!\n');
} else {
  console.log(`  ✗ ${totalFailed} failure(s)\n`);
}

process.exit(totalFailed > 0 ? 1 : 0);
