// tests/helpers.mjs — Test harness for Rotation Manager
// Provides: assert helpers, localStorage mock, file loading into a shared context

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Assert Helpers ───────────────────────────────────────────────

let _passed = 0;
let _failed = 0;
let _currentSuite = '';

export function suite(name) {
  _currentSuite = name;
  console.log(`\n  ▸ ${name}`);
}

export function assert(condition, msg) {
  const label = _currentSuite ? `${_currentSuite}: ${msg}` : msg;
  if (condition) {
    _passed++;
  } else {
    _failed++;
    console.error(`    ✗ FAIL: ${label}`);
  }
}

export function assertEqual(actual, expected, msg) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) {
    msg += ` (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`;
  }
  assert(pass, msg);
}

export function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, msg);
}

export function assertNoThrow(fn, msg) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; msg += ` (threw: ${e.message})`; }
  assert(!threw, msg);
}

export function assertApprox(actual, expected, epsilon, msg) {
  assert(Math.abs(actual - expected) <= epsilon, msg + ` (got ${actual}, expected ~${expected})`);
}

export function report() {
  const total = _passed + _failed;
  console.log(`\n  ── ${total} assertions: ${_passed} passed, ${_failed} failed ──\n`);
  return _failed;
}

export function resetCounts() {
  _passed = 0;
  _failed = 0;
}

// ── localStorage Mock ────────────────────────────────────────────

export function createLocalStorageMock() {
  const store = {};
  return {
    getItem(key) { return key in store ? store[key] : null; },
    setItem(key, val) { store[key] = String(val); },
    removeItem(key) { delete store[key]; },
    clear() { for (const k of Object.keys(store)) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key(i) { return Object.keys(store)[i] || null; },
    _dump() { return { ...store }; },
  };
}

// ── Load JS Files into a Sandbox Context ─────────────────────────

/**
 * Creates a VM context with all app globals loaded.
 * Files are loaded in dependency order: formations → storage → engine.
 * App.js and field.js are NOT loaded (they require DOM).
 *
 * @param {object} [opts]
 * @param {boolean} [opts.withApp=false] Load app.js functions (requires DOM stubs)
 * @returns {vm.Context} context with all globals
 */
export function createContext(opts = {}) {
  const ls = createLocalStorageMock();

  // Minimal DOM stubs for app.js functions that don't touch DOM
  const domStub = {
    getElementById: () => ({
      value: '', textContent: '', innerHTML: '',
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      querySelectorAll: () => [],
      querySelector: () => null,
      click: () => {},
      style: {},
      setAttribute: () => {},
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: (tag) => ({
      className: '', textContent: '', innerHTML: '', style: {},
      classList: { add() {}, remove() {}, toggle() {} },
      appendChild: () => {},
      remove: () => {},
      cloneNode: () => ({ classList: { add() {} }, style: {} }),
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 100, height: 40 }),
      querySelectorAll: () => [],
      setAttribute: () => {},
    }),
    addEventListener: () => {},
    body: { appendChild: () => {} },
  };

  const sandbox = {
    localStorage: ls,
    console,
    document: domStub,
    navigator: { share: null, clipboard: { writeText: async () => {} }, serviceWorker: { register: () => Promise.resolve({ addEventListener: () => {}, waiting: null }), addEventListener: () => {} } },
    window: { addEventListener: () => {}, location: { reload: () => {} }, _waitingSW: null },
    self: { addEventListener: () => {}, skipWaiting: () => {}, clients: { claim: () => {} } },
    caches: { open: async () => ({ addAll: async () => {} }), keys: async () => [], delete: async () => {} },
    fetch: async () => ({}),
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    alert: () => {},
    confirm: () => true,
    Math, JSON, Array, Object, Set, Map, Date, String, Number, Boolean, RegExp,
    Error, TypeError, RangeError, isNaN, parseInt, parseFloat, Infinity, NaN,
    Promise, Symbol, WeakMap, WeakSet, Proxy, Reflect,
  };

  const context = vm.createContext(sandbox);

  // Load files in order
  const files = ['js/formations.js', 'js/storage.js', 'js/engine.js'];
  if (opts.withApp) {
    // Stub field.js functions that app.js calls at init
    vm.runInContext(`
      function renderField() {}
      function getFieldFormations() { return { fieldType: 'generic', layouts: [] }; }
      function setupFieldDrag() {}
      function setupFieldDraw() {}
      function setupDefenseDrag() {}
      function setupRouteSelection() {}
    `, context);
    files.push('js/app.js');
  }

  for (const file of files) {
    const code = readFileSync(join(ROOT, file), 'utf8');
    vm.runInContext(code, context, { filename: file });
  }

  return context;
}

/**
 * Run a function inside a context and return its result.
 */
export function run(context, code) {
  return vm.runInContext(code, context);
}
