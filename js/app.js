/**
 * app.js  --  Main UI logic for the Rotation Manager PWA
 * Requires: formations.js, storage.js, engine.js (loaded before this file)
 * Optional: field.js (loaded before this file, provides renderField)
 */

// -- State ----------------------------------------------------------
let ctx = null;       // { teamSlug, seasonSlug }
let teams = [];       // [{ slug, name }]
let roster = null;    // { players: {}, positions: [] }
let currentPlan = null;
let editingPlayerId = null;
let modalWeights = {};
let starterMode = true;
let copyRosterEnabled = true;
let swapSelection = null; // { periodIdx, pid, pos (or 'bench') }
let swapHighlight = null; // { periodIdx, pids: [pid1, pid2] } -- brief highlight after swap
let seasonSubTab = 'overview'; // 'overview' | 'games' | 'players'
let collapsedPeriods = new Set(); // period indices that are collapsed in lineup view
let availableOrder = [];
let availDragState = null;   // { fromIdx, pointerId, ghostEl, startY } or null
let availDropIdx = null;     // index where the dragged item would be inserted
let availReorderFlash = null; // index to flash after reorder

// Constraint state (per game setup, reset on context change)
let gameLocks = {};          // { pid: position }  --  player pinned to a position
let gameContinuity = 0;      // 0=off, 1=medium, 2=high
let gamePositionMax = {};    // { pos: maxPeriods } -- per-position max constraint
let gameGlobalMaxPeriods = null; // null=no limit, number=max periods any player plays
let lockPickerOpen = null;   // pid currently showing lock picker, or null

// Tracking mode state (per game, inherited from season defaults)
let gameTrackingMode = 'simple'; // 'simple' | 'coarse' | 'fine'

// Game clock state (pure UI — not persisted, resets on page reload)
let clockRunning = false;
let clockStartTime = null;       // Date.now() when clock was last started
let clockElapsed = 0;            // accumulated seconds before current start
let clockInterval = null;        // setInterval ID for display updates
let clockPeriodIdx = 0;          // which period the clock is tracking

// Field tab state (shared with field.js)
let fieldPeriodIdx = 0;
let fieldFormationIdx = 0;
let fieldDotPositions = {};
let fieldDragState = null;
let fieldShowNames = false;
let fieldPlays = [];          // saved plays for current team/season
let fieldActivePlayId = null; // currently loaded play ID, or null
let fieldPlayFilter = '';     // text filter for play dropdown
let fieldDrawMode = false;    // route drawing mode toggle
let fieldRoutes = [];         // current routes: [{ points: [[x,y], ...] }, ...]
let fieldDrawState = null;    // active draw: { points, pointerId } or null
let fieldSelectedRoute = null; // selected route index for deletion, or null
let fieldDefenseOn = false;   // defense overlay toggle
let fieldDefenseMarkers = []; // defense positions: [{x, y}, ...]
let fieldZoneMode = false;    // zone drawing mode toggle
let fieldZones = [];          // drawn zones: [{ points: [[x,y],...], color: 'blue' }, ...]
let fieldZoneColor = 'blue';  // current zone color
let fieldSelectedZone = null; // selected zone index for deletion, or null
let fieldStandalonePreset = 'soccer-7v7'; // active preset when no team/season context
let fieldCustomCount = 7;                // number of dots in custom sport mode
let fieldCustomFieldType = 'generic';    // field background for custom sport

// Context picker state
let ctxPickTeam = null;
let ctxPickSeason = null;

const WEIGHT_LABELS = { 1: 'Normal', 2: 'Prefer', 3: 'Strong', 0: 'Never' };
const WEIGHT_CYCLE = [1, 2, 3, 0];
const WEIGHT_CLASSES = { 0: 'exclude', 2: 'prefer', 3: 'strong' };

// -- Fairness Color System (colorblind-aware) ----------------------------

/** Returns the three fairness colors based on colorblind setting */
function fairnessColors() {
  const s = loadSettings();
  if (s.colorblind) return { good: '#42a5f5', warn: '#ff9800', bad: '#e53935' };
  return { good: '#00e676', warn: '#fdd835', bad: '#ff5252' };
}

/** Returns fairness color labels for chart subtitles */
function fairnessLabels() {
  const s = loadSettings();
  if (s.colorblind) return { good: 'blue', warn: 'orange', bad: 'red' };
  return { good: 'green', warn: 'yellow', bad: 'red' };
}

/** Picks good/warn/bad color based on deviation from average */
function fairnessBarColor(devFromAvg) {
  const c = fairnessColors();
  return devFromAvg <= 0.05 ? c.good : devFromAvg <= 0.10 ? c.warn : c.bad;
}

/** Picks good/warn/bad color based on fairness spread */
function fairnessSpreadColor(spread) {
  const c = fairnessColors();
  return spread <= 1 ? c.good : spread <= 2 ? c.warn : c.bad;
}

/** Returns W/L/D color */
function wldColor(result) {
  const c = fairnessColors();
  if (result === 'W') return c.good;
  if (result === 'L') return c.bad;
  return c.warn;
}

/** Returns goal differential color */
function diffColor(diff) {
  const c = fairnessColors();
  if (diff > 0) return c.good;
  if (diff < 0) return c.bad;
  return 'var(--fg2)';
}

// -- Display Name Helper (jersey number + name) --------------------------

// -- Tracking Mode Helpers ------------------------------------------------

/** Get tracking mode defaults from the current season object. */
function getSeasonTrackingDefaults() {
  const settings = loadSettings();
  const globalDef = settings.defaultTrackingMode || 'simple';
  const globalTimeDisp = settings.defaultClockDirection === 'up' ? 'elapsed' : 'remaining';
  if (!ctx) return { trackingMode: globalDef, periodDuration: null, periodIncrement: 60, timeDisplay: globalTimeDisp, clockEnabled: false, clockAutoFill: true };
  const seasons = Storage.loadSeasons(ctx.teamSlug);
  const season = seasons.find(s => s.slug === ctx.seasonSlug);
  return {
    trackingMode: season?.trackingMode || globalDef,
    periodDuration: season?.periodDuration || null,
    periodIncrement: season?.periodIncrement || 60,
    timeDisplay: season?.timeDisplay || globalTimeDisp,
    clockEnabled: season?.clockEnabled || false,
    clockAutoFill: season?.clockAutoFill !== false,
  };
}

/** Read the active tracking mode for the current game (falls back to season default). */
function getActiveTrackingMode() {
  if (currentPlan && currentPlan.trackingMode) return currentPlan.trackingMode;
  return getSeasonTrackingDefaults().trackingMode;
}

/** Get period duration from game or season or settings default (seconds). */
function getActivePeriodDuration() {
  if (currentPlan && currentPlan.periodDuration != null) return currentPlan.periodDuration;
  const seasonDef = getSeasonTrackingDefaults().periodDuration;
  if (seasonDef) return seasonDef;
  return loadSettings().defaultPeriodDuration || 720;
}

/** Get period increment from game or season (seconds). */
function getActivePeriodIncrement() {
  if (currentPlan && currentPlan.periodIncrement != null) return currentPlan.periodIncrement;
  return getSeasonTrackingDefaults().periodIncrement;
}

/** Get time display preference from game or season. */
function getActiveTimeDisplay() {
  if (currentPlan && currentPlan.timeDisplay) return currentPlan.timeDisplay;
  return getSeasonTrackingDefaults().timeDisplay;
}

/** Get clock enabled from game or season. */
function getActiveClockEnabled() {
  if (currentPlan && currentPlan.clockEnabled != null) return currentPlan.clockEnabled;
  return getSeasonTrackingDefaults().clockEnabled;
}

/** Get clock auto-fill from game or season. */
function getActiveClockAutoFill() {
  if (currentPlan && currentPlan.clockAutoFill != null) return currentPlan.clockAutoFill;
  return getSeasonTrackingDefaults().clockAutoFill;
}

// ── Coarse fraction presets ──
const COARSE_FRACTIONS = [
  { label: '¼', value: 0.25 },
  { label: '⅓', value: 1/3 },
  { label: '½', value: 0.5 },
  { label: '⅔', value: 2/3 },
  { label: '¾', value: 0.75 },
];

/**
 * Split a slot entry at a given fraction — the "split, don't build" model.
 * Finds the outgoing player's active entry containing `atFraction`,
 * truncates it, and inserts a new entry for the incoming player
 * that inherits the remainder.
 *
 * Mutates the occupants array in place. Returns true if successful.
 */
function splitSlotEntry(slotOccupants, atFraction, outgoingPid, incomingPid) {
  const idx = slotOccupants.findIndex(
    e => e.pid === outgoingPid && e.timeIn < atFraction - 0.001 && atFraction < e.timeOut + 0.001
  );
  if (idx < 0) return false;

  const entry = slotOccupants[idx];
  const originalTimeOut = entry.timeOut;

  // Shrink outgoing entry to end at the sub point
  entry.timeOut = atFraction;

  // Insert incoming entry starting at sub point, inheriting the rest
  slotOccupants.splice(idx + 1, 0, {
    pid: incomingPid,
    timeIn: atFraction,
    timeOut: originalTimeOut,
  });

  return true;
}

// ── Time ↔ fraction conversion ──

function timeToFraction(seconds, periodDuration) {
  if (!periodDuration || periodDuration <= 0) return 0;
  return Math.min(1.0, Math.max(0, seconds / periodDuration));
}

function fractionToElapsed(f, periodDuration) {
  if (!periodDuration) return '00:00';
  const s = Math.round(f * periodDuration);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fractionToRemaining(f, periodDuration) {
  return fractionToElapsed(1.0 - f, periodDuration);
}

function fractionToDisplay(f, periodDuration) {
  return getActiveTimeDisplay() === 'remaining'
    ? fractionToRemaining(f, periodDuration)
    : fractionToElapsed(f, periodDuration);
}

// ── Game Clock ──

function clockGetElapsed() {
  let total = clockElapsed;
  if (clockRunning && clockStartTime) {
    total += (Date.now() - clockStartTime) / 1000;
  }
  return total;
}

function clockGetFraction() {
  const pd = getActivePeriodDuration();
  if (!pd) return 0;
  return Math.min(1.0, clockGetElapsed() / pd);
}

function clockStart() {
  if (clockRunning) return;
  clockRunning = true;
  clockStartTime = Date.now();
  clockInterval = setInterval(updateClockDisplay, 1000);
  updateClockDisplay();
}

function clockStop() {
  if (!clockRunning) return;
  clockElapsed += (Date.now() - clockStartTime) / 1000;
  clockRunning = false;
  clockStartTime = null;
  if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
  updateClockDisplay();
}

function clockReset() {
  clockStop();
  clockElapsed = 0;
  updateClockDisplay();
  renderLineup();
}

function clockToggle() {
  clockRunning ? clockStop() : clockStart();
  renderLineup();
}

function clockAdvancePeriod(newPeriodIdx) {
  clockReset();
  clockPeriodIdx = newPeriodIdx;
}

function updateClockDisplay() {
  const el = document.getElementById('gameClock');
  if (!el) return;
  const pd = getActivePeriodDuration();
  if (!pd) { el.textContent = '0:00'; return; }
  const frac = Math.min(clockGetFraction(), 1.0);
  const timeDisp = getActiveTimeDisplay();
  el.textContent = timeDisp === 'remaining'
    ? fractionToRemaining(frac, pd)
    : fractionToElapsed(frac, pd);
  el.classList.toggle('running', clockRunning);
  el.classList.toggle('done', clockGetElapsed() >= pd);
}

function toggleTimeDisplay() {
  if (!currentPlan || !ctx) return;
  currentPlan.timeDisplay = getActiveTimeDisplay() === 'elapsed' ? 'remaining' : 'elapsed';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

// -- Display Name Helper (jersey number + name) --------------------------

/** Returns display name for a player: "Alex #7" if number exists, else "Alex" (plain text for toasts/share) */
function displayName(pid) {
  if (!roster || !roster.players[pid]) return '[Unknown]';
  const p = roster.players[pid];
  return p.number ? `${p.name} #${p.number}` : p.name;
}

/** Returns HTML display name with muted jersey number span (for rendered UI) */
function displayNameHtml(pid) {
  if (!roster || !roster.players[pid]) return '<span class="player-unknown">[Unknown]</span>';
  const p = roster.players[pid];
  if (p.number) return `${esc(p.name)}<span class="player-number">#${esc(p.number)}</span>`;
  return esc(p.name);
}

/** Returns SVG text content with muted tspan for jersey number */
function displayNameSvg(pid) {
  if (!roster || !roster.players[pid]) return '<tspan fill="var(--fg2)" font-style="italic">[Unknown]</tspan>';
  const p = roster.players[pid];
  if (p.number) return `${esc(p.name)}<tspan fill="var(--fg2)" font-size="9"> #${esc(p.number)}</tspan>`;
  return esc(p.name);
}

// -- Player Data Integrity Helpers ------------------------------------------

/** Returns only active (non-archived) player IDs from the roster */
function getActivePlayerIds() {
  if (!roster) return [];
  return Object.keys(roster.players).filter(pid => !roster.players[pid].archived);
}

/** Returns only archived player IDs from the roster */
function getArchivedPlayerIds() {
  if (!roster) return [];
  return Object.keys(roster.players).filter(pid => roster.players[pid].archived);
}

/** Check if a player appears in any game data for the current season */
function playerHasGameData(pid) {
  if (!ctx) return false;
  const games = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
  return games.some(g =>
    g.availablePlayers.includes(pid) ||
    g.periodAssignments.some(pa =>
      extractPidsFromAssignments(pa.assignments).includes(pid) ||
      (pa.bench && pa.bench.includes(pid))
    )
  );
}

/**
 * Find a player by name (case-insensitive, trimmed) in the roster.
 * @param {string} name - name to search for
 * @param {string|null} excludePid - player ID to exclude from search (for rename)
 * @returns {{ pid: string, archived: boolean } | null}
 */
function findPlayerByName(name, excludePid = null) {
  if (!roster) return null;
  const normalized = name.trim().toLowerCase();
  for (const [pid, p] of Object.entries(roster.players)) {
    if (pid === excludePid) continue;
    if (p.name.trim().toLowerCase() === normalized) {
      return { pid, archived: !!p.archived };
    }
  }
  return null;
}

// -- Position Input Sanitization -----------------------------------------

/**
 * Sanitize a raw position string into a clean array.
 * Rules: auto-uppercase, collapse whitespace, deduplicate, truncate tokens > 5 chars.
 * If no commas detected, treats spaces as delimiters.
 * Returns { positions: string[], changed: boolean, deduped: boolean }
 */
function sanitizePositions(rawStr) {
  const hasCommas = rawStr.includes(',');
  let tokens;
  if (hasCommas) {
    tokens = rawStr.split(',');
  } else {
    tokens = rawStr.split(/\s+/);
  }

  tokens = tokens
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0)
    .map(t => t.slice(0, 5));

  const seen = new Set();
  const deduped = [];
  let hadDuplicates = false;
  for (const t of tokens) {
    if (seen.has(t)) {
      hadDuplicates = true;
    } else {
      seen.add(t);
      deduped.push(t);
    }
  }

  const cleaned = deduped.join(', ');
  const changed = cleaned !== rawStr.trim();

  return { positions: deduped, changed, deduped: hadDuplicates };
}

// -- Backup Indicator ----------------------------------------------------

/** Mark that data has been modified since last backup */
function markDataDirty() {
  localStorage.setItem('rot_lastDataChangeAt', String(Date.now()));
  updateBackupIndicator();
}

/** Mark that a backup was just completed */
function markBackupDone() {
  localStorage.setItem('rot_lastBackupAt', String(Date.now()));
  updateBackupIndicator();
}

/** Returns true if data has changed since last backup */
function hasUnsavedChanges() {
  const lastChange = parseInt(localStorage.getItem('rot_lastDataChangeAt') || '0');
  const lastBackup = parseInt(localStorage.getItem('rot_lastBackupAt') || '0');
  return lastChange > lastBackup;
}

/** Update the visual indicator on the menu button */
function updateBackupIndicator() {
  const btn = document.querySelector('.header-menu-btn');
  if (!btn) return;
  if (hasUnsavedChanges()) {
    btn.classList.add('has-unsaved');
  } else {
    btn.classList.remove('has-unsaved');
  }
}

/**
 * Returns the display label for a period count.
 *   getPeriodLabel(4)        => 'Quarter'
 *   getPeriodLabel(2)        => 'Half'
 *   getPeriodLabel(3)        => 'Period'
 *   getPeriodLabel(4, true)  => 'Q'
 *   getPeriodLabel(3, true)  => 'P'
 */
function getPeriodLabel(n, short) {
  if (n === 1) return short ? 'G' : 'Game';
  if (n === 4) return short ? 'Q' : 'Quarter';
  if (n === 2) return short ? 'H' : 'Half';
  return short ? 'P' : 'Period';
}

/** Plural lowercase: "quarters", "halves", "periods" */
function getPeriodLabelPlural(n) {
  if (n === 1) return 'game';
  if (n === 4) return 'quarters';
  if (n === 2) return 'halves';
  return 'periods';
}

/**
 * Returns the "special" position for the current sport (GK, G, P, C, etc.)
 *  --  the position that often has max-period constraints.
 * Returns null for sports where no position is clearly special (basketball).
 */
function getSpecialPosition() {
  if (!roster || !roster.positions || roster.positions.length === 0) return null;
  const preset = getSeasonPreset();
  // Sports with a clearly special first position
  const specialPresets = new Set([
    'soccer-7v7', 'soccer-9v9', 'soccer-11v11',
    'hockey', 'lacrosse',
  ]);
  if (preset && specialPresets.has(preset)) return roster.positions[0];
  // Fallback: if positions[0] is a known keeper-type name
  const knownSpecial = new Set(['GK', 'G']);
  if (knownSpecial.has(roster.positions[0])) return roster.positions[0];
  return null;
}

// -- Init -----------------------------------------------------------
function init() {
  // Wrap Storage mutation methods to auto-track data changes for backup indicator
  for (const method of ['saveRoster', 'saveGame', 'deleteGame', 'savePlays', 'deleteTeam', 'deleteSeason', 'importBackup', 'importSharedTeam']) {
    const orig = Storage[method].bind(Storage);
    Storage[method] = function(...args) {
      const result = orig(...args);
      markDataDirty();
      return result;
    };
  }

  // Apply theme before anything renders
  const settings = loadSettings();
  applyTheme(settings.theme);
  applyColorblind(settings.colorblind);

  // Listen for OS theme changes when using "System" setting
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      const s = loadSettings();
      if (s.theme === 'system') applyTheme('system');
    });
  }

  teams = Storage.loadTeams();
  ctx = Storage.loadContext();

  if (!ctx && teams.length > 0) {
    const seasons = Storage.loadSeasons(teams[0].slug);
    if (seasons.length > 0) {
      ctx = { teamSlug: teams[0].slug, seasonSlug: seasons[0].slug };
      Storage.saveContext(ctx);
    }
  }

  if (!ctx) {
    updateContextLabel();
    showWelcome();
    updateBackupIndicator();
    setupTabSwipe();
    // Pulse the context label to draw attention on first launch
    if (teams.length === 0) {
      const cl = document.getElementById('contextLabel');
      if (cl) cl.classList.add('pulse-hint');
    }
    return;
  }

  loadContextData();
  updateBackupIndicator();
  setupTabSwipe();
}

// -- Tab Swipe Gesture ------------------------------------------------

function setupTabSwipe() {
  const app = document.getElementById('app');
  if (!app) return;

  let startX = 0, startY = 0, tracking = false, decided = false;

  app.addEventListener('touchstart', (e) => {
    // Skip if a modal is open
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    // Skip if touch started on an interactive field element
    const t = e.target;
    if (t.closest && (t.closest('.dot-overlay') || t.closest('.def-overlay') || t.closest('.field-draw-layer'))) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
    decided = false;
  }, { passive: true });

  app.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;

    // Decide direction once we have enough movement
    if (!decided && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      decided = true;
      if (Math.abs(dy) > Math.abs(dx) * 0.7) {
        // Vertical scroll — stop tracking
        tracking = false;
        return;
      }
    }
    if (!decided) return;

    // Check if swiping toward a valid tab
    const buttons = [...document.querySelectorAll('nav button')];
    const activeIdx = buttons.findIndex(b => b.classList.contains('active'));
    const nextIdx = dx < 0 ? activeIdx + 1 : activeIdx - 1;
    if (nextIdx < 0 || nextIdx >= buttons.length) return;

    // Apply dampened transform to current tab (peek effect)
    const activeTab = document.querySelector('.tab-content:not(.hidden)');
    if (activeTab) {
      const dampened = dx * 0.25;
      activeTab.style.transform = `translateX(${dampened}px)`;
      activeTab.style.opacity = String(Math.max(0.75, 1 - Math.abs(dx) / 400));
    }
  }, { passive: true });

  app.addEventListener('touchend', (e) => {
    if (!tracking) { tracking = false; return; }
    tracking = false;

    const dx = e.changedTouches[0].clientX - startX;
    const activeTab = document.querySelector('.tab-content:not(.hidden)');
    const buttons = [...document.querySelectorAll('nav button')];
    const activeIdx = buttons.findIndex(b => b.classList.contains('active'));
    const nextIdx = dx < 0 ? activeIdx + 1 : activeIdx - 1;
    const canSwitch = decided && Math.abs(dx) >= 60 && nextIdx >= 0 && nextIdx < buttons.length;

    if (canSwitch && activeTab) {
      // Slide out current tab
      const outDir = dx < 0 ? '-100%' : '100%';
      activeTab.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
      activeTab.style.transform = `translateX(${outDir})`;
      activeTab.style.opacity = '0';

      setTimeout(() => {
        // Clean up old tab and switch
        activeTab.style.transition = '';
        activeTab.style.transform = '';
        activeTab.style.opacity = '';
        buttons[nextIdx].click();

        // Slide in new tab
        const newTab = document.querySelector('.tab-content:not(.hidden)');
        if (newTab) {
          const inDir = dx < 0 ? '30%' : '-30%';
          newTab.style.transform = `translateX(${inDir})`;
          newTab.style.opacity = '0';
          requestAnimationFrame(() => {
            newTab.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out';
            newTab.style.transform = 'translateX(0)';
            newTab.style.opacity = '1';
            setTimeout(() => {
              newTab.style.transition = '';
              newTab.style.transform = '';
              newTab.style.opacity = '';
            }, 200);
          });
        }
      }, 180);
    } else if (activeTab) {
      // Snap back — didn't meet threshold
      activeTab.style.transition = 'transform 0.15s ease-out, opacity 0.15s ease-out';
      activeTab.style.transform = 'translateX(0)';
      activeTab.style.opacity = '1';
      setTimeout(() => {
        activeTab.style.transition = '';
        activeTab.style.transform = '';
        activeTab.style.opacity = '';
      }, 160);
    }
  }, { passive: true });
}

function loadContextData() {
  roster = Storage.loadRoster(ctx.teamSlug, ctx.seasonSlug);
  if (!roster) {
    const seasons = Storage.loadSeasons(ctx.teamSlug);
    const season = seasons.find(s => s.slug === ctx.seasonSlug);
    const positions = season?.positions || [...DEFAULT_POSITIONS];
    roster = { players: {}, positions };
    Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
  }

  fieldFormationIdx = 0;
  fieldPeriodIdx = 0;
  fieldDotPositions = {};
  fieldActivePlayId = null;
  fieldPlayFilter = '';
  fieldDrawMode = false;
  fieldRoutes = [];
  fieldDrawState = null;
  fieldSelectedRoute = null;
  fieldDefenseOn = false;
  fieldDefenseMarkers = [];
  fieldZoneMode = false;
  fieldZones = [];
  fieldSelectedZone = null;
  fieldPlays = Storage.loadPlays(ctx.teamSlug, ctx.seasonSlug);
  swapSelection = null;
  collapsedPeriods.clear();
  availDragState = null;
  availDropIdx = null;
  availReorderFlash = null;

  // Reset constraints
  gameLocks = {};
  gameContinuity = 0;
  gamePositionMax = {};
  gameGlobalMaxPeriods = null;
  lockPickerOpen = null;

  document.getElementById('gameDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('numPosLabel').textContent = roster.positions.length;

  // Apply settings defaults
  const settings = loadSettings();
  document.getElementById('gamePeriods').value = String(settings.defaultPeriods);
  starterMode = settings.defaultStarterMode;
  document.getElementById('toggleStarters').classList.toggle('on', starterMode);
  gameContinuity = settings.defaultContinuity || 0;
  gameGlobalMaxPeriods = settings.defaultGlobalMaxPeriods || null;

  // Restore roster/gameday elements hidden by field-only mode
  const rosterCard = document.querySelector('#tab-roster > .card');
  if (rosterCard) rosterCard.style.display = '';
  const rosterWelcome = document.getElementById('rosterWelcome');
  if (rosterWelcome) rosterWelcome.style.display = 'none';
  const gamedayTab = document.getElementById('tab-gameday');
  gamedayTab.querySelectorAll(':scope > .card, :scope > .btn').forEach(el => el.style.display = '');
  const gdEmpty = document.getElementById('gamedayEmpty');
  if (gdEmpty) gdEmpty.style.display = 'none';

  // Remove context label pulse once a team is active
  const ctxLabel = document.getElementById('contextLabel');
  if (ctxLabel) ctxLabel.classList.remove('pulse-hint');

  updateContextLabel();
  renderRoster();
  renderAvailableList();
  renderLineup();
  renderSeason();
  renderField();

  // Show hint for the currently visible tab (roster on init)
  showTabHint('roster');
}

function getSportIcon(teamSlug, seasonSlug) {
  if (!teamSlug) return '';
  const seasons = Storage.loadSeasons(teamSlug);
  const season = seasonSlug
    ? seasons.find(s => s.slug === seasonSlug)
    : seasons[0];
  if (!season) return '';
  const preset = season.preset || null;
  if (preset && SPORT_ICONS[preset]) return SPORT_ICONS[preset];
  // Auto-detect from positions
  const r = Storage.loadRoster(teamSlug, season.slug);
  if (r) {
    const matched = matchPresetFromPositions(r.positions);
    if (matched && SPORT_ICONS[matched]) return SPORT_ICONS[matched];
  }
  return '';
}

function updateContextLabel() {
  const label = document.getElementById('contextLabel');
  if (!ctx) {
    label.textContent = teams.length > 0 ? '\uD83C\uDFDF\uFE0F Field Only' : 'No team';
    return;
  }
  const team = teams.find(t => t.slug === ctx.teamSlug);
  const seasons = Storage.loadSeasons(ctx.teamSlug);
  const season = seasons.find(s => s.slug === ctx.seasonSlug);
  const tName = team?.name || ctx.teamSlug;
  const sName = season?.name || ctx.seasonSlug;
  const icon = getSportIcon(ctx.teamSlug, ctx.seasonSlug);
  label.textContent = `${icon} ${tName}  -  ${sName}`;
}

function showWelcome() {
  // Reset state
  roster = null;
  currentPlan = null;
  availableOrder = [];
  availDragState = null;
  availDropIdx = null;
  availReorderFlash = null;
  gameLocks = {};
  gameContinuity = 0;
  gamePositionMax = {};
  gameGlobalMaxPeriods = null;
  lockPickerOpen = null;
  swapSelection = null;
  swapHighlight = null;
  collapsedPeriods.clear();
  document.getElementById('rosterList').innerHTML = '';
  const rosterCard = document.querySelector('#tab-roster > .card');
  if (rosterCard) rosterCard.style.display = 'none';
  let rosterEmpty = document.getElementById('rosterWelcome');
  if (!rosterEmpty) {
    rosterEmpty = document.createElement('div');
    rosterEmpty.id = 'rosterWelcome';
    rosterEmpty.className = 'empty-state';
    document.getElementById('tab-roster').prepend(rosterEmpty);
  }
  rosterEmpty.innerHTML = welcomeEmptyState('Select or create a team to manage your roster');
  rosterEmpty.style.display = '';

  // Lineup
  document.getElementById('lineupContent').innerHTML =
    '<div class="empty-state">' + welcomeEmptyState('Select or create a team to manage lineups') + '</div>';

  // Season
  document.getElementById('seasonContent').innerHTML =
    '<div class="empty-state">' + welcomeEmptyState('Select or create a team to view season data') + '</div>';

  // Game Day — hide cards, show message
  const gamedayTab = document.getElementById('tab-gameday');
  gamedayTab.querySelectorAll(':scope > .card, :scope > .btn').forEach(el => el.style.display = 'none');
  let gdEmpty = document.getElementById('gamedayEmpty');
  if (!gdEmpty) {
    gdEmpty = document.createElement('div');
    gdEmpty.id = 'gamedayEmpty';
    gdEmpty.className = 'empty-state';
    gamedayTab.prepend(gdEmpty);
  }
  gdEmpty.innerHTML = welcomeEmptyState('Select or create a team to set up games');
  gdEmpty.style.display = '';
  // Clear Game Day state
  document.getElementById('availableList').innerHTML = '';
  const rpl = document.getElementById('rosterPickList');
  if (rpl) rpl.innerHTML = '';
  document.getElementById('availCount').textContent = '0';
  const rc = document.getElementById('rosterCount');
  if (rc) rc.textContent = '0';
  document.getElementById('generateBtn').disabled = true;
  const cc = document.getElementById('constraintControls');
  if (cc) { cc.innerHTML = ''; cc.classList.add('hidden'); }
  const cb = document.getElementById('constraintBadge');
  if (cb) { cb.textContent = ''; cb.classList.add('hidden'); }
  // Clear Field
  fieldPlays = Storage.loadPlays('__standalone__', '__standalone__');
  fieldActivePlayId = null;
  fieldPlayFilter = '';
  renderField();
}

// -- Tab Switching --------------------------------------------------
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
  document.getElementById('tab-' + name).classList.remove('hidden');
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  if (name === 'gameday') renderAvailableList();
  if (name === 'season') renderSeason();
  if (name === 'field') renderField();

  showTabHint(name);
}

// -- Tab Hints (first-use contextual tips) ----------------------------

const TAB_HINTS = {
  roster: '\u2022 Tap <strong>+ Add</strong> to add players.<br>\u2022 Tap any player to set position preferences.',
  gameday: '\u2022 Tap players on the left to add them to the game.<br>\u2022 Drag to reorder \u2014 first in list start (if enabled).<br>\u2022 Tap a name to lock a position.<br>\u2022 Then tap <strong>Generate Lineup</strong>.',
  lineup: '\u2022 Tap two players in the same period to <strong>swap</strong>.<br>\u2022 <strong>Edit</strong> in-game lineup availability and rebalance.<br>\u2022 Use <strong>+/\u2212</strong> to track goals.<br>\u2022 Check <strong>Scrimmage</strong> to exclude from season stats.',
  season: '\u2022 Select <strong>tabs</strong> to explore season stats.',
  field: '\u2022 Drag dots to arrange formations.<br>\u2022 Use the <strong>pencil</strong> and <strong>box</strong> to draw routes and zones.<br>\u2022 Toggle on/off player labels (<strong>Aa</strong>) and defense (<strong>DEF</strong>).<br>\u2022 Create and save plays for quick reuse.',
};

function showTabHint(tabName) {
  // Only show hints when a team is active
  if (!ctx) return;

  const hintKey = 'rot_hint_' + tabName;
  if (localStorage.getItem(hintKey)) return;

  const tab = document.getElementById('tab-' + tabName);
  if (!tab) return;

  // Don't duplicate
  if (tab.querySelector('.tab-hint')) return;

  const msg = TAB_HINTS[tabName];
  if (!msg) return;

  const hint = document.createElement('div');
  hint.className = 'tab-hint';
  hint.innerHTML = `<span>${msg}</span><button class="tab-hint-dismiss" onclick="dismissHint('${tabName}')" aria-label="Dismiss">&#x2715;</button>`;
  tab.prepend(hint);
}

function dismissHint(tabName) {
  localStorage.setItem('rot_hint_' + tabName, '1');
  const tab = document.getElementById('tab-' + tabName);
  const hint = tab?.querySelector('.tab-hint');
  if (hint) hint.remove();
}

// -- Context Picker -------------------------------------------------
function openContextPicker() {
  const cl = document.getElementById('contextLabel');
  if (cl) cl.classList.remove('pulse-hint');
  ctxPickTeam = ctx ? ctx.teamSlug : '__fieldonly__';
  ctxPickSeason = ctx?.seasonSlug || null;
  renderContextPicker();
  document.getElementById('contextModal').classList.remove('hidden');
}

function closeContextPicker() {
  document.getElementById('contextModal').classList.add('hidden');
}

function renderContextPicker() {
  const el = document.getElementById('contextPickerContent');
  teams = Storage.loadTeams();

  let html = '<div class="ctx-section"><div class="ctx-section-title">Team</div><div class="ctx-chips">';
  const fieldOnlySel = ctxPickTeam === '__fieldonly__' ? ' selected' : '';
  html += `<button class="ctx-chip${fieldOnlySel}" onclick="pickFieldOnly()">\uD83C\uDFDF\uFE0F Field Only</button>`;
  for (const t of teams) {
    const sel = t.slug === ctxPickTeam ? ' selected' : '';
    const icon = getSportIcon(t.slug, null);
    html += `<button class="ctx-chip${sel}" onclick="pickTeam('${t.slug}')">${icon} ${esc(t.name)}</button>`;
  }
  html += '<button class="ctx-chip add-new" onclick="openTeamModal()">+ New</button>';
  html += '</div></div>';

  if (ctxPickTeam && ctxPickTeam !== '__fieldonly__') {
    const seasons = Storage.loadSeasons(ctxPickTeam);
    html += '<div class="ctx-section"><div class="ctx-section-title">Season</div><div class="ctx-chips">';
    for (const s of seasons) {
      const sel = s.slug === ctxPickSeason ? ' selected' : '';
      html += `<button class="ctx-chip${sel}" onclick="pickSeason('${s.slug}')">${esc(s.name)}</button>`;
    }
    html += '<button class="ctx-chip add-new" onclick="openSeasonModal()">+ New</button>';
    html += '</div></div>';

    if (ctxPickSeason) {
      const isCurrentCtx = ctx && ctx.teamSlug === ctxPickTeam && ctx.seasonSlug === ctxPickSeason;
      html += `<button class="btn btn-primary mt-12" onclick="applyContext()" ${isCurrentCtx ? 'disabled' : ''}>
        ${isCurrentCtx ? 'Currently Active' : 'Switch'}
      </button>`;
    }

    html += '<hr class="ctx-divider">';
    html += '<div class="ctx-section-title" style="margin-bottom:8px">Manage</div>';
    html += '<div class="ctx-manage-btns">';
    if (ctxPickSeason) {
      html += '<button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="confirmDeleteSeason()">Delete Season</button>';
    }
    html += '<button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:var(--danger)" onclick="confirmDeleteTeam()">Delete Team</button>';
    html += '</div>';
  }

  if (ctxPickTeam === '__fieldonly__') {
    const isAlreadyFieldOnly = !ctx;
    html += `<button class="btn btn-primary mt-12" onclick="applyContext()" ${isAlreadyFieldOnly ? 'disabled' : ''}>
      ${isAlreadyFieldOnly ? 'Currently Active' : 'Switch'}
    </button>`;
  }

  el.innerHTML = html;
}

function pickFieldOnly() {
  ctxPickTeam = '__fieldonly__';
  ctxPickSeason = null;
  renderContextPicker();
}

function pickTeam(slug) {
  ctxPickTeam = slug;
  const seasons = Storage.loadSeasons(slug);
  ctxPickSeason = seasons.length > 0 ? seasons[0].slug : null;
  renderContextPicker();
}

function pickSeason(slug) {
  ctxPickSeason = slug;
  renderContextPicker();
}

function applyContext() {
  if (ctxPickTeam === '__fieldonly__') {
    ctx = null;
    Storage.saveContext(null);
    updateContextLabel();
    showWelcome();
    closeContextPicker();
    showToast('Field Only mode', 'success');
    return;
  }
  if (!ctxPickTeam || !ctxPickSeason) return;
  ctx = { teamSlug: ctxPickTeam, seasonSlug: ctxPickSeason };
  Storage.saveContext(ctx);
  currentPlan = null;
  availableOrder = [];
  availDragState = null;
  availDropIdx = null;
  availReorderFlash = null;
  loadContextData();
  closeContextPicker();
  showToast('Switched context', 'success');
}

function confirmDeleteSeason() {
  if (!ctxPickTeam || !ctxPickSeason) return;
  const seasons = Storage.loadSeasons(ctxPickTeam);
  const season = seasons.find(s => s.slug === ctxPickSeason);
  showModal({
    title: 'Delete Season',
    message: `Delete season "${season?.name || ctxPickSeason}"?\n\nThis removes all games and roster data for this season.`,
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => {
      Storage.deleteSeason(ctxPickTeam, ctxPickSeason);

      if (ctx && ctx.teamSlug === ctxPickTeam && ctx.seasonSlug === ctxPickSeason) {
        const remaining = Storage.loadSeasons(ctxPickTeam);
        ctx = remaining.length > 0
          ? { teamSlug: ctxPickTeam, seasonSlug: remaining[0].slug }
          : null;
        Storage.saveContext(ctx);
        if (ctx) loadContextData();
        else { updateContextLabel(); showWelcome(); }
      }

      ctxPickSeason = null;
      renderContextPicker();
      showToast('Season deleted', 'success');
    }
  });
}

function confirmDeleteTeam() {
  if (!ctxPickTeam) return;
  const team = teams.find(t => t.slug === ctxPickTeam);
  showModal({
    title: 'Delete Team',
    message: `Delete team "${team?.name || ctxPickTeam}" and ALL its seasons?\n\nThis cannot be undone.`,
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => {
      Storage.deleteTeam(ctxPickTeam);
      teams = Storage.loadTeams();

      if (ctx && ctx.teamSlug === ctxPickTeam) {
        if (teams.length > 0) {
          const seasons = Storage.loadSeasons(teams[0].slug);
          ctx = seasons.length > 0
            ? { teamSlug: teams[0].slug, seasonSlug: seasons[0].slug }
            : null;
        } else {
          ctx = null;
        }
        Storage.saveContext(ctx);
        if (ctx) loadContextData();
        else { updateContextLabel(); showWelcome(); }
      }

      ctxPickTeam = null;
      ctxPickSeason = null;
      renderContextPicker();
      showToast('Team deleted', 'success');
    }
  });
}

// -- Team Modal -----------------------------------------------------
function openTeamModal() {
  closeContextPicker();
  document.getElementById('teamModalTitle').textContent = 'New Team';
  document.getElementById('teamNameInput').value = '';
  document.getElementById('teamModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('teamNameInput').focus(), 100);
}

function closeTeamModal() {
  document.getElementById('teamModal').classList.add('hidden');
}

function saveTeam() {
  const el = document.getElementById('teamNameInput');
  const name = el.value.trim();
  if (!name) { pulseInvalid(el); return; }

  const slug = slugify(name);
  if (!slug) return;

  if (teams.find(t => t.slug === slug)) {
    showToast('A team with a similar name already exists', 'error');
    return;
  }

  Storage.addTeam({ slug, name });
  teams = Storage.loadTeams();
  closeTeamModal();
  ctxPickTeam = slug;
  ctxPickSeason = null;
  openSeasonModal();
  renderContextPicker();
}

// -- Season Modal ---------------------------------------------------
function openSeasonModal() {
  closeContextPicker();
  if (!ctxPickTeam) return;
  document.getElementById('seasonModalTitle').textContent = 'New Season';
  document.getElementById('seasonNameInput').value = '';

  // Populate sport dropdown
  const sportSel = document.getElementById('sportSelect');
  sportSel.innerHTML = Object.entries(SPORTS).map(([key, s]) =>
    `<option value="${key}">${s.icon} ${s.name}</option>`
  ).join('');
  sportSel.value = loadSettings().defaultSport || 'soccer';
  onSportChange();
  // Apply default format after sport change populated the format dropdown
  const defFormat = loadSettings().defaultFormat || '';
  const fmtSel = document.getElementById('formatSelect');
  if (fmtSel && defFormat) {
    const opts = Array.from(fmtSel.options).map(o => o.value);
    if (opts.includes(defFormat)) fmtSel.value = defFormat;
  }
  onFormatChange();

  const seasons = Storage.loadSeasons(ctxPickTeam);
  const copyRow = document.getElementById('copyRosterRow');
  if (seasons.length > 0) {
    const lastSeason = seasons[seasons.length - 1];
    document.getElementById('copyFromLabel').textContent = lastSeason.name;
    copyRow.classList.remove('hidden');
    copyRosterEnabled = true;
    document.getElementById('toggleCopyRoster').classList.add('on');
  } else {
    copyRow.classList.add('hidden');
    copyRosterEnabled = false;
  }

  document.getElementById('seasonModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('seasonNameInput').focus(), 100);
}

function closeSeasonModal() {
  document.getElementById('seasonModal').classList.add('hidden');
}

function onSportChange() {
  const sportKey = document.getElementById('sportSelect').value;
  const sport = SPORTS[sportKey];
  if (!sport) return;

  const formatSel = document.getElementById('formatSelect');
  const formatRow = document.getElementById('formatRow');

  formatSel.innerHTML = sport.formats.map(f =>
    `<option value="${f.key}">${f.name}</option>`
  ).join('');
  formatSel.value = sport.formats[0].key;

  // Show format row for all sports (hidden only for custom where positions are freeform)
  formatRow.style.display = sportKey === 'custom' ? 'none' : '';

  onFormatChange();
}

function onFormatChange() {
  const sportKey = document.getElementById('sportSelect').value;
  const formatKey = document.getElementById('formatSelect').value;
  const preset = makePresetKey(sportKey, formatKey);
  const positions = POSITION_PRESETS[preset] || [];
  document.getElementById('positionsInput').value = positions.join(', ');
}

function getSelectedPreset() {
  const sportKey = document.getElementById('sportSelect').value;
  const formatKey = document.getElementById('formatSelect').value;
  return makePresetKey(sportKey, formatKey);
}

function toggleCopyRoster() {
  copyRosterEnabled = !copyRosterEnabled;
  document.getElementById('toggleCopyRoster').classList.toggle('on', copyRosterEnabled);
}

function handlePositionBlur() {
  const input = document.getElementById('positionsInput');
  if (!input) return;
  const result = sanitizePositions(input.value);
  if (result.changed) {
    input.value = result.positions.join(', ');
    if (result.deduped) {
      showToast('Duplicate positions removed', 'success');
    } else {
      showToast('Positions formatted', 'success');
    }
  }
}

function saveSeason() {
  const el = document.getElementById('seasonNameInput');
  const name = el.value.trim();
  if (!name) { pulseInvalid(el); return; }

  const slug = slugify(name);
  if (!slug) { pulseInvalid(el); return; }

  const posEl = document.getElementById('positionsInput');
  const posStr = posEl.value;
  const result = sanitizePositions(posStr);
  const positions = result.positions;
  if (positions.length < 2) {
    pulseInvalid(posEl);
    showToast('Need at least 2 positions', 'error');
    return;
  }

  const existingSeasons = Storage.loadSeasons(ctxPickTeam);
  if (existingSeasons.find(s => s.slug === slug)) {
    showToast('A season with a similar name already exists', 'error');
    return;
  }

  Storage.addSeason(ctxPickTeam, { slug, name, positions, preset: getSelectedPreset() });

  if (copyRosterEnabled && existingSeasons.length > 0) {
    const lastSeason = existingSeasons[existingSeasons.length - 1];
    const oldRoster = Storage.loadRoster(ctxPickTeam, lastSeason.slug);
    if (oldRoster) {
      // Copy only active (non-archived) players to new season
      const activePlayers = {};
      for (const [pid, p] of Object.entries(oldRoster.players)) {
        if (!p.archived) {
          activePlayers[pid] = JSON.parse(JSON.stringify(p));
        }
      }
      Storage.saveRoster(ctxPickTeam, slug, {
        positions,
        players: activePlayers,
      });
    }
  } else {
    const defaultPlayers = {};
    const numPlayers = positions.length + 3;
    for (let i = 1; i <= numPlayers; i++) {
      const pid = 'p' + String(i).padStart(2, '0');
      defaultPlayers[pid] = { name: `Player ${i}`, positionWeights: {} };
    }
    Storage.saveRoster(ctxPickTeam, slug, { positions, players: defaultPlayers });
  }

  closeSeasonModal();
  closeContextPicker();

  ctxPickSeason = slug;
  ctx = { teamSlug: ctxPickTeam, seasonSlug: slug };
  Storage.saveContext(ctx);
  currentPlan = null;
  availableOrder = [];
  availDragState = null;
  availDropIdx = null;
  availReorderFlash = null;
  loadContextData();

  document.querySelectorAll('nav button')[0].click();
  showToast(`Created season: ${name}`, 'success');
}

// -- Roster Management ----------------------------------------------
function renderRoster() {
  if (!roster) return;
  const list = document.getElementById('rosterList');
  const empty = document.getElementById('rosterEmpty');
  const activeIds = getActivePlayerIds();
  const archivedIds = getArchivedPlayerIds();

  if (activeIds.length === 0 && archivedIds.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  let html = activeIds.map((pid, i) => {
    const p = roster.players[pid];
    const weights = p.positionWeights || {};
    const badges = Object.entries(weights).map(([pos, w]) => {
      if (w === 0) return `<span class="badge exclude">${pos}</span>`;
      if (w === 2) return `<span class="badge prefer">${pos}</span>`;
      if (w === 3) return `<span class="badge strong">${pos}</span>`;
      return '';
    }).filter(Boolean).join('');

    return `
      <li class="player-item" onclick="openPlayerModal('${pid}')">
        <span class="player-num">${i + 1}</span>
        <span class="player-name">${displayNameHtml(pid)}</span>
        <div class="player-badges">${badges}</div>
        <button class="edit-btn" aria-label="Edit ${esc(p.name)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
      </li>
    `;
  }).join('');

  // Archived Players section (collapsed by default)
  if (archivedIds.length > 0) {
    html += `
      <li class="archived-section-header" onclick="toggleArchivedSection()">
        <span class="archived-chevron" id="archivedChevron">&#x25B8;</span>
        <span class="archived-section-label">Archived Players (${archivedIds.length})</span>
      </li>
    `;
    html += `<div id="archivedPlayersList" class="archived-players-list" style="display:none">`;
    html += archivedIds.map(pid => {
      const p = roster.players[pid];
      return `
        <li class="player-item archived-player-item">
          <span class="player-name archived-name">${esc(p.name)}${p.number ? `<span class="player-number">#${esc(p.number)}</span>` : ''}</span>
          <button class="btn btn-sm btn-outline" onclick="restorePlayer('${pid}')">Restore</button>
        </li>
      `;
    }).join('');
    html += `</div>`;
  }

  list.innerHTML = html;
}

function toggleArchivedSection() {
  const list = document.getElementById('archivedPlayersList');
  const chevron = document.getElementById('archivedChevron');
  if (!list || !chevron) return;
  const isHidden = list.style.display === 'none';
  list.style.display = isHidden ? '' : 'none';
  chevron.innerHTML = isHidden ? '&#x25BE;' : '&#x25B8;';
}

function restorePlayer(pid) {
  if (!ctx || !roster || !roster.players[pid]) return;
  delete roster.players[pid].archived;
  Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
  markDataDirty();
  renderRoster();
  renderAvailableList();
  showToast(`${roster.players[pid].name} restored`, 'success');
}

function openPlayerModal(pid = null) {
  if (!roster) return;
  editingPlayerId = pid;
  const nameInput = document.getElementById('modalPlayerName');
  const numInput = document.getElementById('modalPlayerNum');
  const deleteRow = document.getElementById('deleteRow');

  if (pid && roster.players[pid]) {
    document.getElementById('modalTitle').textContent = 'Edit Player';
    nameInput.value = roster.players[pid].name;
    numInput.value = roster.players[pid].number || '';
    modalWeights = { ...(roster.players[pid].positionWeights || {}) };
    deleteRow.classList.remove('hidden');
  } else {
    document.getElementById('modalTitle').textContent = 'Add Player';
    nameInput.value = '';
    numInput.value = '';
    modalWeights = {};
    deleteRow.classList.add('hidden');
  }

  renderWeightGrid();
  document.getElementById('playerModal').classList.remove('hidden');
  setTimeout(() => nameInput.focus(), 100);
}

function closePlayerModal() {
  document.getElementById('playerModal').classList.add('hidden');
}

function renderWeightGrid() {
  if (!roster) return;
  const grid = document.getElementById('weightGrid');
  grid.innerHTML = roster.positions.map(pos => {
    const w = modalWeights[pos] ?? 1;
    const label = WEIGHT_LABELS[w] || `x${w}`;
    const cls = WEIGHT_CLASSES[w] || '';
    return `
      <div class="weight-item" onclick="cycleWeight('${pos}')">
        <div class="pos-label">${pos}</div>
        <div class="badge ${cls}" style="display:inline-block;font-size:11px">${label}</div>
      </div>
    `;
  }).join('');
}

function cycleWeight(pos) {
  const current = modalWeights[pos] ?? 1;
  const idx = WEIGHT_CYCLE.indexOf(current);
  const next = WEIGHT_CYCLE[(idx + 1) % WEIGHT_CYCLE.length];
  if (next === 1) delete modalWeights[pos];
  else modalWeights[pos] = next;
  renderWeightGrid();
}

function savePlayer() {
  if (!ctx || !roster) return;
  const el = document.getElementById('modalPlayerName');
  const name = el.value.trim();
  if (!name) { pulseInvalid(el); return; }

  const number = document.getElementById('modalPlayerNum').value.trim().slice(0, 2);

  // Unique name check (case-insensitive)
  const match = findPlayerByName(name, editingPlayerId);
  if (match) {
    if (match.archived) {
      // Offer to restore the archived player
      showModal({
        title: 'Restore Player?',
        message: `${name} was on this team before. Restore them instead of creating a new player?`,
        confirmLabel: 'Restore',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          delete roster.players[match.pid].archived;
          Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
          markDataDirty();
          renderRoster();
          renderAvailableList();
          closePlayerModal();
          showToast(`${name} restored`, 'success');
        }
      });
      return;
    } else {
      // Active player with same name — block
      showToast('A player named ' + name + ' already exists. Use a different name (e.g., ' + name + ' B.)', 'error');
      return;
    }
  }

  let pid = editingPlayerId;
  if (!pid) {
    const nums = Object.keys(roster.players)
      .map(k => parseInt(k.replace('p', '')))
      .filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    pid = 'p' + String(next).padStart(2, '0');
  }

  const playerData = {
    name,
    positionWeights: Object.keys(modalWeights).length > 0 ? { ...modalWeights } : {},
  };
  if (number) playerData.number = number;

  // Preserve archived flag if editing an existing player (shouldn't normally happen for archived, but safety)
  if (editingPlayerId && roster.players[editingPlayerId]?.archived) {
    playerData.archived = true;
  }

  roster.players[pid] = playerData;

  Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
  markDataDirty();
  renderRoster();
  renderAvailableList();
  closePlayerModal();
}

function deletePlayer() {
  if (!ctx || !roster || !editingPlayerId) return;
  const playerName = roster.players[editingPlayerId].name;
  const hasData = playerHasGameData(editingPlayerId);

  if (hasData) {
    // Archive instead of delete — player has game history
    showModal({
      title: 'Archive Player',
      message: `Archive ${playerName}? They have game history that will be preserved. You can restore them later from the Archived Players section.`,
      confirmLabel: 'Archive',
      destructive: true,
      onConfirm: () => {
        roster.players[editingPlayerId].archived = true;
        Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
        markDataDirty();
        renderRoster();
        renderAvailableList();
        closePlayerModal();
        showToast(`${playerName} archived`, 'success');
      }
    });
  } else {
    // No game data — hard delete
    showModal({
      title: 'Remove Player',
      message: `Remove ${playerName}?`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: () => {
        delete roster.players[editingPlayerId];
        Storage.saveRoster(ctx.teamSlug, ctx.seasonSlug, roster);
        markDataDirty();
        renderRoster();
        renderAvailableList();
        closePlayerModal();
      }
    });
  }
}

// -- Game Day -------------------------------------------------------
function renderAvailableList() {
  if (!roster) return;
  const ids = getActivePlayerIds();
  document.getElementById('numPosLabel').textContent = roster.positions.length;

  const existing = new Set(availableOrder.map(a => a.pid));
  for (const pid of ids) {
    if (!existing.has(pid)) {
      availableOrder.push({ pid, checked: false });
    }
  }
  // Filter out players no longer in roster OR archived
  availableOrder = availableOrder.filter(a => roster.players[a.pid] && !roster.players[a.pid].archived);
  renderAvailableItems();
  renderConstraintControls();
}

function renderAvailableItems() {
  if (!roster) return;
  const numPositions = roster.positions.length;
  const selected = availableOrder.filter(a => a.checked);
  const unselectedPids = availableOrder.filter(a => !a.checked).map(a => a.pid);

  // Sort unselected alphabetically by name
  unselectedPids.sort((a, b) => {
    const na = roster.players[a]?.name || '';
    const nb = roster.players[b]?.name || '';
    return na.localeCompare(nb);
  });

  const checkedCount = selected.length;

  // Update counts
  const totalPlayers = checkedCount + unselectedPids.length;
  document.getElementById('rosterCount').textContent = `${unselectedPids.length} / ${totalPlayers}`;
  document.getElementById('availCount').textContent = `${checkedCount} / ${totalPlayers}`;
  document.getElementById('generateBtn').disabled = checkedCount < numPositions;

  // ── Left column: Roster (unselected) ──
  const leftList = document.getElementById('rosterPickList');
  if (unselectedPids.length === 0) {
    leftList.innerHTML = '<li class="pickup-empty">All players selected</li>';
  } else {
    leftList.innerHTML = unselectedPids.map(pid => {
      const p = roster.players[pid];
      const numStr = p.number ? `<span class="player-number">#${esc(p.number)}</span>` : '';
      return `<li class="pickup-item" onclick="selectPlayer('${pid}')">${esc(p.name)}${numStr}</li>`;
    }).join('');
  }

  // ── Right column: Available Players (selected) ──
  const rightList = document.getElementById('availableList');
  const lockedPositions = new Set(Object.values(gameLocks));
  let starterIdx = 0;

  // Pin hint — always static
  const pinHintHtml = checkedCount > 0 ? '<div class="pin-hint">Tap a name to pin to a position</div>' : '';

  if (checkedCount === 0) {
    rightList.innerHTML = '<li class="pickup-empty">Tap players to add</li>';
  } else {
    // Build items using the order index within the full availableOrder
    let itemsHtml = '';
    let rightIdx = 0;
    for (let i = 0; i < availableOrder.length; i++) {
      const a = availableOrder[i];
      if (!a.checked) continue;

      const p = roster.players[a.pid];
      const isStarter = starterMode && starterIdx < numPositions;
      starterIdx++;

      const lock = gameLocks[a.pid];
      const lockBadge = lock ? `<span class="lock-badge" onclick="event.stopPropagation();removeLock('${a.pid}')" title="Tap to unpin">${lock} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></span>` : '';
      const isPickerOpen = lockPickerOpen === a.pid;

      let picker = '';
      if (isPickerOpen) {
        const weights = p.positionWeights || {};
        const chips = roster.positions.map(pos => {
          const w = weights[pos] ?? 1.0;
          const disabled = w === 0 || (lockedPositions.has(pos) && gameLocks[a.pid] !== pos);
          const active = gameLocks[a.pid] === pos;
          const cls = active ? 'lock-chip active' : (disabled ? 'lock-chip disabled' : 'lock-chip');
          const onclick = disabled ? '' : `onclick="event.stopPropagation();setLock('${a.pid}','${pos}')"`;
          return `<button class="${cls}" ${onclick}>${pos}</button>`;
        }).join('');
        picker = `<div class="lock-picker">${chips}</div>`;
      }

      const isDragging = availDragState && availDragState.fromIdx === i ? ' dragging' : '';
      const isDropTarget = availDropIdx === i ? ' drag-over' : '';
      const isFlash = availReorderFlash === i ? ' swap-flash' : '';

      itemsHtml += `
        <li class="available-item${isPickerOpen ? ' picker-open' : ''}${isDragging}${isDropTarget}${isFlash}" data-idx="${i}">
          <button class="pickup-remove" onclick="event.stopPropagation();deselectPlayer('${a.pid}')" aria-label="Remove ${esc(p.name)}">&times;</button>
          <span class="player-name" onclick="toggleLockPicker('${a.pid}')">${displayNameHtml(a.pid)}</span>
          ${lockBadge}
          ${isStarter ? '<span class="starter-badge">START</span>' : ''}
          <div class="drag-handle" aria-label="Drag to reorder">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>
          </div>
          ${picker}
        </li>
      `;
      rightIdx++;
    }

    rightList.innerHTML = pinHintHtml + itemsHtml;
  }

  // Attach drag handlers to all drag handles in right column
  rightList.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('pointerdown', onAvailDragStart, { passive: false });
  });
}

function toggleLockPicker(pid) {
  const entry = availableOrder.find(a => a.pid === pid && a.checked);
  if (!entry) return;
  lockPickerOpen = lockPickerOpen === pid ? null : pid;
  renderAvailableItems();
}

function setLock(pid, position) {
  if (gameLocks[pid] === position) {
    // Toggle off
    delete gameLocks[pid];
  } else {
    gameLocks[pid] = position;
  }
  lockPickerOpen = null;
  renderAvailableItems();
  renderConstraintControls();
}

function removeLock(pid) {
  delete gameLocks[pid];
  renderAvailableItems();
  renderConstraintControls();
}

/** Select a player from the left column → moves to end of right column */
function selectPlayer(pid) {
  const entry = availableOrder.find(a => a.pid === pid);
  if (!entry) return;
  entry.checked = true;
  // Move to end so newly selected appear at bottom of right column
  availableOrder = availableOrder.filter(a => a.pid !== pid);
  availableOrder.push(entry);
  renderAvailableItems();
}

/** Deselect a player from the right column → moves back to left column */
function deselectPlayer(pid) {
  const entry = availableOrder.find(a => a.pid === pid);
  if (!entry) return;
  entry.checked = false;
  // Clear lock if any
  if (gameLocks[pid]) {
    delete gameLocks[pid];
    renderConstraintControls();
  }
  if (lockPickerOpen === pid) lockPickerOpen = null;
  renderAvailableItems();
}

/** Select all roster players */
function selectAllPlayers() {
  for (const a of availableOrder) {
    a.checked = true;
  }
  renderAvailableItems();
}

/** Clear all selections — move everyone back to left column */
function clearAllPlayers() {
  for (const a of availableOrder) {
    a.checked = false;
  }
  // Clear all locks
  gameLocks = {};
  lockPickerOpen = null;
  renderAvailableItems();
  renderConstraintControls();
}

// -- Drag-to-Reorder ------------------------------------------------

function onAvailDragStart(e) {
  e.preventDefault();
  e.stopPropagation();

  const handle = e.currentTarget;
  const li = handle.closest('.available-item');
  const idx = parseInt(li.getAttribute('data-idx'));
  if (isNaN(idx)) return;

  // Create ghost element
  const rect = li.getBoundingClientRect();
  const ghost = li.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = rect.width + 'px';
  ghost.style.left = rect.left + 'px';
  ghost.style.top = rect.top + 'px';
  document.body.appendChild(ghost);

  availDragState = {
    fromIdx: idx,
    pointerId: e.pointerId,
    ghostEl: ghost,
    startY: e.clientY,
    offsetY: e.clientY - rect.top,
  };

  li.classList.add('dragging');

  const onMove = (me) => {
    if (!availDragState || me.pointerId !== availDragState.pointerId) return;
    me.preventDefault();

    // Move ghost
    availDragState.ghostEl.style.top = (me.clientY - availDragState.offsetY) + 'px';

    // Find drop target
    const list = document.getElementById('availableList');
    const items = list.querySelectorAll('.available-item');
    let newDropIdx = availDragState.fromIdx;

    for (const item of items) {
      const itemIdx = parseInt(item.getAttribute('data-idx'));
      if (isNaN(itemIdx)) continue;
      const itemRect = item.getBoundingClientRect();
      const midY = itemRect.top + itemRect.height / 2;
      if (me.clientY < midY) {
        newDropIdx = itemIdx;
        break;
      }
      newDropIdx = itemIdx + 1;
    }

    // Clamp
    newDropIdx = Math.max(0, Math.min(availableOrder.length - 1, newDropIdx));
    if (newDropIdx !== availDragState.fromIdx) {
      // Update drop indicator without full re-render
      items.forEach(item => {
        const iIdx = parseInt(item.getAttribute('data-idx'));
        item.classList.toggle('drag-over', iIdx === newDropIdx ||
          (newDropIdx >= availableOrder.length && iIdx === availableOrder.length - 1));
      });
    } else {
      items.forEach(item => item.classList.remove('drag-over'));
    }
    availDropIdx = newDropIdx;
  };

  const onUp = () => {
    if (!availDragState) return;

    // Clean up ghost
    availDragState.ghostEl.remove();
    const fromIdx = availDragState.fromIdx;
    const toIdx = availDropIdx !== null ? availDropIdx : fromIdx;

    availDragState = null;
    availDropIdx = null;

    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onUp);

    if (fromIdx !== toIdx) {
      // Move item in array
      const [item] = availableOrder.splice(fromIdx, 1);
      const insertIdx = toIdx > fromIdx ? toIdx - 1 : toIdx;
      availableOrder.splice(insertIdx, 0, item);

      // Flash the moved item
      availReorderFlash = insertIdx;
      renderAvailableItems();

      const name = displayName(item.pid);
      showToast(`Moved ${name}`, 'success');

      setTimeout(() => { availReorderFlash = null; renderAvailableItems(); }, 1200);
    } else {
      renderAvailableItems();
    }
  };

  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onUp);
}

function toggleStarterMode() {
  starterMode = !starterMode;
  document.getElementById('toggleStarters').classList.toggle('on', starterMode);
  renderAvailableItems();
}

// -- Constraint Controls -------------------------------------------
function renderConstraintControls() {
  const el = document.getElementById('constraintControls');
  if (!el || !roster) return;

  const numPeriods = parseInt(document.getElementById('gamePeriods')?.value) || 4;
  const periodLabel = getPeriodLabelPlural(numPeriods);
  // Clamp any position max values that exceed numPeriods-1
  for (const pos of Object.keys(gamePositionMax)) {
    if (gamePositionMax[pos] >= numPeriods) delete gamePositionMax[pos];
  }
  // Clamp global max if it equals or exceeds numPeriods (effectively no limit)
  if (gameGlobalMaxPeriods != null && gameGlobalMaxPeriods >= numPeriods) {
    gameGlobalMaxPeriods = null;
  }
  const hasAnyPosMax = Object.keys(gamePositionMax).length > 0;
  const hasAnyConstraint = gameContinuity > 0 || gameGlobalMaxPeriods !== null || hasAnyPosMax || Object.keys(gameLocks).length > 0;

  const continuityLabels = ['Off', 'Med', 'High'];

  let html = '';

  // Continuity 3-state toggle
  html += '<div class="constraint-row">';
  html += '<div class="constraint-label">Position stickiness<div class="constraint-sublabel">Keep players at same position between periods</div></div>';
  html += '<div class="tri-toggle">';
  for (let i = 0; i < 3; i++) {
    const active = gameContinuity === i ? ' active' : '';
    html += `<button class="tri-opt${active}" onclick="setContinuity(${i})">${continuityLabels[i]}</button>`;
  }
  html += '</div>';
  html += '</div>';

  // Global max periods per player
  html += '<div class="constraint-row">';
  html += '<div class="constraint-label">Max periods / player<div class="constraint-sublabel">Limit total periods any player plays this game</div></div>';
  html += '<div class="tri-toggle">';
  const noLimitActive = gameGlobalMaxPeriods === null ? ' active' : '';
  html += `<button class="tri-opt${noLimitActive}" onclick="setGlobalMaxPeriods(null)">Any</button>`;
  for (let v = 1; v < numPeriods; v++) {
    const active = gameGlobalMaxPeriods === v ? ' active' : '';
    html += `<button class="tri-opt${active}" onclick="setGlobalMaxPeriods(${v})">${v}</button>`;
  }
  html += '</div>';
  html += '</div>';

  // Per-position max
  html += `<div class="constraint-section-label">Max per position<span class="constraint-sublabel" style="display:block">Limit how many ${periodLabel} one player plays a position</span></div>`;
  for (const pos of roster.positions) {
    const curMax = gamePositionMax[pos] ?? null;
    html += '<div class="constraint-row">';
    html += `<span class="constraint-pos-label">${pos}</span>`;
    html += '<div class="tri-toggle">';
    const anyActive = curMax === null ? ' active' : '';
    html += `<button class="tri-opt${anyActive}" onclick="setPositionMax('${pos}',null)">Any</button>`;
    for (let v = 1; v < numPeriods; v++) {
      const active = curMax === v ? ' active' : '';
      html += `<button class="tri-opt${active}" onclick="setPositionMax('${pos}',${v})">${v}</button>`;
    }
    html += '</div>';
    html += '</div>';
  }

  el.innerHTML = html;

  // Update the expand button badge
  const badge = document.getElementById('constraintBadge');
  if (badge) {
    const count = (gameContinuity > 0 ? 1 : 0) + (gameGlobalMaxPeriods !== null ? 1 : 0) + Object.keys(gamePositionMax).length + Object.keys(gameLocks).length;
    badge.textContent = count > 0 ? count : '';
    badge.classList.toggle('hidden', count === 0);
  }
}

function setContinuity(val) {
  gameContinuity = val;
  renderConstraintControls();
}

function setGlobalMaxPeriods(val) {
  gameGlobalMaxPeriods = val;
  renderConstraintControls();
}

function setPositionMax(pos, val) {
  if (val === null) {
    delete gamePositionMax[pos];
  } else {
    gamePositionMax[pos] = val;
  }
  renderConstraintControls();
}

function toggleConstraintPanel() {
  const el = document.getElementById('constraintControls');
  const btn = document.getElementById('constraintToggle');
  if (!el) return;
  const hidden = el.classList.toggle('hidden');
  btn.classList.toggle('expanded', !hidden);
  if (!hidden) renderConstraintControls();
}

// -- Generate -------------------------------------------------------
function generatePlan() {
  if (!ctx || !roster) return;
  const date = document.getElementById('gameDate').value;
  const available = availableOrder.filter(a => a.checked).map(a => a.pid);

  if (available.length < roster.positions.length) {
    showModal({
      title: 'Not Enough Players',
      message: `Need at least ${roster.positions.length} available players.`,
      cancelLabel: null,
      onConfirm: () => {}
    });
    return;
  }

  // Determine gameId: support multiple games per day
  const allGames = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
  const existingForDate = allGames.filter(g => g.date === date);

  if (existingForDate.length > 0) {
    showTournamentModal(date, existingForDate);
  } else {
    doGenerate(date);
  }
}

function showTournamentModal(date, existingGames) {
  const count = existingGames.length;
  const nextNum = count + 1;
  const lastGame = existingGames[existingGames.length - 1];
  const lastLabel = getGameNumLabel(lastGame) || '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'tournamentModal';
  overlay.innerHTML = `
    <div class="modal" style="padding:20px;text-align:center">
      <div style="font-weight:700;font-size:16px;margin-bottom:4px">${date}</div>
      <div class="text-sm text-muted" style="margin-bottom:16px">${count} game${count > 1 ? 's' : ''} already scheduled</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary" onclick="closeTournamentModal();doGenerate('${date}_${nextNum}')">Add Game ${nextNum}</button>
        <button class="btn btn-outline" onclick="closeTournamentModal();doGenerate('${lastGame.gameId}')">Replace${lastLabel}</button>
        <button class="btn-ghost text-sm" style="color:var(--fg2);margin-top:4px" onclick="closeTournamentModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeTournamentModal() {
  document.getElementById('tournamentModal')?.remove();
}

function doGenerate(gameId) {
  const date = document.getElementById('gameDate').value;
  const numPeriods = parseInt(document.getElementById('gamePeriods').value);
  const available = availableOrder.filter(a => a.checked).map(a => a.pid);

  const availSet = new Set(available);
  const locks = Object.entries(gameLocks)
    .filter(([pid]) => availSet.has(pid))
    .map(([pid, position]) => ({ pid, position }));

  const constraints = {
    locks,
    continuity: gameContinuity,
    positionMax: gamePositionMax,
    globalMaxPeriods: gameGlobalMaxPeriods,
  };

  const stats = Storage.getSeasonStats(ctx.teamSlug, ctx.seasonSlug);
  const engine = new RotationEngine(roster, stats);

  try {
    // Preserve notes and label from existing game if re-generating
    const allGames = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
    const existingGame = allGames.find(g => g.gameId === gameId);
    const existingNotes = existingGame?.notes || '';
    const existingLabel = existingGame?.label || '';

    currentPlan = engine.generateGamePlan(date, available, numPeriods, starterMode, constraints);
    // Wrap engine output (v3 {pos: pid}) to v4 ({pos: [{pid, timeIn, timeOut}]})
    currentPlan.periodAssignments = currentPlan.periodAssignments.map(pa => ({
      ...pa,
      assignments: wrapEngineOutput(pa.assignments),
    }));
    currentPlan.gameId = gameId;
    if (existingNotes) currentPlan.notes = existingNotes;
    if (existingLabel) currentPlan.label = existingLabel;
    // Preserve existing score/exhibition data on re-generation, or initialize fresh
    if (existingGame?.score) {
      currentPlan.score = existingGame.score;
    } else {
      currentPlan.score = { goals: [], opponentByPeriod: new Array(numPeriods).fill(0) };
    }
    if (existingGame?.exhibition) currentPlan.exhibition = true;

    // Inherit tracking mode settings from season defaults (or preserve existing)
    if (existingGame?.trackingMode) {
      currentPlan.trackingMode = existingGame.trackingMode;
      if (existingGame.periodDuration != null) currentPlan.periodDuration = existingGame.periodDuration;
      if (existingGame.periodIncrement != null) currentPlan.periodIncrement = existingGame.periodIncrement;
      if (existingGame.timeDisplay) currentPlan.timeDisplay = existingGame.timeDisplay;
      if (existingGame.clockEnabled != null) currentPlan.clockEnabled = existingGame.clockEnabled;
      if (existingGame.clockAutoFill != null) currentPlan.clockAutoFill = existingGame.clockAutoFill;
    } else {
      const defs = getSeasonTrackingDefaults();
      currentPlan.trackingMode = defs.trackingMode;
      if (defs.periodDuration) currentPlan.periodDuration = defs.periodDuration;
      currentPlan.periodIncrement = defs.periodIncrement;
      currentPlan.timeDisplay = defs.timeDisplay;
      currentPlan.clockEnabled = defs.clockEnabled;
      currentPlan.clockAutoFill = defs.clockAutoFill;
    }

    // Reset clock state for new game
    clockReset();

    Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
    renderLineup();
    document.querySelectorAll('nav button')[2].click();
  } catch (e) {
    showModal({
      title: 'Generation Error',
      message: e.message,
      cancelLabel: null,
      onConfirm: () => {}
    });
  }
}

/** Returns e.g. '  (Game 2)' for multi-game days, '' for single-game days */
function getGameNumLabel(game) {
  const m = game.gameId.match(/_(\d+)$/);
  if (m) return `  (Game ${m[1]})`;
  // Check if other games share this date
  if (ctx) {
    const all = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
    const sameDate = all.filter(g => g.date === game.date);
    if (sameDate.length > 1) return '  (Game 1)';
  }
  return '';
}

// -- Goal Tracking Helpers ------------------------------------------
function ensureScore(plan) {
  if (!plan.score) plan.score = { goals: [], opponentByPeriod: [] };
  if (!plan.score.goals) plan.score.goals = [];
  if (!plan.score.opponentByPeriod) plan.score.opponentByPeriod = [];
  // Ensure opponentByPeriod has correct length
  while (plan.score.opponentByPeriod.length < plan.numPeriods) plan.score.opponentByPeriod.push(0);
  return plan.score;
}

function getPlayerGoals(plan, pid, periodIdx) {
  if (!plan.score || !plan.score.goals) return 0;
  const entry = plan.score.goals.find(g => g.pid === pid && g.period === periodIdx);
  return entry ? entry.count : 0;
}

function getPeriodTeamGoals(plan, periodIdx) {
  if (!plan.score || !plan.score.goals) return 0;
  return plan.score.goals
    .filter(g => g.period === periodIdx)
    .reduce((sum, g) => sum + g.count, 0);
}

function getPeriodOppGoals(plan, periodIdx) {
  if (!plan.score || !plan.score.opponentByPeriod) return 0;
  return plan.score.opponentByPeriod[periodIdx] || 0;
}

function getTotalTeamGoals(plan) {
  if (!plan.score || !plan.score.goals) return 0;
  return plan.score.goals.reduce((sum, g) => sum + g.count, 0);
}

function getTotalOppGoals(plan) {
  if (!plan.score || !plan.score.opponentByPeriod) return 0;
  return plan.score.opponentByPeriod.reduce((sum, v) => sum + v, 0);
}

function hasScoreData(plan) {
  return !!plan.score;
}

/** Returns 'W', 'L', 'D', or null if no score data */
function getGameResult(game) {
  if (!hasScoreData(game)) return null;
  const us = getTotalTeamGoals(game);
  const them = getTotalOppGoals(game);
  if (us > them) return 'W';
  if (us < them) return 'L';
  return 'D';
}

/** Returns { w, l, d } for a list of games */
function getSeasonRecord(games) {
  let w = 0, l = 0, d = 0;
  for (const g of games) {
    const r = getGameResult(g);
    if (r === null) continue;
    if (r === 'W') w++;
    else if (r === 'L') l++;
    else d++;
  }
  return { w, l, d };
}

/** Returns { pid: totalGoals } across all games */
function getSeasonGoals(games) {
  const totals = {};
  for (const g of games) {
    if (!g.score || !g.score.goals) continue;
    for (const entry of g.score.goals) {
      totals[entry.pid] = (totals[entry.pid] || 0) + entry.count;
    }
  }
  return totals;
}

/** Short team name for score display, falls back to 'Team' */
function scoreTeamName() {
  if (!ctx) return 'Team';
  const team = teams.find(t => t.slug === ctx.teamSlug);
  return team ? team.name : 'Team';
}

/** Compute season stats from a supplied list of games (same logic as Storage.getSeasonStats) */
function computeStatsFromGames(games) {
  const stats = {};
  for (const game of games) {
    for (const pid of game.availablePlayers) {
      if (!stats[pid]) {
        stats[pid] = { gamesAttended: 0, totalPeriodsPlayed: 0, totalPeriodsAvailable: 0, periodsByPosition: {} };
      }
      stats[pid].gamesAttended++;
      stats[pid].totalPeriodsAvailable += game.numPeriods;
    }
    for (const pa of game.periodAssignments) {
      for (const [pos, val] of Object.entries(pa.assignments)) {
        if (Array.isArray(val)) {
          // v4 format: array of occupant entries with fractional credit
          for (const entry of val) {
            if (!stats[entry.pid]) continue;
            const credit = entry.timeOut - entry.timeIn;
            stats[entry.pid].totalPeriodsPlayed += credit;
            stats[entry.pid].periodsByPosition[pos] =
              (stats[entry.pid].periodsByPosition[pos] || 0) + credit;
          }
        } else {
          // v3 fallback
          if (!stats[val]) continue;
          stats[val].totalPeriodsPlayed++;
          stats[val].periodsByPosition[pos] = (stats[val].periodsByPosition[pos] || 0) + 1;
        }
      }
    }
  }
  return stats;
}

function changePlayerGoals(periodIdx, pid, delta) {
  if (!currentPlan || !ctx) return;
  const score = ensureScore(currentPlan);
  let entry = score.goals.find(g => g.pid === pid && g.period === periodIdx);
  if (delta > 0) {
    if (entry) { entry.count += delta; }
    else { score.goals.push({ pid, period: periodIdx, count: delta }); }
  } else if (entry) {
    entry.count = Math.max(0, entry.count + delta);
    if (entry.count === 0) score.goals = score.goals.filter(g => g !== entry);
  }
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

function changeOppGoals(periodIdx, delta) {
  if (!currentPlan || !ctx) return;
  const score = ensureScore(currentPlan);
  score.opponentByPeriod[periodIdx] = Math.max(0, (score.opponentByPeriod[periodIdx] || 0) + delta);
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

// -- Lineup Display -------------------------------------------------
function renderLineup() {
  const el = document.getElementById('lineupContent');

  // Auto-load most recent game if none is active
  if (!currentPlan && ctx && roster) {
    const games = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
    if (games.length > 0) {
      currentPlan = games[games.length - 1];
    }
  }

  if (!currentPlan || !roster) {
    el.innerHTML = '<div class="empty-state"><p>Generate a lineup from the Game Day tab</p></div>';
    return;
  }

  const plan = currentPlan;
  const periodLabel = getPeriodLabel(plan.numPeriods);
  const summary = getPlayerSummary(plan);
  const gameNum = getGameNumLabel(plan);
  const posColors = getPositionColors(roster.positions);
  const allGames = ctx ? Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug) : [];
  const hasMultipleGames = allGames.length > 1;
  const trackMode = getActiveTrackingMode();
  const showTimeline = trackMode !== 'simple';
  const pd = getActivePeriodDuration();
  const us = getTotalTeamGoals(plan);
  const them = getTotalOppGoals(plan);
  const tn = esc(scoreTeamName());
  const timeDisp = getActiveTimeDisplay();

  // ── Row 1: Date (green box, tappable) + label input ──
  let html = `<div class="lu-row1">
    <div class="lu-date${hasMultipleGames ? ' tappable' : ''}" ${hasMultipleGames ? 'onclick="openGamePicker()"' : ''}>${plan.date}${gameNum}</div>
    <input type="text" id="gameLabelInput" class="lu-label" placeholder="vs. Opponent" maxlength="40"
      value="${esc(plan.label || '')}" oninput="saveGameLabel()">
  </div>`;

  // ── Row 2: Scrimmage checkbox left + Share/Print/Delete right ──
  html += `<div class="lu-btn-row">
    <div class="lu-btn-left"><div class="scrimmage-toggle" onclick="toggleScrimmage()" title="Exclude from season stats"><div class="check${plan.exhibition ? ' checked' : ''}" id="scrimmageCheck"></div><span>Scrimmage</span></div></div>
    <div class="lu-btn-right">
      <button class="lu-btn" onclick="shareLineup()">Share</button>
      <button class="lu-btn" onclick="printLineup()">Print</button>
      <button class="lu-btn" onclick="deleteCurrentGame()">Delete</button>
    </div>
  </div>`;

  // ── Row 3: Clock (always visible) ──
  const clockFrac = clockGetFraction();
  const clockDone = pd && clockGetElapsed() >= pd;
  const elapsedStr = pd ? fractionToElapsed(Math.min(clockFrac, 1.0), pd) : '0:00';
  const remainStr = pd ? fractionToRemaining(Math.min(clockFrac, 1.0), pd) : '0:00';
  const durMin = pd ? Math.round(pd / 60) : 12;
  const durStr = fractionToElapsed(1.0, pd || 720);
  const showTime = timeDisp === 'remaining' ? remainStr : elapsedStr;

  html += `<div class="lu-clock">
    <span class="lu-clock-time${clockRunning ? ' running' : ''}${clockDone ? ' done' : ''}" id="gameClock">${showTime}</span>
    <span class="lu-clock-sep">/</span>
    <button class="lu-clock-dur" onclick="openPeriodDurationPrompt()" title="Set period length">${durStr}</button>
    <button class="lu-clock-btn" onclick="clockToggle()" title="${clockRunning ? 'Pause' : 'Start'}">${clockRunning ? '⏸' : '▶'}</button>
    <button class="lu-clock-btn" onclick="clockReset()" title="Reset">↺</button>
    <button class="lu-clock-btn" onclick="toggleTimeDisplay()" title="${timeDisp === 'elapsed' ? 'Count down' : 'Count up'}">${timeDisp === 'elapsed' ? '↑' : '↓'}</button>
  </div>`;

  // ── Game Notes ──
  html += '<div class="card">';
  html += '<div class="card-title" style="display:flex;justify-content:space-between;align-items:center">Game Notes<button class="btn-ghost" onclick="insertNoteBullet()" title="Insert bullet" style="font-size:20px;padding:2px 8px;color:var(--accent)">&bull;</button></div>';
  html += `<textarea class="game-notes" id="gameNotesInput" placeholder="Tap to add notes..." oninput="saveGameNotes()">${esc(plan.notes || '')}</textarea>`;
  html += '</div>';

  // ── Swap hint ──
  if (swapSelection) {
    const selName = displayName(swapSelection.pid);
    html += `<div class="swap-hint">Tap another player to swap with ${esc(selName)}  -  <span onclick="clearSwap()" style="text-decoration:underline;cursor:pointer">Cancel</span></div>`;
  }

  // ── Lineup section header: Mode dropdown + Edit Lineup + Score ──
  html += `<div class="lu-lineup-hdr">
    <select class="lu-mode-select" onchange="setGameTrackingMode(this.value)" title="Tracking mode">
      <option value="simple"${trackMode === 'simple' ? ' selected' : ''}>Simple</option>
      <option value="coarse"${trackMode === 'coarse' ? ' selected' : ''}>Coarse</option>
      <option value="fine"${trackMode === 'fine' ? ' selected' : ''}>Fine</option>
    </select>
    <button class="btn btn-sm btn-outline" onclick="openEditRosterModal()">Edit Lineup</button>
    <div class="score-nums" style="margin-left:auto"><span class="score-side">${tn} <strong>${us}</strong></span><span class="score-divider">\u2014</span><span class="score-side">Opp <strong>${them}</strong></span></div>
  </div>`;

  // ── Period cards ──
  for (let pi = 0; pi < plan.periodAssignments.length; pi++) {
    const pa = plan.periodAssignments[pi];
    const pUs = getPeriodTeamGoals(plan, pi);
    const pThem = getPeriodOppGoals(plan, pi);
    const isCollapsed = collapsedPeriods.has(pi);
    const collapseClass = isCollapsed ? ' collapsed' : '';
    const chevron = `<span class="period-chevron${isCollapsed ? ' collapsed' : ''}">&#x25BE;</span>`;
    const periodScoreHtml = `<span class="period-score"><span class="period-team-goals">${pUs}</span> <span class="period-score-sep">\u2014</span> Opp <span class="opp-counter"><button class="opp-btn" onclick="event.stopPropagation();changeOppGoals(${pi},-1)" aria-label="Decrement opponent">&minus;</button><span>${pThem}</span><button class="opp-btn" onclick="event.stopPropagation();changeOppGoals(${pi},1)" aria-label="Increment opponent">+</button></span></span>`;
    html += `<div class="period-card${collapseClass}"><div class="period-header" onclick="togglePeriodCollapse(${pi})"><span>${chevron}${periodLabel} ${pa.period}</span>${pi > 0 ? `<button class="rebalance-btn" onclick="event.stopPropagation();openRebalanceModal(${pi})" title="Rebalance from here" aria-label="Rebalance from ${periodLabel} ${pa.period}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>` : ''}${periodScoreHtml}</div>`;
    if (!isCollapsed) {
      html += '<div class="period-body">';
      for (const pos of roster.positions) {
        const slotVal = pa.assignments[pos];
        const occupants = Array.isArray(slotVal) ? slotVal : [{ pid: slotVal, timeIn: 0, timeOut: 1 }];
        const posClr = posColors[pos] || 'var(--fg2)';
        const lastEntry = occupants[occupants.length - 1];
        const pid = lastEntry.pid;
        const nameHtml = pid ? displayNameHtml(pid) : '?';
        const isGK = pos === 'GK' ? ' gk' : '';
        const isSel = swapSelection && swapSelection.periodIdx === pi && swapSelection.pid === pid ? ' swap-selected' : '';
        const isHi = swapHighlight && swapHighlight.periodIdx === pi && swapHighlight.pids.includes(pid) ? ' swap-flash' : '';
        const goals = getPlayerGoals(plan, pid, pi);

        // Player timeline bar: show THIS PLAYER's positions during this period
        // Segments positioned correctly with spacers for gaps
        let timelineHtml = '';
        if (showTimeline) {
          const playerEntries = [];
          for (const [p, occ] of Object.entries(pa.assignments)) {
            const entries = Array.isArray(occ) ? occ : [{ pid: occ, timeIn: 0, timeOut: 1 }];
            for (const e of entries) {
              if (e.pid === pid) {
                playerEntries.push({ pos: p, timeIn: e.timeIn, timeOut: e.timeOut });
              }
            }
          }
          playerEntries.sort((a, b) => a.timeIn - b.timeIn);

          if (playerEntries.length > 0) {
            let barSegs = '';
            let cursor = 0;
            for (const pe of playerEntries) {
              // Add spacer for gap before this entry
              if (pe.timeIn > cursor + 0.001) {
                const gapW = ((pe.timeIn - cursor) * 100).toFixed(1);
                barSegs += `<span class="tl-seg tl-gap" style="width:${gapW}%"></span>`;
              }
              const w = ((pe.timeOut - pe.timeIn) * 100).toFixed(1);
              const clr = posColors[pe.pos] || 'var(--fg2)';
              barSegs += `<span class="tl-seg" style="width:${w}%;background:${clr}" title="${pe.pos} ${Math.round((pe.timeOut - pe.timeIn) * 100)}%"></span>`;
              cursor = pe.timeOut;
            }
            // Add trailing spacer if player doesn't fill the period
            if (cursor < 0.999) {
              const gapW = ((1.0 - cursor) * 100).toFixed(1);
              barSegs += `<span class="tl-seg tl-gap" style="width:${gapW}%"></span>`;
            }
            timelineHtml = `<div class="slot-timeline" onclick="event.stopPropagation();openPlayerTimePopup(${pi},'${pid}')">${barSegs}</div>`;
          }
        }

        html += `<div class="lineup-row${isSel}${isHi}"><span class="pos-color-bar" style="background:${posClr}"></span><div class="lineup-swap-target" onclick="handleSwapTap(${pi},'${pid}','${pos}')"><span class="lineup-pos${isGK}">${pos}</span><span class="lineup-name">${nameHtml}</span></div>${timelineHtml}<div class="goal-counter" onclick="event.stopPropagation()"><button class="goal-btn" onclick="changePlayerGoals(${pi},'${pid}',-1)" aria-label="Remove goal">&minus;</button><span class="goal-count${goals > 0 ? ' has-goals' : ''}">${goals}</span><button class="goal-btn" onclick="changePlayerGoals(${pi},'${pid}',1)" aria-label="Add goal">+</button></div></div>`;
      }
      html += '</div>';
      const visualBench = deriveVisualBench(plan, pi);
      if (visualBench.length > 0) {
        html += '<div class="bench-row"><span class="bench-label">Bench</span>';
        html += '<div class="bench-chips">';
        for (const bpid of visualBench) {
          const isSel = swapSelection && swapSelection.periodIdx === pi && swapSelection.pid === bpid ? ' swap-selected' : '';
          const isHi = swapHighlight && swapHighlight.periodIdx === pi && swapHighlight.pids.includes(bpid) ? ' swap-flash' : '';
          const bGoals = getPlayerGoals(plan, bpid, pi);
          const bGoalBadge = bGoals > 0 ? ` <span class="bench-goal-badge">${bGoals}</span>` : '';
          let benchBar = '';
          if (showTimeline) {
            let periodCredit = 0;
            for (const occ of Object.values(pa.assignments)) {
              const entries = Array.isArray(occ) ? occ : [];
              for (const e of entries) {
                if (e.pid === bpid) periodCredit += (e.timeOut - e.timeIn);
              }
            }
            if (periodCredit > 0.001) {
              benchBar = `<div class="bench-bar-wrap" onclick="event.stopPropagation();openPlayerTimePopup(${pi},'${bpid}')"><span class="bench-time-bar-ext" style="width:${(periodCredit * 100).toFixed(0)}%"></span></div>`;
            }
          }
          html += `<div class="bench-chip-wrap"><div class="bench-chip${isSel}${isHi}" onclick="handleSwapTap(${pi},'${bpid}','bench')">${displayNameHtml(bpid)}${bGoalBadge}</div>${benchBar}</div>`;
        }
        html += '</div></div>';
      }
    }
    html += '</div>';
  }

  html += '<div class="card"><div class="card-title">Player Summary</div>';
  html += '<table class="season-table"><thead><tr><th>Player</th><th>Played</th><th>Positions</th></tr></thead><tbody>';
  for (const pid of plan.availablePlayers) {
    const s = summary[pid];
    html += `<tr><td>${displayNameHtml(pid)}</td><td>${fmtPeriods(s.periodsPlayed)}/${plan.numPeriods}</td><td style="font-size:11px">${s.positions.join(', ')}</td></tr>`;
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function deleteCurrentGame() {
  if (!currentPlan || !ctx) return;
  const gnLabel = getGameNumLabel(currentPlan);
  const displayLabel = currentPlan.label ? ` — ${currentPlan.label}` : '';
  const label = `${currentPlan.date}${gnLabel}${displayLabel}`;
  showModal({
    title: 'Delete Game',
    message: `Delete game ${label}?\n\nThis removes the lineup and notes for this game.`,
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => {
      Storage.deleteGame(ctx.teamSlug, ctx.seasonSlug, currentPlan.gameId);
      currentPlan = null;
      swapSelection = null;
      swapHighlight = null;
      collapsedPeriods.clear();
      renderLineup();
      renderSeason();
      document.querySelectorAll('nav button')[1].click();
      showToast('Game deleted', 'success');
    }
  });
}

// -- Edit Roster (Late Arrival & Early Departure) -------------------------

function openEditRosterModal() {
  if (!currentPlan || !ctx || !roster) return;

  const numPeriods = currentPlan.numPeriods;
  const periodLabel = getPeriodLabel(numPeriods);

  const inGame = new Set(currentPlan.availablePlayers);
  const missing = Object.entries(roster.players)
    .filter(([pid, p]) => !inGame.has(pid) && !p.archived)
    .map(([pid, p]) => ({ pid, name: displayName(pid) }));
  const inGamePlayers = currentPlan.availablePlayers
    .map(pid => ({ pid, name: displayName(pid) }));

  // Period options for "from" selector (Q2+)
  let periodOpts = '';
  for (let i = 1; i < numPeriods; i++) {
    periodOpts += `<option value="${i}">${periodLabel} ${i + 1}</option>`;
  }

  const hasMissing = missing.length > 0;
  const hasPlayers = inGamePlayers.length > 0;

  let addPlayerOpts = '';
  for (const m of missing) {
    addPlayerOpts += `<option value="${m.pid}">${esc(m.name)}</option>`;
  }

  let removePlayerOpts = '';
  for (const p of inGamePlayers) {
    removePlayerOpts += `<option value="${p.pid}">${esc(p.name)}</option>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'editRosterModal';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-label="Edit Game Lineup" aria-modal="true">
      <h2>
        <span>Edit Game Lineup</span>
        <button class="close-btn" onclick="closeDynamicModal('editRosterModal')" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </h2>
      <div class="edit-roster-tabs">
        <button class="edit-roster-tab active" id="editTabAdd" onclick="switchEditRosterTab('add')">+ Add Player</button>
        <button class="edit-roster-tab" id="editTabRemove" onclick="switchEditRosterTab('remove')">- Remove Player</button>
      </div>
      <div id="editRosterAddPane" class="edit-roster-pane">
        ${hasMissing ? `
          <div style="margin-bottom:12px">
            <label for="editAddPlayer">Player</label>
            <select id="editAddPlayer">${addPlayerOpts}</select>
          </div>
          <div style="margin-bottom:16px">
            <label for="editAddPeriod">Joining from</label>
            <select id="editAddPeriod">${periodOpts}</select>
          </div>
          <button class="btn btn-primary" onclick="confirmEditRosterAdd()">Add &amp; Rebalance</button>
        ` : '<div class="text-sm text-muted" style="padding:16px 0;text-align:center">All roster players are already in this game.</div>'}
      </div>
      <div id="editRosterRemovePane" class="edit-roster-pane" style="display:none">
        ${hasPlayers ? `
          <div style="margin-bottom:12px">
            <label for="editRemovePlayer">Player</label>
            <select id="editRemovePlayer">${removePlayerOpts}</select>
          </div>
          <div style="margin-bottom:16px">
            <label for="editRemovePeriod">Leaving after</label>
            <select id="editRemovePeriod">${periodOpts}</select>
          </div>
          <button class="btn btn-primary" onclick="confirmEditRosterRemove()">Remove &amp; Rebalance</button>
        ` : '<div class="text-sm text-muted" style="padding:16px 0;text-align:center">No players to remove.</div>'}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDynamicModal('editRosterModal');
  });
}

function switchEditRosterTab(tab) {
  const addTab = document.getElementById('editTabAdd');
  const removeTab = document.getElementById('editTabRemove');
  const addPane = document.getElementById('editRosterAddPane');
  const removePane = document.getElementById('editRosterRemovePane');
  if (!addTab || !removeTab || !addPane || !removePane) return;
  if (tab === 'add') {
    addTab.classList.add('active');
    removeTab.classList.remove('active');
    addPane.style.display = '';
    removePane.style.display = 'none';
  } else {
    removeTab.classList.add('active');
    addTab.classList.remove('active');
    removePane.style.display = '';
    addPane.style.display = 'none';
  }
}

function confirmEditRosterAdd() {
  const pidSel = document.getElementById('editAddPlayer');
  const periodSel = document.getElementById('editAddPeriod');
  if (!pidSel || !periodSel) return;
  const pid = pidSel.value;
  const fromIdx = parseInt(periodSel.value);
  closeDynamicModal('editRosterModal');
  doRebalance(fromIdx, [pid], []);
}

function confirmEditRosterRemove() {
  const pidSel = document.getElementById('editRemovePlayer');
  const periodSel = document.getElementById('editRemovePeriod');
  if (!pidSel || !periodSel) return;
  const pid = pidSel.value;
  const fromIdx = parseInt(periodSel.value);
  closeDynamicModal('editRosterModal');
  doRebalance(fromIdx, [], [pid]);
}

function openRebalanceModal(fromPeriodIdx) {
  if (!currentPlan || !ctx || !roster) return;

  const numPeriods = currentPlan.numPeriods;
  const periodLabel = getPeriodLabel(numPeriods);

  // Build list of which periods to freeze vs regenerate
  const frozenLabels = [];
  for (let i = 0; i < fromPeriodIdx; i++) {
    frozenLabels.push(`${periodLabel} ${i + 1}`);
  }
  const regenLabels = [];
  for (let i = fromPeriodIdx; i < numPeriods; i++) {
    regenLabels.push(`${periodLabel} ${i + 1}`);
  }

  // Check if any regenerated periods have goals
  let hasGoals = false;
  for (let i = fromPeriodIdx; i < numPeriods; i++) {
    const pa = currentPlan.periodAssignments[i];
    if (currentPlan.score) {
      // Check player goals in this period
      for (const pid of extractPidsFromAssignments(pa.assignments)) {
        if ((currentPlan.score.playerGoals?.[pid]?.[i] || 0) > 0) {
          hasGoals = true;
          break;
        }
      }
      // Check opponent goals
      if ((currentPlan.score.oppGoals?.[i] || 0) > 0) hasGoals = true;
    }
    if (hasGoals) break;
  }

  let message = `${frozenLabels.join(', ')} will keep their assignments.\n${regenLabels.join(', ')} will be regenerated.`;
  if (hasGoals) {
    message += '\n\nGoals recorded in regenerated periods will be cleared.';
  }

  showModal({
    title: 'Rebalance Lineup',
    message,
    confirmLabel: 'Rebalance',
    onConfirm: () => doRebalance(fromPeriodIdx, [])
  });
}

function doRebalance(fromPeriodIdx, newPids = [], removedPids = []) {
  if (!currentPlan || !ctx || !roster) return;

  const allPids = currentPlan.availablePlayers.concat(newPids);
  const removeSet = new Set(removedPids);
  const availSet = new Set(allPids.filter(pid => !removeSet.has(pid)));
  const locks = Object.entries(gameLocks)
    .filter(([pid]) => availSet.has(pid))
    .map(([pid, position]) => ({ pid, position }));

  const constraints = {
    locks,
    continuity: gameContinuity,
    positionMax: gamePositionMax,
    globalMaxPeriods: gameGlobalMaxPeriods,
  };

  const stats = Storage.getSeasonStats(ctx.teamSlug, ctx.seasonSlug);
  const engine = new RotationEngine(roster, stats);

  try {
    // Clear goals for periods being regenerated
    if (currentPlan.score) {
      for (let i = fromPeriodIdx; i < currentPlan.numPeriods; i++) {
        // Clear opponent goals for this period
        if (currentPlan.score.oppGoals) {
          delete currentPlan.score.oppGoals[i];
        }
        // Clear player goals for this period
        if (currentPlan.score.playerGoals) {
          for (const pid of Object.keys(currentPlan.score.playerGoals)) {
            if (currentPlan.score.playerGoals[pid]) {
              delete currentPlan.score.playerGoals[pid][i];
            }
          }
        }
      }
    }

    const rebalanced = engine.rebalanceFromPeriod(
      currentPlan, fromPeriodIdx, newPids, constraints, removedPids
    );

    // Wrap regenerated periods to v4 (frozen periods pass through unchanged)
    rebalanced.periodAssignments = rebalanced.periodAssignments.map(pa => ({
      ...pa,
      assignments: wrapEngineOutput(pa.assignments),
    }));

    // Preserve metadata
    rebalanced.gameId = currentPlan.gameId;
    rebalanced.notes = currentPlan.notes || '';
    rebalanced.label = currentPlan.label || '';
    rebalanced.score = currentPlan.score || {};
    if (currentPlan.exhibition) rebalanced.exhibition = true;

    currentPlan = rebalanced;
    Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
    swapSelection = null;
    swapHighlight = null;
    renderLineup();
    renderSeason();

    if (removedPids.length > 0) {
      const names = removedPids.map(pid => displayName(pid)).join(', ');
      showToast(`${names} removed, lineup rebalanced`, 'success');
    } else if (newPids.length > 0) {
      const names = newPids.map(pid => displayName(pid)).join(', ');
      showToast(`${names} added, lineup rebalanced`, 'success');
    } else {
      showToast('Lineup rebalanced', 'success');
    }
  } catch (e) {
    showModal({
      title: 'Rebalance Error',
      message: e.message,
      cancelLabel: null,
      onConfirm: () => {}
    });
  }
}

// -- Game Notes -----------------------------------------------------
function saveGameNotes() {
  if (!currentPlan || !ctx) return;
  const ta = document.getElementById('gameNotesInput');
  if (!ta) return;
  currentPlan.notes = ta.value;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
}

function insertNoteBullet() {
  const ta = document.getElementById('gameNotesInput');
  if (!ta) return;
  ta.focus();
  const start = ta.selectionStart;
  const val = ta.value;
  // If cursor is at start of a line (or start of text), just insert bullet
  // Otherwise, insert newline + bullet
  const prefix = (start === 0 || val[start - 1] === '\n') ? '' : '\n';
  const insert = prefix + '\u2022 ';
  ta.setRangeText(insert, start, start, 'end');
  // Trigger save
  currentPlan.notes = ta.value;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
}

function saveGameLabel() {
  if (!currentPlan || !ctx) return;
  const input = document.getElementById('gameLabelInput');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    currentPlan.label = val;
  } else {
    delete currentPlan.label;
  }
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  // Live-update heading label line
  const labelEl = document.getElementById('lineupLabelText');
  if (labelEl) {
    if (currentPlan.label) {
      labelEl.textContent = currentPlan.label;
      labelEl.style.display = '';
    } else {
      labelEl.textContent = '';
      labelEl.style.display = 'none';
    }
  }
}

function toggleScrimmage() {
  if (!currentPlan || !ctx) return;
  currentPlan.exhibition = !currentPlan.exhibition;
  if (!currentPlan.exhibition) delete currentPlan.exhibition;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  const el = document.getElementById('scrimmageCheck');
  if (el) el.classList.toggle('checked', !!currentPlan.exhibition);
}

function togglePeriodCollapse(pi) {
  if (collapsedPeriods.has(pi)) collapsedPeriods.delete(pi);
  else collapsedPeriods.add(pi);
  renderLineup();
}


// -- Player Location Resolution ----------------------------------------

/**
 * Resolve where two players currently are in a period by scanning assignments.
 * A player is "on field" if they are the LAST occupant of any position slot.
 */
function resolveSwapLocations(periodIdx, pidA, pidB) {
  const pa = currentPlan.periodAssignments[periodIdx];
  const result = {};
  result[pidA] = { pos: null, type: 'bench' };
  result[pidB] = { pos: null, type: 'bench' };
  for (const [pos, val] of Object.entries(pa.assignments)) {
    const occupants = Array.isArray(val) ? val : [{ pid: val, timeIn: 0, timeOut: 1 }];
    if (occupants.length === 0) continue;
    const currentPid = occupants[occupants.length - 1].pid;
    if (currentPid === pidA) result[pidA] = { pos, type: 'field' };
    if (currentPid === pidB) result[pidB] = { pos, type: 'field' };
  }
  return result;
}

/**
 * Derive the visual bench for a period: available players who are NOT
 * the current (last) occupant of any field position.
 */
function deriveVisualBench(plan, periodIdx) {
  const pa = plan.periodAssignments[periodIdx];
  const onField = new Set();
  for (const val of Object.values(pa.assignments)) {
    const occupants = Array.isArray(val) ? val : [{ pid: val, timeIn: 0, timeOut: 1 }];
    if (occupants.length > 0) onField.add(occupants[occupants.length - 1].pid);
  }
  return plan.availablePlayers.filter(pid => !onField.has(pid));
}

// -- Lineup Swap (tap-order-independent) --------------------------------

function handleSwapTap(periodIdx, pid, pos) {
  if (!currentPlan || !ctx) return;
  if (!swapSelection) { swapSelection = { periodIdx, pid, pos }; renderLineup(); return; }
  if (swapSelection.periodIdx === periodIdx && swapSelection.pid === pid) { swapSelection = null; renderLineup(); return; }
  if (swapSelection.periodIdx !== periodIdx) { swapSelection = { periodIdx, pid, pos }; renderLineup(); return; }

  const pidA = swapSelection.pid;
  const pidB = pid;
  const locs = resolveSwapLocations(periodIdx, pidA, pidB);

  if (locs[pidA].type === 'bench' && locs[pidB].type === 'bench') {
    swapSelection = { periodIdx, pid, pos }; renderLineup(); return;
  }

  const mode = getActiveTrackingMode();
  if (mode === 'simple') { executeFullReplace(periodIdx, pidA, pidB); }
  else { openSubPopup(periodIdx, pidA, pidB); }
}

function executeFullReplace(periodIdx, pidA, pidB) {
  const pa = currentPlan.periodAssignments[periodIdx];
  const locs = resolveSwapLocations(periodIdx, pidA, pidB);
  if (locs[pidA].type === 'field' && locs[pidB].type === 'field') {
    pa.assignments[locs[pidA].pos] = [{ pid: pidB, timeIn: 0.0, timeOut: 1.0 }];
    pa.assignments[locs[pidB].pos] = [{ pid: pidA, timeIn: 0.0, timeOut: 1.0 }];
    // Clean up: remove each player's stale entries from other positions
    removePlayerFromOtherPositions(pa, pidA, locs[pidB].pos);
    removePlayerFromOtherPositions(pa, pidB, locs[pidA].pos);
  } else {
    const fieldPid = locs[pidA].type === 'field' ? pidA : pidB;
    const benchPid = locs[pidA].type === 'bench' ? pidA : pidB;
    pa.assignments[locs[fieldPid].pos] = [{ pid: benchPid, timeIn: 0.0, timeOut: 1.0 }];
    // Clean up: remove bench player's stale entries from other positions
    removePlayerFromOtherPositions(pa, benchPid, locs[fieldPid].pos);
    pa.bench = pa.bench.filter(b => b !== benchPid);
    if (!pa.bench.includes(fieldPid)) pa.bench.push(fieldPid);
  }
  swapSelection = null;
  swapHighlight = { periodIdx, pids: [pidA, pidB] };
  validateAssignments(currentPlan.periodAssignments[periodIdx]);
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  markDataDirty(); renderLineup();
  showToast(`Replaced ${displayName(pidA)} and ${displayName(pidB)}`, 'success');
  setTimeout(() => { swapHighlight = null; renderLineup(); }, 1200);
}

/**
 * Remove all entries for a player from positions OTHER than keepPos,
 * filling gaps by extending adjacent entries. This ensures a player
 * can't have >100% credit in a single period.
 */
function removePlayerFromOtherPositions(pa, pid, keepPos) {
  for (const [pos, occ] of Object.entries(pa.assignments)) {
    if (pos === keepPos || !Array.isArray(occ)) continue;
    // Find entries belonging to this player
    const toRemove = [];
    for (let i = 0; i < occ.length; i++) {
      if (occ[i].pid === pid) toRemove.push(i);
    }
    if (toRemove.length === 0) continue;

    // Remove entries and fill gaps
    for (let r = toRemove.length - 1; r >= 0; r--) {
      const idx = toRemove[r];
      const removed = occ[idx];
      occ.splice(idx, 1);
      if (occ.length === 0) {
        // Entire slot was this player — shouldn't happen but handle gracefully
        // Leave empty; validateAssignments can catch this
        continue;
      }
      // Fill the gap: extend the adjacent entry
      if (idx < occ.length) {
        // Next entry exists — pull its timeIn back
        occ[idx].timeIn = removed.timeIn;
      } else if (idx > 0) {
        // No next entry — push previous entry's timeOut forward
        occ[idx - 1].timeOut = removed.timeOut;
      }
    }
  }
}

/**
 * Reset a player in a specific period: give them a clean full-period entry
 * at their current position (or remove them entirely if benched).
 */
function resetPlayerInPeriod(periodIdx, pid) {
  if (!currentPlan || !ctx) return;
  const pa = currentPlan.periodAssignments[periodIdx];
  const locs = resolveSwapLocations(periodIdx, pid, pid);
  const loc = locs[pid];

  if (loc.type === 'field') {
    // Clean entry at current position, remove from all others
    pa.assignments[loc.pos] = [{ pid, timeIn: 0.0, timeOut: 1.0 }];
    removePlayerFromOtherPositions(pa, pid, loc.pos);
  } else {
    // Player is on bench — remove all their entries from all positions
    removePlayerFromOtherPositions(pa, pid, null);
  }

  validateAssignments(pa);
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  markDataDirty();
}

/** Validate: no player as last-occupant of multiple positions. */
function validateAssignments(pa) {
  const seen = new Set();
  for (const [pos, occ] of Object.entries(pa.assignments)) {
    if (!Array.isArray(occ) || occ.length === 0) continue;
    const lastPid = occ[occ.length - 1].pid;
    if (seen.has(lastPid)) {
      // Duplicate! This player is already the current occupant of another position.
      // Revert this slot's last entry to the previous occupant, or remove if only entry.
      console.warn(`[validateAssignments] Duplicate last-occupant ${lastPid} at ${pos} — fixing`);
      if (occ.length > 1) {
        // Remove the last entry, extend the previous one to 1.0
        occ.pop();
        occ[occ.length - 1].timeOut = 1.0;
      }
      // If single entry, we can't do much — leave it (shouldn't happen)
    } else {
      seen.add(lastPid);
    }
  }
}

/** Swap: exchange current positions, splitting entries that span before the swap point. */
function executeSwap(periodIdx, pidA, pidB) {
  const pa = currentPlan.periodAssignments[periodIdx];
  const locs = resolveSwapLocations(periodIdx, pidA, pidB);

  if (locs[pidA].type === 'field' && locs[pidB].type === 'field') {
    const occA = pa.assignments[locs[pidA].pos];
    const occB = pa.assignments[locs[pidB].pos];
    const lastA = occA[occA.length - 1];
    const lastB = occB[occB.length - 1];

    // Swap time = the later of the two entries' start times
    const swapTime = Math.max(lastA.timeIn, lastB.timeIn);

    // For each slot: if the last entry started before swapTime, split it first
    if (lastA.timeIn < swapTime - 0.001) {
      splitSlotEntry(occA, swapTime, lastA.pid, pidB);
    } else {
      lastA.pid = pidB;
    }

    if (lastB.timeIn < swapTime - 0.001) {
      splitSlotEntry(occB, swapTime, lastB.pid, pidA);
    } else {
      lastB.pid = pidA;
    }
  } else {
    // Bench ↔ Field: bench player takes field player's current entry
    const fieldPid = locs[pidA].type === 'field' ? pidA : pidB;
    const benchPid = locs[pidA].type === 'bench' ? pidA : pidB;
    const occ = pa.assignments[locs[fieldPid].pos];
    occ[occ.length - 1].pid = benchPid;
    pa.bench = pa.bench.filter(b => b !== benchPid);
    if (!pa.bench.includes(fieldPid)) pa.bench.push(fieldPid);
  }

  swapSelection = null;
  swapHighlight = { periodIdx, pids: [pidA, pidB] };
  validateAssignments(currentPlan.periodAssignments[periodIdx]);
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  markDataDirty(); renderLineup();
  showToast(`Swapped ${displayName(pidA)} and ${displayName(pidB)}`, 'success');
  setTimeout(() => { swapHighlight = null; renderLineup(); }, 1200);
}

function executeMidPeriodSub(periodIdx, pidA, pidB, atFraction) {
  const pa = currentPlan.periodAssignments[periodIdx];
  const locs = resolveSwapLocations(periodIdx, pidA, pidB);
  if (locs[pidA].type === 'field' && locs[pidB].type === 'field') {
    const occA = pa.assignments[locs[pidA].pos];
    const occB = pa.assignments[locs[pidB].pos];
    splitSlotEntry(occA, atFraction, occA[occA.length - 1].pid, pidB);
    splitSlotEntry(occB, atFraction, occB[occB.length - 1].pid, pidA);
  } else {
    const fieldPid = locs[pidA].type === 'field' ? pidA : pidB;
    const benchPid = locs[pidA].type === 'bench' ? pidA : pidB;
    const occ = pa.assignments[locs[fieldPid].pos];
    splitSlotEntry(occ, atFraction, occ[occ.length - 1].pid, benchPid);
  }
  swapSelection = null;
  swapHighlight = { periodIdx, pids: [pidA, pidB] };
  validateAssignments(currentPlan.periodAssignments[periodIdx]);
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  markDataDirty(); renderLineup();
  showToast(`Sub at ${Math.round(atFraction * 100)}%`, 'success');
  setTimeout(() => { swapHighlight = null; renderLineup(); }, 1200);
}

// -- Sub Popup (tap-order-independent) ----------------------------------

function openSubPopup(periodIdx, pidA, pidB) {
  closeSubPopup();
  const mode = getActiveTrackingMode();
  const pa = currentPlan.periodAssignments[periodIdx];
  const locs = resolveSwapLocations(periodIdx, pidA, pidB);
  const isFF = locs[pidA].type === 'field' && locs[pidB].type === 'field';
  const targetPos = isFF ? locs[pidA].pos : (locs[pidA].type === 'field' ? locs[pidA].pos : locs[pidB].pos);
  const slotOcc = pa.assignments[targetPos];
  const last = Array.isArray(slotOcc) && slotOcc.length > 0 ? slotOcc[slotOcc.length - 1] : { timeIn: 0, timeOut: 1 };
  const tS = last.timeIn, tE = last.timeOut;
  const posLabel = isFF ? `${locs[pidA].pos} ↔ ${locs[pidB].pos}` : targetPos;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'subPopup';
  let pickerHtml = '';
  const pd = getActivePeriodDuration();
  if (mode === 'coarse') {
    pickerHtml = '<div class="sub-fractions">';
    for (const f of COARSE_FRACTIONS) {
      const dis = (f.value <= tS + 0.01 || f.value >= tE - 0.01) ? ' disabled' : '';
      const timeHint = pd ? `<span class="frac-time">${fractionToDisplay(f.value, pd)}</span>` : '';
      pickerHtml += `<button class="sub-frac-btn"${dis} onclick="confirmSubPopup(${periodIdx},'${pidA}','${pidB}',${f.value})">${f.label}${timeHint}</button>`;
    }
    pickerHtml += '</div>';
  } else {
    const pd = getActivePeriodDuration(), inc = getActivePeriodIncrement();
    if (pd) {
      // Bounds: stepper can reach entry edges. Confirm detects swap at boundaries.
      const minS = Math.round(tS * pd);
      const maxS = Math.round(tE * pd);
      const cf = (getActiveClockEnabled() && getActiveClockAutoFill() && clockRunning) ? clockGetFraction() : null;
      let init = (cf != null && cf > tS && cf < tE) ? Math.round(cf * pd) : Math.round((tS + tE) / 2 * pd);
      init = Math.max(minS, Math.min(init, maxS));
      const timeLabel = getActiveTimeDisplay() === 'remaining' ? 'remaining' : 'elapsed';
      if (minS <= maxS) {
        pickerHtml = `<div class="sub-stepper"><button class="sub-step-btn" onclick="stepSubTime(-1)">−</button><span class="sub-time-display" id="subTimeDisplay">${fractionToDisplay(init / pd, pd)}</span><button class="sub-step-btn" onclick="stepSubTime(1)">+</button></div>
        <div class="sub-time-label">${timeLabel} <button class="sub-time-toggle" onclick="toggleSubTimeDisplay()">↕</button></div>
        <div class="sub-inc-row"><button class="sub-inc${inc===1?' active':''}" onclick="setSubInc(1)">1s</button><button class="sub-inc${inc===10?' active':''}" onclick="setSubInc(10)">10s</button><button class="sub-inc${inc===30?' active':''}" onclick="setSubInc(30)">30s</button><button class="sub-inc${inc===60?' active':''}" onclick="setSubInc(60)">1m</button><button class="sub-inc${inc===300?' active':''}" onclick="setSubInc(300)">5m</button></div>
        <input type="hidden" id="subTimeSec" value="${init}"><input type="hidden" id="subTimeMin" value="${minS}"><input type="hidden" id="subTimeMax" value="${maxS}">
        <button class="btn btn-primary sub-confirm-time" onclick="confirmSubPopupFine(${periodIdx},'${pidA}','${pidB}')">Confirm</button>`;
      } else { pickerHtml = '<div style="text-align:center;color:var(--fg2);font-size:12px;padding:8px">No room for a timed sub in this window.</div>'; }
    } else { pickerHtml = '<div style="text-align:center;color:var(--fg2);font-size:12px;padding:8px">Set period duration first<br><button class="btn btn-sm btn-outline" style="margin-top:8px" onclick="closeSubPopup();openPeriodDurationPrompt()">Set Duration</button></div>'; }
  }
  overlay.innerHTML = `<div class="modal sub-popup" role="dialog" aria-label="Substitution" aria-modal="true">
    <div class="sub-header">${esc(displayName(pidA))} <span class="sub-arrow">↔</span> ${esc(displayName(pidB))} <span class="sub-pos-label">${posLabel}</span></div>
    <div class="sub-action-row">
      <button class="btn btn-outline sub-action-btn" onclick="confirmSubPopupSwap(${periodIdx},'${pidA}','${pidB}')">Swap</button>
      <button class="btn btn-outline sub-action-btn" onclick="confirmSubPopupReplace(${periodIdx},'${pidA}','${pidB}')">Replace</button>
    </div>
    <div class="sub-divider"><span>or ${isFF ? 'shift' : 'sub'} at</span></div>
    ${pickerHtml}
    <button class="sub-cancel" onclick="closeSubPopup()">Cancel</button></div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeSubPopup(); });
  document.body.appendChild(overlay);
}

function setSubInc(sec) {
  if (currentPlan && ctx) { currentPlan.periodIncrement = sec; Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan); }
  document.querySelectorAll('.sub-inc').forEach(b => b.classList.remove('active'));
  document.querySelector(`.sub-inc[onclick="setSubInc(${sec})"]`)?.classList.add('active');
  // No snap — just changes step size for future +/- presses
}

function toggleSubTimeDisplay() {
  if (!currentPlan || !ctx) return;
  currentPlan.timeDisplay = getActiveTimeDisplay() === 'elapsed' ? 'remaining' : 'elapsed';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  const label = document.querySelector('.sub-time-label');
  if (label) label.firstChild.textContent = currentPlan.timeDisplay + ' ';
  const secEl = document.getElementById('subTimeSec');
  const dispEl = document.getElementById('subTimeDisplay');
  const pd = getActivePeriodDuration();
  if (secEl && dispEl && pd) dispEl.textContent = fractionToDisplay(parseFloat(secEl.value) / pd, pd);
}
function closeSubPopup() { document.getElementById('subPopup')?.remove(); swapSelection = null; renderLineup(); }
function confirmSubPopupReplace(periodIdx, pidA, pidB) { closeSubPopup(); executeFullReplace(periodIdx, pidA, pidB); }
function confirmSubPopupSwap(periodIdx, pidA, pidB) { closeSubPopup(); executeSwap(periodIdx, pidA, pidB); }
function confirmSubPopup(periodIdx, pidA, pidB, fraction) { closeSubPopup(); executeMidPeriodSub(periodIdx, pidA, pidB, fraction); }
function confirmSubPopupFine(periodIdx, pidA, pidB) {
  const secEl = document.getElementById('subTimeSec'), pd = getActivePeriodDuration();
  if (!secEl || !pd) { closeSubPopup(); return; }
  const sec = parseFloat(secEl.value);
  const minS = parseFloat(document.getElementById('subTimeMin')?.value || 0);
  const maxS = parseFloat(document.getElementById('subTimeMax')?.value || pd);
  // At either boundary → treat as swap (no zero-length entries)
  if (sec <= minS || sec >= maxS) { closeSubPopup(); executeSwap(periodIdx, pidA, pidB); return; }
  closeSubPopup(); executeMidPeriodSub(periodIdx, pidA, pidB, timeToFraction(sec, pd));
}
function stepSubTime(dir) {
  const secEl = document.getElementById('subTimeSec'), dispEl = document.getElementById('subTimeDisplay');
  if (!secEl || !dispEl) return;
  const pd = getActivePeriodDuration(), inc = getActivePeriodIncrement(); if (!pd) return;
  const minSec = parseFloat(document.getElementById('subTimeMin')?.value || 1);
  const maxSec = parseFloat(document.getElementById('subTimeMax')?.value || (pd - 1));
  let sec = Math.max(minSec, Math.min(parseFloat(secEl.value) + dir * inc, maxSec));
  secEl.value = sec; dispEl.textContent = fractionToDisplay(sec / pd, pd);
}
function clearSwap() { swapSelection = null; renderLineup(); }

// -- Player Time Detail Popup -------------------------------------------

function openPlayerTimePopup(periodIdx, pid) {
  if (!currentPlan || !roster) return;
  document.getElementById('playerTimePopup')?.remove();

  const plan = currentPlan;
  const pd = getActivePeriodDuration() || 720;
  const posColors = getPositionColors(roster.positions);
  const periodLabel = getPeriodLabel(plan.numPeriods);
  const playerName = displayName(pid);
  const timeDisp = getActiveTimeDisplay();

  const fmtTime = (frac) => timeDisp === 'remaining'
    ? fractionToRemaining(frac, pd) : fractionToElapsed(frac, pd);

  // Build content for each period
  let periodsHtml = '';
  let gameTotalCredit = 0;
  let hasAnyReset = false;

  for (let pi = 0; pi < plan.periodAssignments.length; pi++) {
    const pa = plan.periodAssignments[pi];
    const isCurrent = pi === periodIdx;

    // Collect entries for this player in this period
    const entries = [];
    for (const [pos, occ] of Object.entries(pa.assignments)) {
      const occupants = Array.isArray(occ) ? occ : [{ pid: occ, timeIn: 0, timeOut: 1 }];
      for (const e of occupants) {
        if (e.pid === pid) entries.push({ pos, timeIn: e.timeIn, timeOut: e.timeOut });
      }
    }
    entries.sort((a, b) => a.timeIn - b.timeIn);

    let periodCredit = entries.reduce((s, e) => s + (e.timeOut - e.timeIn), 0);
    gameTotalCredit += periodCredit;

    // Bar segments with gap spacers
    let barHtml = '';
    let cursor = 0;
    for (const e of entries) {
      if (e.timeIn > cursor + 0.001) {
        barHtml += `<span class="ptp-seg ptp-gap" style="width:${((e.timeIn - cursor) * 100).toFixed(1)}%"></span>`;
      }
      const w = ((e.timeOut - e.timeIn) * 100).toFixed(1);
      barHtml += `<span class="ptp-seg" style="width:${w}%;background:${posColors[e.pos] || 'var(--fg2)'}"></span>`;
      cursor = e.timeOut;
    }
    if (cursor < 0.999) {
      barHtml += `<span class="ptp-seg ptp-gap" style="width:${((1 - cursor) * 100).toFixed(1)}%"></span>`;
    }
    if (entries.length === 0) {
      barHtml = '<span class="ptp-seg ptp-gap" style="width:100%"></span>';
    }

    // Time markers
    const transitions = new Set();
    for (const e of entries) { transitions.add(e.timeIn); transitions.add(e.timeOut); }
    // Remove period edges — only show internal transition times
    transitions.delete(0);
    transitions.delete(1);
    let markersHtml = '';
    let ticksHtml = '';
    for (const t of [...transitions].sort((a, b) => a - b)) {
      markersHtml += `<span class="ptp-marker" style="left:${(t * 100).toFixed(1)}%">${fmtTime(t)}</span>`;
      ticksHtml += `<span class="ptp-tick" style="left:${(t * 100).toFixed(1)}%"></span>`;
    }

    // Detail rows
    let detailHtml = '';
    for (const e of entries) {
      const credit = e.timeOut - e.timeIn;
      detailHtml += `<div class="ptp-detail-row">
        <span class="ptp-swatch" style="background:${posColors[e.pos] || 'var(--fg2)'}"></span>
        <span class="ptp-pos">${e.pos}</span>
        <span class="ptp-range">${fmtTime(e.timeIn)} → ${fmtTime(e.timeOut)}</span>
        <span class="ptp-pct">${Math.round(credit * 100)}%</span>
      </div>`;
    }

    const periodTime = fractionToElapsed(periodCredit, pd);
    const periodTotal = fractionToElapsed(1, pd);
    const periodPct = Math.round(periodCredit * 100);
    const isClean = entries.length === 1 && entries[0].timeIn < 0.001 && entries[0].timeOut > 0.999;
    const needsReset = entries.length > 0 && !isClean;
    const resetBtn = needsReset
      ? `<button class="ptp-reset-btn" onclick="resetPlayerPeriodUI(${pi},'${pid}',${periodIdx})">Reset ${periodLabel} ${pa.period}</button>` : '';

    periodsHtml += `<div class="ptp-period-block${isCurrent ? ' ptp-current' : ''}">
      <div class="ptp-period-hdr">
        <span>${periodLabel} ${pa.period}</span>
        <span class="ptp-period-stat">${periodTime} / ${periodTotal} · ${periodPct}%</span>
      </div>
      <div class="ptp-bar-wrap">
        <div class="ptp-bar">${barHtml}<div class="ptp-ticks">${ticksHtml}</div></div>
        <div class="ptp-markers">${markersHtml}</div>
      </div>
      ${entries.length > 0 ? `<div class="ptp-details">${detailHtml}</div>` : '<div class="ptp-bench-note">Bench</div>'}
      ${resetBtn}
    </div>`;
    if (needsReset) hasAnyReset = true;
  }

  // Game total
  const gameTotalTime = fractionToElapsed(gameTotalCredit, pd);
  const gameFullTime = fractionToElapsed(plan.numPeriods, pd);
  const gamePct = Math.round((gameTotalCredit / plan.numPeriods) * 100);
  const resetAllBtn = hasAnyReset
    ? `<button class="ptp-reset-all" onclick="resetPlayerAllPeriodsUI('${pid}',${periodIdx})">Reset All Quarters</button>` : '';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'playerTimePopup';
  overlay.dataset.periodIdx = periodIdx;
  overlay.dataset.pid = pid;
  overlay.innerHTML = `<div class="modal ptp-popup">
    <div class="ptp-header">
      <span class="ptp-name">${esc(playerName)}</span>
      <button class="ptp-time-toggle" onclick="togglePopupTimeDisplay()" title="Switch elapsed/remaining">${timeDisp === 'elapsed' ? '↑ elapsed' : '↓ remaining'}</button>
    </div>
    ${periodsHtml}
    <div class="ptp-game-total">Game: ${gameTotalTime} / ${gameFullTime} · ${gamePct}%</div>
    ${resetAllBtn}
    <button class="sub-cancel" onclick="document.getElementById('playerTimePopup')?.remove()">Close</button>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

/** Toggle elapsed/remaining in the popup and re-render it */

function resetPlayerPeriodUI(periodIdx, pid, origPeriodIdx) {
  resetPlayerInPeriod(periodIdx, pid);
  renderLineup();
  document.getElementById("playerTimePopup")?.remove();
  openPlayerTimePopup(origPeriodIdx, pid);
}

function resetPlayerAllPeriodsUI(pid, origPeriodIdx) {
  if (!currentPlan) return;
  for (let i = 0; i < currentPlan.periodAssignments.length; i++) {
    resetPlayerInPeriod(i, pid);
  }
  renderLineup();
  document.getElementById("playerTimePopup")?.remove();
  openPlayerTimePopup(origPeriodIdx, pid);
}

function togglePopupTimeDisplay() {
  if (!currentPlan || !ctx) return;
  currentPlan.timeDisplay = getActiveTimeDisplay() === 'elapsed' ? 'remaining' : 'elapsed';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  // Find the popup's current periodIdx and pid from the DOM, then re-open
  const popup = document.getElementById('playerTimePopup');
  if (!popup) return;
  const data = popup.querySelector('.ptp-popup')?.dataset;
  // We'll store these as data attributes
  const pi = parseInt(popup.dataset.periodIdx || 0);
  const pid = popup.dataset.pid || '';
  popup.remove();
  if (pid) openPlayerTimePopup(pi, pid);
}

// -- Tracking Mode Settings ---------------------------------------------

function setGameTrackingMode(mode) {
  if (!currentPlan || !ctx) return;

  const oldMode = getActiveTrackingMode();
  if (mode === oldMode) return;

  // Downgrade warning: check for multi-occupant slots
  if ((oldMode === 'fine' || oldMode === 'coarse') && mode === 'simple') {
    let affectedSlots = 0;
    for (const pa of currentPlan.periodAssignments) {
      for (const occupants of Object.values(pa.assignments)) {
        if (Array.isArray(occupants) && occupants.length > 1) affectedSlots++;
      }
    }
    if (affectedSlots > 0) {
      // Show downgrade modal with strategy options
      closeCustomModal();
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay'; overlay.id = 'customModal';
      overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
        <h2>Downgrade to Simple?</h2>
        <div class="modal-message">${affectedSlots} position slot${affectedSlots > 1 ? 's have' : ' has'} mid-period changes. Choose which player keeps the full period:</div>
        <div style="margin:12px 0">
          <select id="downgradeStrategy" style="width:100%">
            <option value="current">Current player (on field now)</option>
            <option value="most">Most playing time</option>
            <option value="starter">Starter (first player assigned)</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" onclick="closeCustomModal()">Cancel</button>
          <button class="btn btn-danger" onclick="applyDowngrade()">Downgrade</button>
        </div>
      </div>`;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCustomModal(); });
      document.body.appendChild(overlay);
      return;
    }
  }

  currentPlan.trackingMode = mode;
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

function applyDowngrade() {
  const sel = document.getElementById('downgradeStrategy');
  const strategy = sel ? sel.value : 'current';
  closeCustomModal();
  downgradeSlotsToSimple(strategy);
  currentPlan.trackingMode = 'simple';
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

/** Downgrade all multi-occupant slots to simple. */
function downgradeSlotsToSimple(strategy = 'current') {
  if (!currentPlan) return;
  for (const pa of currentPlan.periodAssignments) {
    for (const [pos, occupants] of Object.entries(pa.assignments)) {
      if (!Array.isArray(occupants) || occupants.length <= 1) continue;
      let winnerPid;
      if (strategy === 'starter') {
        winnerPid = occupants[0].pid;
      } else if (strategy === 'current') {
        winnerPid = occupants[occupants.length - 1].pid;
      } else {
        // 'most' — highest aggregated credit
        const credits = {};
        for (const e of occupants) credits[e.pid] = (credits[e.pid] || 0) + (e.timeOut - e.timeIn);
        winnerPid = occupants[0].pid;
        let best = credits[winnerPid];
        for (const [pid, c] of Object.entries(credits)) {
          if (c > best) { winnerPid = pid; best = c; }
        }
      }
      pa.assignments[pos] = [{ pid: winnerPid, timeIn: 0.0, timeOut: 1.0 }];
    }
  }
}

function toggleGameClock() {
  if (!currentPlan || !ctx) return;
  currentPlan.clockEnabled = !getActiveClockEnabled();
  if (!currentPlan.clockEnabled) {
    clockReset();
  }
  Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
  renderLineup();
}

function openPeriodDurationPrompt() {
  closeCustomModal();
  const current = getActivePeriodDuration();
  const m = Math.floor(current / 60);
  const s = current % 60;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay'; overlay.id = 'customModal';
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    <h2>Period Duration</h2>
    <div class="dur-input-row">
      <div class="dur-field">
        <button class="dur-step" onclick="stepDurField('durMin',1)">▲</button>
        <input type="number" id="durMin" value="${m}" min="0" max="99" inputmode="numeric" class="dur-num">
        <button class="dur-step" onclick="stepDurField('durMin',-1)">▼</button>
        <span class="dur-label">min</span>
      </div>
      <span class="dur-colon">:</span>
      <div class="dur-field">
        <button class="dur-step" onclick="stepDurField('durSec',1)">▲</button>
        <input type="number" id="durSec" value="${String(s).padStart(2,'0')}" min="0" max="59" inputmode="numeric" class="dur-num">
        <button class="dur-step" onclick="stepDurField('durSec',-1)">▼</button>
        <span class="dur-label">sec</span>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeCustomModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePeriodDuration()">Set</button>
    </div>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCustomModal(); });
  document.body.appendChild(overlay);
}

function stepDurField(id, dir) {
  const el = document.getElementById(id);
  if (!el) return;
  let val = parseInt(el.value) || 0;
  val = Math.max(parseInt(el.min), Math.min(val + dir, parseInt(el.max)));
  el.value = id === 'durSec' ? String(val).padStart(2, '0') : val;
}

function savePeriodDuration() {
  const m = parseInt(document.getElementById('durMin')?.value) || 0;
  const s = parseInt(document.getElementById('durSec')?.value) || 0;
  const secs = m * 60 + s;
  if (secs <= 0) return;
  closeCustomModal();
  if (currentPlan && ctx) {
    currentPlan.periodDuration = secs;
    Storage.saveGame(ctx.teamSlug, ctx.seasonSlug, currentPlan);
    renderLineup();
  }
}

/** Save season-level tracking mode defaults. */
function saveSeasonTrackingDefaults(updates) {
  if (!ctx) return;
  const seasons = Storage.loadSeasons(ctx.teamSlug);
  const idx = seasons.findIndex(s => s.slug === ctx.seasonSlug);
  if (idx < 0) return;
  Object.assign(seasons[idx], updates);
  Storage.saveSeasons(ctx.teamSlug, seasons);
}

// -- Share Lineup ---------------------------------------------------
function buildLineupText() {
  if (!currentPlan || !roster) return '';

  const plan = currentPlan;
  const periodLabel = getPeriodLabel(plan.numPeriods, true);
  const lines = [];

  const team = teams.find(t => t.slug === ctx?.teamSlug);
  if (team) lines.push(team.name);
  const gnLabel = getGameNumLabel(plan);
  const gameLabel = plan.label ? `  —  ${plan.label}` : '';
  lines.push(`${plan.date}${gnLabel}${gameLabel}  --  ${plan.availablePlayers.length} players, ${plan.numPeriods} ${getPeriodLabelPlural(plan.numPeriods)}${plan.exhibition ? '  (Scrimmage)' : ''}`);
  if (hasScoreData(plan)) {
    lines.push(`Score: ${getTotalTeamGoals(plan)} - ${getTotalOppGoals(plan)}`);
  }
  lines.push('');

  for (let pi = 0; pi < plan.periodAssignments.length; pi++) {
    const pa = plan.periodAssignments[pi];
    let periodHead = `${periodLabel}${pa.period}:`;
    if (hasScoreData(plan)) {
      periodHead += `  (${scoreTeamName()} ${getPeriodTeamGoals(plan, pi)} - Opp ${getPeriodOppGoals(plan, pi)})`;
    }
    lines.push(periodHead);
    for (const pos of roster.positions) {
      const slotVal = pa.assignments[pos];
      const pid = Array.isArray(slotVal) ? slotVal[0].pid : slotVal;
      const name = displayName(pid);
      const g = getPlayerGoals(plan, pid, pi);
      const goalStr = g > 0 ? `  [${g} goal${g > 1 ? 's' : ''}]` : '';
      lines.push(`  ${pos.padEnd(4)} ${name}${goalStr}`);
    }
    if (pa.bench.length > 0) {
      const benchNames = pa.bench.map(b => displayName(b)).join(', ');
      lines.push(`  Bench: ${benchNames}`);
    }
    lines.push('');
  }

  const summary = getPlayerSummary(plan);
  lines.push('Player Summary:');
  for (const pid of plan.availablePlayers) {
    const s = summary[pid];
    const name = displayName(pid);
    lines.push(`  ${name}: ${fmtPeriods(s.periodsPlayed)}/${plan.numPeriods}  --  ${s.positions.join(', ')}`);
  }

  if (plan.notes) {
    lines.push('');
    lines.push('Notes:');
    lines.push(plan.notes);
  }

  return lines.join('\n');
}

async function shareLineup() {
  if (!currentPlan || !roster) return;
  const text = buildLineupText();
  const blob = new Blob([text], { type: 'text/plain' });
  const gid = currentPlan?.gameId || 'lineup';
  await shareOrDownload(blob, `lineup-${gid}.txt`, 'Lineup shared');
}

function printLineup() {
  if (!currentPlan || !roster) return;

  const plan = currentPlan;
  const periodLabel = getPeriodLabel(plan.numPeriods, true);
  const team = teams.find(t => t.slug === ctx?.teamSlug);
  const teamName = team ? team.name : '';
  const gnLabel = getGameNumLabel(plan);
  const gameLabel = plan.label ? ` \u2014 ${plan.label}` : '';
  const summary = getPlayerSummary(plan);

  // Build period columns
  const numPeriods = plan.periodAssignments.length;
  const positions = roster.positions;

  // Period header row
  let periodHeaders = '';
  for (let pi = 0; pi < numPeriods; pi++) {
    const pa = plan.periodAssignments[pi];
    periodHeaders += `<th>${periodLabel}${pa.period}</th>`;
  }

  // Position rows: one row per position, cells = # + name for that period
  let positionRows = '';
  for (const pos of positions) {
    let cells = `<td class="pos-cell">${esc(pos)}</td>`;
    for (let pi = 0; pi < numPeriods; pi++) {
      const pa = plan.periodAssignments[pi];
      const slotVal = pa.assignments[pos];
      const pid = Array.isArray(slotVal) ? slotVal[0].pid : slotVal;
      if (pid && roster.players[pid]) {
        const p = roster.players[pid];
        const num = p.number ? `<span class="num">${esc(p.number)}</span>` : '<span class="num"></span>';
        cells += `<td>${num}${esc(p.name)}</td>`;
      } else {
        cells += '<td>\u2014</td>';
      }
    }
    positionRows += `<tr>${cells}</tr>`;
  }

  // Bench row
  let benchCells = '<td class="pos-cell">Bench</td>';
  for (let pi = 0; pi < numPeriods; pi++) {
    const pa = plan.periodAssignments[pi];
    const benchNames = (pa.bench || []).map(pid => {
      const p = roster.players[pid];
      return p ? esc(p.name) : '?';
    }).join(', ');
    benchCells += `<td class="bench-cell">${benchNames || '\u2014'}</td>`;
  }

  // Player summary table
  let summaryRows = '';
  for (const pid of plan.availablePlayers) {
    const s = summary[pid];
    const p = roster.players[pid];
    if (!p) continue;
    const num = p.number || '';
    summaryRows += `<tr><td>${esc(p.name)}</td><td class="num-col">${esc(num)}</td><td>${fmtPeriods(s.periodsPlayed)}/${plan.numPeriods}</td><td>${s.positions.join(', ')}</td></tr>`;
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Lineup - ${esc(teamName)} ${plan.date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 11px; color: #000; padding: 12px; }
  .header { margin-bottom: 10px; }
  .header h1 { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .header .sub { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 11px; }
  th { background: #f0f0f0; font-weight: 700; text-align: center; }
  .pos-cell { font-weight: 700; background: #f8f8f8; width: 40px; text-align: center; }
  .bench-cell { font-size: 10px; color: #555; }
  .num { display: inline-block; width: 20px; font-weight: 600; color: #888; font-size: 10px; text-align: right; margin-right: 4px; }
  .summary { margin-top: 8px; }
  .summary th { text-align: left; }
  .num-col { text-align: center; width: 28px; }
  @media print {
    body { padding: 0; }
    @page { margin: 10mm; size: auto; }
  }
</style>
</head><body>
<div class="header">
  <h1>${esc(teamName)}</h1>
  <div class="sub">${plan.date}${gnLabel}${esc(gameLabel)} \u2014 ${plan.availablePlayers.length} players, ${plan.numPeriods} ${getPeriodLabelPlural(plan.numPeriods)}</div>
</div>

<table>
  <thead><tr><th></th>${periodHeaders}</tr></thead>
  <tbody>
    ${positionRows}
    <tr class="bench-row">${benchCells}</tr>
  </tbody>
</table>

<table class="summary">
  <thead><tr><th>Player</th><th>#</th><th>Played</th><th>Positions</th></tr></thead>
  <tbody>${summaryRows}</tbody>
</table>

<script>window.onload = function() { window.print(); }</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('Pop-up blocked — allow pop-ups for this site', 'error');
  }
}

// -- Season Summary -------------------------------------------------
// -- Position colors for charts (deterministic from position list) --
function getPositionColors(positions) {
  // 12 perceptually distinct colors optimized for dark backgrounds.
  // Based on ColorBrewer qualitative palettes, tuned for saturation/brightness on dark.
  const palette = [
    '#00e676', // green
    '#42a5f5', // blue
    '#ef5350', // red
    '#ffca28', // amber
    '#ab47bc', // purple
    '#26c6da', // cyan
    '#ff7043', // deep orange
    '#66bb6a', // light green
    '#ec407a', // pink
    '#8d6e63', // brown
    '#78909c', // blue grey
    '#d4e157', // lime
  ];
  const colors = {};
  positions.forEach((pos, i) => { colors[pos] = palette[i % palette.length]; });
  return colors;
}

// -- Per-game fairness: max-min periods spread --
function gameFairnessSpread(game) {
  let min = game.numPeriods, max = 0;
  for (const pid of game.availablePlayers) {
    let played = 0;
    for (const pa of game.periodAssignments) {
      for (const val of Object.values(pa.assignments)) {
        if (Array.isArray(val)) {
          played += playerCreditInSlot(val, pid);
        } else if (val === pid) {
          played++;
        }
      }
    }
    if (played < min) min = played;
    if (played > max) max = played;
  }
  return max - min;
}

function renderSeason() {
  if (!ctx || !roster) return;
  const el = document.getElementById('seasonContent');
  const allGames = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);

  if (allGames.length === 0) {
    el.innerHTML = '<div class="empty-state"><p><strong>No games yet</strong></p><p class="text-sm text-muted">Generate and save lineups from the <strong>Game Day</strong> tab. Season stats will appear here as you play games.</p></div>';
    return;
  }

  // Filter exhibition/scrimmage games from stats (but show them in Games list)
  const statGames = allGames.filter(g => !g.exhibition);
  const stats = computeStatsFromGames(statGames);
  const pids = Object.keys(stats);
  pids.sort((a, b) => {
    const aArchived = roster.players[a]?.archived ? 1 : 0;
    const bArchived = roster.players[b]?.archived ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    const na = roster.players[a]?.name || a;
    const nb = roster.players[b]?.name || b;
    return na.localeCompare(nb);
  });

  // Sub-tab pill bar
  let html = '<div class="season-sub-tabs">';
  for (const tab of ['overview', 'games', 'players']) {
    const label = tab.charAt(0).toUpperCase() + tab.slice(1);
    const active = seasonSubTab === tab ? ' active' : '';
    html += `<button class="season-sub-tab${active}" onclick="switchSeasonSubTab('${tab}')">${label}</button>`;
  }
  html += '</div>';

  if (seasonSubTab === 'overview') {
    html += renderSeasonOverview(statGames, stats, pids);
  } else if (seasonSubTab === 'games') {
    html += renderSeasonGames(allGames);
  } else {
    html += renderSeasonPlayers(statGames, stats, pids);
  }

  el.innerHTML = html;
}

function switchSeasonSubTab(tab) {
  seasonSubTab = tab;
  renderSeason();
}

// ── Season Overview sub-tab ──
function renderSeasonOverview(games, stats, pids) {
  let html = '';

  // Summary card
  const record = getSeasonRecord(games);
  html += `<div class="card">`;
  html += `<div class="card-title">Season Summary</div>`;
  html += `<div class="season-record">`;
  html += `<div class="season-record-games"><span class="season-record-num">${games.length}</span><span class="season-record-label">Game${games.length !== 1 ? 's' : ''}</span></div>`;
  html += `<div class="season-record-sep"></div>`;
  html += `<div class="season-record-wld">`;
  html += `<div class="season-record-stat"><span class="season-record-num win">${record.w}</span><span class="season-record-label">Win${record.w !== 1 ? 's' : ''}</span></div>`;
  html += `<div class="season-record-stat"><span class="season-record-num loss">${record.l}</span><span class="season-record-label">Loss${record.l !== 1 ? 'es' : ''}</span></div>`;
  html += `<div class="season-record-stat"><span class="season-record-num draw">${record.d}</span><span class="season-record-label">Draw${record.d !== 1 ? 's' : ''}</span></div>`;
  html += `</div></div>`;

  // Extra stats row
  const uniquePlayers = new Set();
  let totalAvail = 0;
  let totalFor = 0, totalAgainst = 0, shutouts = 0;
  let hasAnyScore = false;
  for (const g of games) {
    for (const pid of g.availablePlayers) uniquePlayers.add(pid);
    totalAvail += g.availablePlayers.length;
    if (hasScoreData(g)) {
      hasAnyScore = true;
      const gf = getTotalTeamGoals(g);
      const ga = getTotalOppGoals(g);
      totalFor += gf;
      totalAgainst += ga;
      if (ga === 0) shutouts++;
    }
  }
  const avgAvail = games.length > 0 ? (totalAvail / games.length).toFixed(1) : '0';

  html += '<div class="season-extra-stats">';
  html += `<div class="season-extra-stat"><span class="season-extra-num">${uniquePlayers.size}</span><span class="season-extra-label">Roster</span></div>`;
  html += `<div class="season-extra-stat"><span class="season-extra-num">${avgAvail}</span><span class="season-extra-label">Avg Avail</span></div>`;
  if (hasAnyScore) {
    const diff = totalFor - totalAgainst;
    const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
    const gdColor = diffColor(diff);
    html += `<div class="season-extra-stat"><span class="season-extra-num">${totalFor}\u2013${totalAgainst}</span><span class="season-extra-label" style="color:${gdColor}">${diffStr} GD</span></div>`;
    html += `<div class="season-extra-stat"><span class="season-extra-num">${shutouts}</span><span class="season-extra-label">Shutout${shutouts !== 1 ? 's' : ''}</span></div>`;
  }
  html += '</div>';

  html += '</div>';

  // Playing Time Chart (relative to team average)
  const ratios = pids.map(pid => {
    const s = stats[pid];
    return s.totalPeriodsAvailable > 0 ? s.totalPeriodsPlayed / s.totalPeriodsAvailable : 0;
  });
  const teamAvg = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0;
  const maxRatio = Math.max(...ratios, teamAvg, 0.01);

  const rowH = 28, nameW = 80, barX = 88, barMaxW = 200, padR = 50;
  const svgW = barX + barMaxW + padR;
  const totalRows = pids.length + 1;
  const svgH = totalRows * rowH + 4;
  const avgBarX = barX + (teamAvg / maxRatio) * barMaxW;

  const fc = fairnessColors();
  const fl = fairnessLabels();
  html += '<div class="card"><div class="card-title">Playing Time</div>';
  html += `<div class="chart-legend"><span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${fc.good}"></span>Even</span><span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${fc.warn}"></span>Close</span><span class="chart-legend-item"><span class="chart-legend-swatch" style="background:${fc.bad}"></span>Off</span></div>`;
  html += '<div class="chart-subtitle">Naturally evens out with more games</div>';
  html += `<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" style="display:block;font-family:'DM Sans',sans-serif">`;

  html += `<line x1="${avgBarX}" y1="0" x2="${avgBarX}" y2="${svgH}" stroke="var(--fg2)" stroke-width="1" stroke-dasharray="4,3" opacity="0.4"/>`;

  const avgPct = Math.round(teamAvg * 100);
  const avgW = Math.max((teamAvg / maxRatio) * barMaxW, 2);
  html += `<text x="${nameW}" y="${rowH * 0.65}" fill="var(--fg)" font-size="11" font-weight="600" text-anchor="end">Team Avg</text>`;
  html += `<rect x="${barX}" y="4" width="${avgW}" height="${rowH - 10}" rx="3" fill="var(--fg2)" opacity="0.5"/>`;
  html += `<text x="${barX + avgW + 5}" y="${rowH * 0.65}" fill="var(--fg)" font-size="10" font-weight="600" font-family="'JetBrains Mono',monospace">${avgPct}%</text>`;

  for (let i = 0; i < pids.length; i++) {
    const pid = pids[i];
    const ratio = ratios[i];
    const pct = Math.round(ratio * 100);
    const devFromAvg = teamAvg > 0 ? Math.abs(ratio - teamAvg) / teamAvg : 0;
    const color = fairnessBarColor(devFromAvg);
    const w = Math.max((ratio / maxRatio) * barMaxW, 2);
    const y = (i + 1) * rowH + 2;
    const isArchived = roster.players[pid]?.archived;
    const nameOpacity = isArchived ? ' opacity="0.5"' : '';
    const archivedTag = isArchived ? '<tspan fill="var(--fg2)" font-size="8" font-style="italic"> [A]</tspan>' : '';

    html += `<text x="${nameW}" y="${y + rowH * 0.65}" fill="var(--fg2)" font-size="11" text-anchor="end"${nameOpacity}>${displayNameSvg(pid)}${archivedTag}</text>`;
    html += `<rect x="${barX}" y="${y + 4}" width="${w}" height="${rowH - 10}" rx="3" fill="${color}" opacity="${isArchived ? '0.4' : '0.85'}"/>`;
    html += `<text x="${barX + w + 5}" y="${y + rowH * 0.65}" fill="var(--fg2)" font-size="10" font-family="'JetBrains Mono',monospace"${nameOpacity}>${pct}%</text>`;
  }
  html += '</svg></div>';

  return html;
}

// ── Season Games sub-tab ──
function renderSeasonGames(games) {
  let html = '';
  const fc = fairnessColors();
  const fl = fairnessLabels();

  // Availability dot chart
  if (games.length >= 2) {
    const rosterSize = roster ? getActivePlayerIds().length : 0;
    const dotSpacing = Math.min(36, Math.max(20, 300 / games.length));
    const padL = 24, padR = 8, padT = 18, padB = 18;
    const chartW = padL + games.length * dotSpacing + padR;
    const chartH = padT + padB + 48;
    const plotH = chartH - padT - padB;

    // Find min/max available for y-axis
    const counts = games.map(g => g.availablePlayers.length);
    const minCount = Math.min(...counts);
    const maxCount = Math.max(...counts, rosterSize);
    const yRange = Math.max(maxCount - minCount, 1);
    const yForCount = (c) => padT + plotH - ((c - minCount) / yRange) * plotH;

    html += '<div class="card"><div class="card-title">Availability</div>';
    html += `<div class="chart-subtitle">Color = fairness spread (${fl.good} \u2264 1, ${fl.warn} \u2264 2, ${fl.bad} \u2265 3)</div>`;
    html += `<svg width="100%" viewBox="0 0 ${chartW} ${chartH}" style="display:block;font-family:'DM Sans',sans-serif">`;

    // Y-axis labels
    html += `<text x="${padL - 4}" y="${yForCount(maxCount) + 3}" fill="var(--fg2)" font-size="8" text-anchor="end" font-family="'JetBrains Mono',monospace">${maxCount}</text>`;
    html += `<text x="${padL - 4}" y="${yForCount(minCount) + 3}" fill="var(--fg2)" font-size="8" text-anchor="end" font-family="'JetBrains Mono',monospace">${minCount}</text>`;

    // Roster size reference line (if meaningful)
    if (rosterSize > maxCount - 1) {
      const rosterY = yForCount(rosterSize);
      html += `<line x1="${padL}" y1="${rosterY}" x2="${chartW - padR}" y2="${rosterY}" stroke="var(--fg2)" stroke-width="1" stroke-dasharray="4,3" opacity="0.3"/>`;
    }

    // Connecting line
    let linePoints = '';
    for (let i = 0; i < games.length; i++) {
      const x = padL + i * dotSpacing + dotSpacing / 2;
      const y = yForCount(counts[i]);
      linePoints += `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }
    html += `<path d="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity="0.4"/>`;

    // Dots (letter = W/L/D, color = fairness spread)
    const dotR = 6;
    for (let i = 0; i < games.length; i++) {
      const x = padL + i * dotSpacing + dotSpacing / 2;
      const y = yForCount(counts[i]);
      const result = games[i].exhibition ? 'S' : getGameResult(games[i]);
      const spread = gameFairnessSpread(games[i]);
      const dotColor = result ? fairnessSpreadColor(spread) : 'var(--fg2)';
      html += `<circle cx="${x}" cy="${y}" r="${dotR}" fill="${dotColor}"/>`;
      if (result) {
        html += `<text x="${x}" y="${y + 3}" fill="#000" font-size="8" font-weight="700" text-anchor="middle" font-family="'JetBrains Mono',monospace">${result}</text>`;
      }
    }

    // X-axis: game numbers
    for (let i = 0; i < games.length; i++) {
      const x = padL + i * dotSpacing + dotSpacing / 2;
      html += `<text x="${x}" y="${chartH - 3}" fill="var(--fg2)" font-size="7" text-anchor="middle" font-family="'JetBrains Mono',monospace">${i + 1}</text>`;
    }

    html += '</svg></div>';
  }

  html += '<div class="card"><div class="card-title">Game History</div>';
  html += '<div class="chart-subtitle">Spread = difference in periods played between most and least (lower is fairer)</div>';

  for (const g of games.slice().reverse()) {
    const pLabel = getPeriodLabelPlural(g.numPeriods);
    const spread = gameFairnessSpread(g);
    const fsColor = fairnessSpreadColor(spread);
    const gidEsc = esc(g.gameId).replace(/'/g, "\\'");
    const gnLabel = getGameNumLabel(g);
    const gLabel = g.label ? ` \u2014 ${esc(g.label)}` : '';
    const result = g.exhibition ? null : getGameResult(g);
    const scoreStr = hasScoreData(g) ? `${getTotalTeamGoals(g)}-${getTotalOppGoals(g)}` : '';
    let wldHtml = '';
    if (result) {
      const wc = wldColor(result);
      wldHtml = `<span class="wld-pill" style="color:${wc};border-color:${wc}">${result}</span>`;
    }
    if (g.exhibition) {
      wldHtml = `<span class="wld-pill" style="color:var(--fg2);border-color:var(--border)">SCR</span>`;
    }
    const detailLine = [
      `${g.availablePlayers.length} players`,
      `${g.numPeriods} ${pLabel}`,
      scoreStr
    ].filter(Boolean).join('  \u2022  ');
    html += `
      <div class="game-history-item">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600">${g.date}${gnLabel}${gLabel}</div>
          <div class="text-sm text-muted">${detailLine}</div>
        </div>
        ${wldHtml}
        <span class="fairness-badge" style="color:${fsColor};border-color:${fsColor}" title="Spread: max periods played minus min">\u00B1${Math.round(spread)}</span>
        <button class="btn-ghost text-sm" onclick="viewPastGame('${gidEsc}')" style="color:var(--accent)">View</button>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// ── Season Players sub-tab ──
function renderSeasonPlayers(games, stats, pids) {
  let html = '';
  const seasonGoals = getSeasonGoals(games);
  const anyGoals = Object.values(seasonGoals).some(v => v > 0);

  // Season Overview Table
  html += `
    <div class="card">
      <div class="card-title">Season Overview  \u2014  ${games.length} Game${games.length > 1 ? 's' : ''}</div>
      <div style="overflow-x:auto">
      <table class="season-table">
        <thead><tr>
          <th>Player</th><th>Gm</th><th>Avg</th>
          ${anyGoals ? '<th>G</th>' : ''}
          ${roster.positions.map(p => `<th>${p}</th>`).join('')}
        </tr></thead>
        <tbody>
  `;

  for (const pid of pids) {
    const s = stats[pid];
    const avg = s.gamesAttended > 0 ? (s.totalPeriodsPlayed / s.gamesAttended).toFixed(1) : '0';
    const goals = seasonGoals[pid] || 0;
    const isArchived = roster.players[pid]?.archived;
    const rowClass = isArchived ? ' class="archived-row"' : '';
    const archivedLabel = isArchived ? ' <span class="archived-badge">archived</span>' : '';
    html += `<tr${rowClass}><td>${displayNameHtml(pid)}${archivedLabel}</td><td>${s.gamesAttended}</td><td>${avg}</td>`;
    if (anyGoals) html += `<td style="color:${goals > 0 ? 'var(--accent)' : 'var(--fg2)'};font-weight:${goals > 0 ? '700' : '400'}">${goals}</td>`;
    for (const pos of roster.positions) {
      html += `<td>${fmtPeriods(s.periodsByPosition[pos] || 0)}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div></div>';

  // Goals Bar Chart (only when goal data exists)
  if (anyGoals) {
    const rowH = 28, nameW = 80, barX = 88, barMaxW = 200, padR = 50;
    const svgW = barX + barMaxW + padR;
    // Sort players by goals descending for this chart
    const goalPids = pids.filter(pid => (seasonGoals[pid] || 0) > 0);
    goalPids.sort((a, b) => (seasonGoals[b] || 0) - (seasonGoals[a] || 0));
    const maxGoals = Math.max(...goalPids.map(pid => seasonGoals[pid] || 0), 1);
    const goalSvgH = goalPids.length * rowH + 4;

    html += '<div class="card"><div class="card-title">Goals</div>';
    html += `<svg width="100%" viewBox="0 0 ${svgW} ${goalSvgH}" style="display:block;font-family:'DM Sans',sans-serif">`;

    for (let i = 0; i < goalPids.length; i++) {
      const pid = goalPids[i];
      const g = seasonGoals[pid];
      const w = Math.max((g / maxGoals) * barMaxW, 2);
      const y = i * rowH + 2;

      html += `<text x="${nameW}" y="${y + rowH * 0.65}" fill="var(--fg2)" font-size="11" text-anchor="end">${displayNameSvg(pid)}</text>`;
      html += `<rect x="${barX}" y="${y + 4}" width="${w}" height="${rowH - 10}" rx="3" fill="var(--accent)" opacity="0.85"/>`;
      html += `<text x="${barX + w + 5}" y="${y + rowH * 0.65}" fill="var(--fg2)" font-size="10" font-weight="600" font-family="'JetBrains Mono',monospace">${g}</text>`;
    }
    html += '</svg></div>';
  }

  // Position Distribution Chart
  const posColors = getPositionColors(roster.positions);
  const rowH = 28, nameW = 80, barX = 88, barMaxW = 200, padR = 50;
  const svgW = barX + barMaxW + padR;
  const posSvgH = pids.length * rowH + 30;

  html += '<div class="card"><div class="card-title">Position Distribution</div>';
  html += `<svg width="100%" viewBox="0 0 ${svgW} ${posSvgH}" style="display:block;font-family:'DM Sans',sans-serif">`;

  for (let i = 0; i < pids.length; i++) {
    const pid = pids[i];
    const s = stats[pid];
    const total = s.totalPeriodsPlayed || 1;
    const y = i * rowH + 2;
    let xOff = barX;
    const isArchived = roster.players[pid]?.archived;
    const nameOpacity = isArchived ? ' opacity="0.5"' : '';
    const archivedTag = isArchived ? '<tspan fill="var(--fg2)" font-size="8" font-style="italic"> [A]</tspan>' : '';

    html += `<text x="${nameW}" y="${y + rowH * 0.65}" fill="var(--fg2)" font-size="11" text-anchor="end"${nameOpacity}>${displayNameSvg(pid)}${archivedTag}</text>`;

    for (const pos of roster.positions) {
      const count = s.periodsByPosition[pos] || 0;
      if (count === 0) continue;
      const w = (count / total) * barMaxW;
      html += `<rect x="${xOff}" y="${y + 4}" width="${w}" height="${rowH - 10}" fill="${posColors[pos]}" opacity="${isArchived ? '0.4' : '0.8'}"><title>${pos}: ${fmtPeriods(count)} (${Math.round(count / total * 100)}%)</title></rect>`;
      xOff += w;
    }
  }

  const legendY = pids.length * rowH + 8;
  let lx = barX;
  for (const pos of roster.positions) {
    html += `<rect x="${lx}" y="${legendY}" width="10" height="10" rx="2" fill="${posColors[pos]}" opacity="0.8"/>`;
    html += `<text x="${lx + 13}" y="${legendY + 9}" fill="var(--fg2)" font-size="9" font-family="'JetBrains Mono',monospace">${pos}</text>`;
    lx += 13 + pos.length * 6 + 10;
    if (lx > svgW - 30) { lx = barX; }
  }

  html += '</svg></div>';
  return html;
}

function viewPastGame(gameId) {
  if (!ctx) return;
  const games = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
  const game = games.find(g => g.gameId === gameId);
  if (!game) return;
  currentPlan = game;
  closeDynamicModal('gamePickerModal');
  renderLineup();
  document.querySelectorAll('nav button')[2].click();
}

// -- Game Picker (bottom-sheet) ------------------------------------
function openGamePicker() {
  if (!ctx) return;
  const games = Storage.loadAllGames(ctx.teamSlug, ctx.seasonSlug);
  if (games.length === 0) return;

  let listHtml = '';
  for (const g of games.slice().reverse()) {
    const gnLabel = getGameNumLabel(g);
    const gLabel = g.label ? ` \u2014 ${esc(g.label)}` : '';
    const gidEsc = esc(g.gameId).replace(/'/g, "\\'");
    const isCurrent = currentPlan && g.gameId === currentPlan.gameId;
    const activeClass = isCurrent ? ' game-picker-active' : '';
    const scoreStr = hasScoreData(g) ? `${getTotalTeamGoals(g)}-${getTotalOppGoals(g)}` : '';
    const result = g.exhibition ? null : getGameResult(g);
    let wldHtml = '';
    if (result) {
      const wc = wldColor(result);
      wldHtml = `<span class="wld-pill" style="color:${wc};border-color:${wc}">${result}</span>`;
    }
    if (g.exhibition) {
      wldHtml = `<span class="wld-pill" style="color:var(--fg2);border-color:var(--border)">SCR</span>`;
    }
    const detailParts = [`${g.availablePlayers.length} players`];
    if (scoreStr) detailParts.push(scoreStr);
    listHtml += `
      <button class="game-picker-row${activeClass}" onclick="viewPastGame('${gidEsc}')">
        <div style="flex:1;min-width:0;text-align:left">
          <div style="font-weight:600;font-size:14px">${g.date}${gnLabel}${gLabel}</div>
          <div class="text-sm text-muted">${detailParts.join(' \u2022 ')}</div>
        </div>
        ${wldHtml}
        ${isCurrent ? '<span style="color:var(--accent);font-size:12px;font-weight:600;flex-shrink:0">Current</span>' : ''}
      </button>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'gamePickerModal';
  overlay.onclick = (e) => { if (e.target === overlay) closeDynamicModal('gamePickerModal'); };
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-label="Game Picker" aria-modal="true">
      <h2><span>Games</span><button class="close-btn" onclick="closeDynamicModal('gamePickerModal')" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></h2>
      <div class="game-picker-list">${listHtml}</div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// -- Donate Menu ----------------------------------------------------
function toggleDonateMenu() {
  const existing = document.getElementById('donateMenu');
  if (existing) { closeDonateMenu(); return; }

  const backdrop = document.createElement('div');
  backdrop.className = 'share-menu-backdrop';
  backdrop.id = 'donateMenuBackdrop';
  backdrop.onclick = closeDonateMenu;
  document.body.appendChild(backdrop);

  const menu = document.createElement('div');
  menu.className = 'donate-menu';
  menu.id = 'donateMenu';
  menu.innerHTML = `
    <a class="donate-menu-item" href="https://paypal.me/scottg06/" target="_blank" rel="noopener" onclick="closeDonateMenu()">PayPal</a>
    <a class="donate-menu-item" href="https://venmo.com/u/Scott-Greenwood-06" target="_blank" rel="noopener" onclick="closeDonateMenu()">Venmo</a>
  `;

  const wrap = document.getElementById('donateWrap');
  if (wrap) wrap.appendChild(menu);
  else document.body.appendChild(menu);
}

function closeDonateMenu() {
  document.getElementById('donateMenu')?.remove();
  document.getElementById('donateMenuBackdrop')?.remove();
}

// -- Header Menu (⋮) -----------------------------------------------
function toggleHeaderMenu() {
  const existing = document.getElementById('headerMenu');
  if (existing) { closeHeaderMenu(); return; }

  const backdrop = document.createElement('div');
  backdrop.className = 'share-menu-backdrop';
  backdrop.id = 'headerMenuBackdrop';
  backdrop.onclick = closeHeaderMenu;
  document.body.appendChild(backdrop);

  const hasTeams = Storage.loadTeams().length > 0;

  const unsaved = hasUnsavedChanges();
  const backupDot = unsaved ? '<span class="backup-dot-inline"></span>' : '';

  const menu = document.createElement('div');
  menu.className = 'header-menu';
  menu.id = 'headerMenu';
  menu.innerHTML = `
    <div class="header-menu-label">Backup</div>
    <button class="header-menu-item" onclick="closeHeaderMenu();openBackupModal()">Back Up${backupDot}</button>
    <button class="header-menu-item" onclick="closeHeaderMenu();openRestoreModal()">Restore</button>
    <div class="header-menu-divider"></div>
    <div class="header-menu-label">Share</div>
    <button class="header-menu-item" ${hasTeams ? '' : 'disabled style="opacity:0.3"'} onclick="closeHeaderMenu();openShareTeamModal()">Share Team</button>
    <button class="header-menu-item" onclick="closeHeaderMenu();importTeamFromFile()">Import Team</button>
    <div class="header-menu-divider"></div>
    <button class="header-menu-item" onclick="closeHeaderMenu();openSettings()">Settings</button>
    <button class="header-menu-item" onclick="closeHeaderMenu();openAbout()">About</button>
  `;

  document.getElementById('headerMenuWrap').appendChild(menu);
}

function closeHeaderMenu() {
  document.getElementById('headerMenu')?.remove();
  document.getElementById('headerMenuBackdrop')?.remove();
}

// -- Backup & Restore -----------------------------------------------

function openBackupModal() {
  backUpData();
}

function openRestoreModal() {
  restoreFromLocalFile();
}

function closeDynamicModal(id) {
  document.getElementById(id)?.remove();
}

/**
 * Show a custom confirm/alert modal (replaces native confirm() and alert()).
 * @param {object} opts
 * @param {string} opts.title        — Modal heading
 * @param {string} opts.message      — Body text (supports \n via white-space: pre-line)
 * @param {string} [opts.confirmLabel='OK']   — Primary button text
 * @param {string|null} [opts.cancelLabel='Cancel'] — Secondary button text; null = alert-style (no cancel)
 * @param {boolean} [opts.destructive=false]  — If true, confirm button is red (btn-danger)
 * @param {function} [opts.onConfirm]         — Called when confirm button is tapped
 */
function showModal({ title, message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false, onConfirm }) {
  // Remove any existing custom modal
  closeCustomModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'customModal';

  const btnClass = destructive ? 'btn btn-danger' : 'btn btn-primary';

  let buttonsHtml = '';
  if (cancelLabel !== null) {
    buttonsHtml += `<button class="btn btn-outline" id="customModalCancel">${esc(cancelLabel)}</button>`;
  }
  buttonsHtml += `<button class="${btnClass}" id="customModalConfirm">${esc(confirmLabel)}</button>`;

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="customModalTitle" aria-modal="true">
      <h2 id="customModalTitle">${esc(title)}</h2>
      <div class="modal-message">${esc(message)}</div>
      <div class="modal-actions">${buttonsHtml}</div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Event handlers
  const confirmBtn = document.getElementById('customModalConfirm');
  const cancelBtn = document.getElementById('customModalCancel');

  confirmBtn.addEventListener('click', () => {
    closeCustomModal();
    if (onConfirm) onConfirm();
  });

  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => closeCustomModal());
  }

  // Backdrop click dismisses
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCustomModal();
  });

  // Focus the confirm button
  setTimeout(() => confirmBtn.focus(), 50);
}

function closeCustomModal() {
  document.getElementById('customModal')?.remove();
}

/**
 * Custom prompt modal — replaces native prompt() with themed bottom-sheet.
 * @param {Object} opts
 * @param {string} opts.title - Modal heading
 * @param {string} [opts.message] - Optional description text
 * @param {string} [opts.placeholder] - Input placeholder
 * @param {string} [opts.defaultValue] - Pre-filled input value
 * @param {string} [opts.confirmLabel='Save'] - Confirm button text
 * @param {Function} opts.onConfirm - Called with trimmed input value
 */
function showPromptModal({ title, message, placeholder = '', defaultValue = '', confirmLabel = 'Save', onConfirm }) {
  closeCustomModal();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'customModal';

  let messageHtml = message ? `<div class="modal-message">${esc(message)}</div>` : '';

  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-labelledby="customModalTitle" aria-modal="true">
      <h2 id="customModalTitle">${esc(title)}</h2>
      ${messageHtml}
      <div style="margin-bottom:16px">
        <input type="text" id="promptModalInput" placeholder="${esc(placeholder)}" value="${esc(defaultValue)}" autocomplete="off">
      </div>
      <div class="modal-actions">
        <button class="btn btn-outline" id="customModalCancel">Cancel</button>
        <button class="btn btn-primary" id="customModalConfirm">${esc(confirmLabel)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById('promptModalInput');
  const confirmBtn = document.getElementById('customModalConfirm');
  const cancelBtn = document.getElementById('customModalCancel');

  const doConfirm = () => {
    const val = input.value.trim();
    if (!val) return;
    closeCustomModal();
    if (onConfirm) onConfirm(val);
  };

  confirmBtn.addEventListener('click', doConfirm);
  cancelBtn.addEventListener('click', () => closeCustomModal());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); doConfirm(); }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeCustomModal();
  });

  setTimeout(() => { input.focus(); input.select(); }, 50);
}

async function shareOrDownload(blob, filename, toastMsg) {
  // Only attempt native share on mobile devices.
  // Desktop always downloads directly — avoids unexpected share dialogs.
  // Uses the Client Hints API (navigator.userAgentData.mobile) which is the
  // only reliable way to distinguish mobile from desktop in Chrome. Touch
  // detection (ontouchstart, maxTouchPoints) and CSS media queries (pointer:
  // coarse) all produce false positives on Windows desktops with certain
  // hardware/driver configurations.
  const isMobile = navigator.userAgentData
    ? navigator.userAgentData.mobile
    : /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Use .txt extension for broader share sheet compatibility on Android
    // (more apps register to receive .txt than .json)
    const shareFilename = filename.replace(/\.json$/, '.txt');
    const file = new File([blob], shareFilename, { type: 'text/plain' });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });

    if (canShare) {
      try {
        await navigator.share({ files: [file], title: shareFilename });
        if (toastMsg) showToast(toastMsg, 'success');
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false; // user cancelled
        // Share failed — fall through to download
      }
    }
  }
  // Desktop or share not supported — download directly
  downloadBlob(blob, filename);
  if (toastMsg) showToast(toastMsg, 'success');
  return true;
}

async function backUpData() {
  const data = Storage.exportAll();
  const teamCount = data.teams?.length || 0;
  if (teamCount === 0 && data.standalonePlays.length === 0) {
    showToast('No data to back up', 'error');
    return;
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const filename = `roster-rotation-backup-${new Date().toISOString().split('T')[0]}.json`;
  const success = await shareOrDownload(blob, filename, `Backed up ${teamCount} team${teamCount !== 1 ? 's' : ''}`);
  if (success) markBackupDone();
}

function restoreFromLocalFile() {
  const input = document.getElementById('fileImportInput');
  input.accept = '.json,.txt';
  input.onchange = handleRestoreFile;
  input.click();
}

function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (data.version !== 3 || !Array.isArray(data.teams)) {
        showToast('Not a valid backup file (expected v3 format)', 'error');
        return;
      }

      // Build preview
      const teamCount = data.teams.length;
      let seasonCount = 0;
      const teamNames = [];
      for (const t of data.teams) {
        teamNames.push(t.name);
        seasonCount += (t.seasons || []).length;
      }
      const standalonePlaysCount = (data.standalonePlays || []).length;
      const dateStr = data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'unknown date';

      let msg = `Restore backup from ${dateStr}?\n\n`;
      msg += `Contains: ${teamCount} team${teamCount !== 1 ? 's' : ''}, ${seasonCount} season${seasonCount !== 1 ? 's' : ''}`;
      if (standalonePlaysCount > 0) msg += `, ${standalonePlaysCount} standalone play${standalonePlaysCount !== 1 ? 's' : ''}`;
      if (teamNames.length > 0) msg += `\nTeams: ${teamNames.join(', ')}`;

      // Check for existing data
      const existingTeams = Storage.loadTeams();
      if (existingTeams.length > 0) {
        msg += `\n\nThis will REPLACE all current data (${existingTeams.length} team${existingTeams.length !== 1 ? 's' : ''}).`;
        msg += '\nA backup of your current data will be saved first.';
      }

      showModal({
        title: 'Restore Backup',
        message: msg,
        confirmLabel: 'Replace',
        destructive: true,
        onConfirm: () => {
          try {
            // Auto-backup before restore (safety net)
            if (existingTeams.length > 0) {
              const safetyBackup = Storage.exportAll();
              const safetyBlob = new Blob([JSON.stringify(safetyBackup, null, 2)], { type: 'application/json' });
              downloadBlob(safetyBlob, `roster-rotation-pre-restore-${new Date().toISOString().split('T')[0]}.json`);
            }

            // Perform restore
            const result = Storage.importBackup(data);

            // Reload app state
            teams = Storage.loadTeams();
            ctx = result.context;
            if (ctx) {
              loadContextData();
            } else {
              updateContextLabel();
              showWelcome();
            }
            showToast(`Restored ${teamCount} team${teamCount !== 1 ? 's' : ''}`, 'success');
          } catch (err) {
            showToast('Restore failed: ' + err.message, 'error');
          }
        }
      });

    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

// -- Share Team / Import Team ----------------------------------------

function openShareTeamModal() {
  teams = Storage.loadTeams();
  if (teams.length === 0) {
    showToast('No teams to share', 'error');
    return;
  }

  let chipHtml = '';
  for (const t of teams) {
    const icon = getSportIcon(t.slug, null);
    const isCurrent = ctx && ctx.teamSlug === t.slug;
    chipHtml += `<button class="data-action-btn" onclick="closeDynamicModal('shareTeamModal');shareTeamBySlug('${t.slug}')">
      <span class="data-action-text"><strong>${icon} ${esc(t.name)}</strong>${isCurrent ? '<span class="data-action-sub">Currently active</span>' : ''}</span>
    </button>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'shareTeamModal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-label="Share Team" aria-modal="true">
      <h2><span>Share Team</span><button class="close-btn" onclick="closeDynamicModal('shareTeamModal')" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></h2>
      <p style="color:var(--fg2);font-size:13px;margin-bottom:16px">Choose a team to export as a shareable file.</p>
      <div class="data-action-list">
        ${chipHtml}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function shareTeamBySlug(slug) {
  const data = Storage.exportTeam(slug);
  if (!data) { showToast('No team data to share', 'error'); return; }
  const team = data.teams[0];
  const seasonCount = team.seasons?.length || 0;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  shareOrDownload(blob, `${slug}.json`, `Shared ${team.name} (${seasonCount} season${seasonCount !== 1 ? 's' : ''})`);
}

function importTeamFromFile() {
  const input = document.getElementById('fileImportInput');
  input.accept = '.json,.txt';
  input.onchange = handleImportTeamFile;
  input.click();
}

function handleImportTeamFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);

      if (data.version !== 3 || !Array.isArray(data.teams) || data.teams.length !== 1) {
        showToast('Not a valid team file (expected v3 format with one team)', 'error');
        return;
      }

      const teamData = data.teams[0];
      const seasonCount = (teamData.seasons || []).length;
      const existing = Storage.loadTeams().find(t => t.slug === teamData.slug);

      let msg;
      if (existing) {
        msg = `Team "${teamData.name}" already exists.\n`;
        msg += `Replace it with the imported version?\n\n`;
        msg += `${seasonCount} season${seasonCount !== 1 ? 's' : ''} will be imported.\n`;
        msg += 'Your local data for this team will be overwritten.\nOther teams are not affected.';
      } else {
        msg = `Add team "${teamData.name}"?\n\n`;
        msg += `${seasonCount} season${seasonCount !== 1 ? 's' : ''} will be imported.`;
      }

      showModal({
        title: existing ? 'Replace Team' : 'Import Team',
        message: msg,
        confirmLabel: existing ? 'Replace' : 'Import',
        destructive: !!existing,
        onConfirm: () => {
          try {
            const result = Storage.importSharedTeam(data);

            // Switch to the imported team
            teams = Storage.loadTeams();
            const firstSeason = result.seasonSlugs[0];
            if (firstSeason) {
              ctx = { teamSlug: result.teamSlug, seasonSlug: firstSeason };
              Storage.saveContext(ctx);
              loadContextData();
            } else {
              updateContextLabel();
            }
            showToast(`${existing ? 'Replaced' : 'Added'}: ${teamData.name}`, 'success');
          } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
          }
        }
      });

    } catch (err) {
      showToast('Import failed: ' + err.message, 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// -- Utilities ------------------------------------------------------

/** Generates the empty-state HTML for tabs when no team is selected. */
function welcomeEmptyState(message) {
  return `<p>${message}</p><button class="btn btn-outline" style="margin-top:12px" onclick="openContextPicker()">Select Team</button>`;
}

/** Pulse a form field red to indicate invalid input. */
function pulseInvalid(el) {
  if (!el) return;
  el.classList.remove("field-invalid");
  void el.offsetWidth; /* force reflow */
  el.classList.add("field-invalid");
  el.focus();
  setTimeout(() => el.classList.remove("field-invalid"), 600);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function showToast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// -- About Modal ---------------------------------------------------
function openAbout() {
  document.getElementById('aboutModal').classList.remove('hidden');
}
function closeAbout() {
  document.getElementById('aboutModal').classList.add('hidden');
}

// -- Settings Modal ------------------------------------------------

function loadSettings() {
  const raw = localStorage.getItem('rot_settings');
  const defaults = {
    theme: 'dark',
    colorblind: false,
    defaultPeriods: 4,
    defaultStarterMode: true,
    defaultSport: 'soccer',
    defaultFormat: '7v7',
    defaultContinuity: 0,
    defaultGlobalMaxPeriods: null,
    defaultPeriodDuration: 720,
  };
  if (!raw) return defaults;
  try { return { ...defaults, ...JSON.parse(raw) }; }
  catch { return defaults; }
}

function saveSettings(settings) {
  localStorage.setItem('rot_settings', JSON.stringify(settings));
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (!html || !html.classList) return;
  html.classList.remove('theme-light');

  if (theme === 'light') {
    html.classList.add('theme-light');
  } else if (theme === 'system') {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      html.classList.add('theme-light');
    }
  }
  // Update meta theme-color for browser chrome
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = html.classList.contains('theme-light') ? '#f5f7fa' : '#0f1923';
  }
}

function openSettings() {
  const settings = loadSettings();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'settingsModal';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-label="Settings" aria-modal="true">
      <h2><span>Settings</span><button class="close-btn" onclick="closeSettings()" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button></h2>

      <div class="settings-section">
        <div class="settings-section-title">Appearance</div>
        <div class="settings-row">
          <span class="settings-label">Theme</span>
          <div class="tri-toggle" id="settingsThemeToggle">
            <button class="tri-opt${settings.theme === 'dark' ? ' active' : ''}" onclick="setTheme('dark')">Dark</button>
            <button class="tri-opt${settings.theme === 'light' ? ' active' : ''}" onclick="setTheme('light')">Light</button>
            <button class="tri-opt${settings.theme === 'system' ? ' active' : ''}" onclick="setTheme('system')">System</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Colorblind mode</span>
          <div class="toggle${settings.colorblind ? ' on' : ''}" id="settingsColorblindToggle" onclick="toggleColorblind()" role="switch" aria-checked="${settings.colorblind}" aria-label="Colorblind mode"></div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title" style="display:flex;justify-content:space-between;align-items:center">
          <span>Game Structure</span>
          <button class="btn-ghost" style="font-size:11px;padding:2px 6px;text-transform:none;letter-spacing:0" onclick="resetGameDayDefaults()">Reset</button>
        </div>
        <div class="settings-row">
          <span class="settings-label">Default sport</span>
          <select id="settingsDefaultSport" onchange="setDefaultSport(this.value)">
            ${Object.entries(SPORTS).filter(([k]) => k !== 'custom').map(([key, s]) =>
              `<option value="${key}"${settings.defaultSport === key ? ' selected' : ''}>${s.icon} ${s.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="settings-row">
          <span class="settings-label">Field format</span>
          <select id="settingsDefaultFormat" onchange="setDefaultFormat(this.value)">
            ${(SPORTS[settings.defaultSport] || SPORTS.soccer).formats.map(f =>
              `<option value="${f.key}"${settings.defaultFormat === f.key ? ' selected' : ''}>${f.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="settings-row">
          <span class="settings-label">Game format</span>
          <select id="settingsDefaultPeriods" onchange="setDefaultPeriods(this.value)">
            <option value="4"${settings.defaultPeriods === 4 ? ' selected' : ''}>4 Quarters</option>
            <option value="3"${settings.defaultPeriods === 3 ? ' selected' : ''}>3 Periods</option>
            <option value="2"${settings.defaultPeriods === 2 ? ' selected' : ''}>2 Halves</option>
            <option value="1"${settings.defaultPeriods === 1 ? ' selected' : ''}>1 Game</option>
          </select>
        </div>
        <div class="settings-row">
          <span class="settings-label">Segment length</span>
          <div class="dur-compact">
            <input type="number" id="settingsDurMin" value="${Math.floor((settings.defaultPeriodDuration || 720) / 60)}" min="0" max="99" inputmode="numeric" class="dur-num-sm" onchange="saveSettingsDuration()">
            <span>:</span>
            <input type="number" id="settingsDurSec" value="${String((settings.defaultPeriodDuration || 720) % 60).padStart(2,'0')}" min="0" max="59" inputmode="numeric" class="dur-num-sm" onchange="saveSettingsDuration()">
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Starter mode default</span>
          <div class="toggle${settings.defaultStarterMode ? ' on' : ''}" id="settingsStarterToggle" onclick="toggleDefaultStarterMode()" role="switch" aria-checked="${settings.defaultStarterMode}" aria-label="Default starter mode"></div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Position stickiness</span>
          <div class="tri-toggle" id="settingsContinuityToggle">
            <button class="tri-opt${settings.defaultContinuity === 0 ? ' active' : ''}" onclick="setDefaultContinuity(0)">Off</button>
            <button class="tri-opt${settings.defaultContinuity === 1 ? ' active' : ''}" onclick="setDefaultContinuity(1)">Med</button>
            <button class="tri-opt${settings.defaultContinuity === 2 ? ' active' : ''}" onclick="setDefaultContinuity(2)">High</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Max segments / player</span>
          <select id="settingsGlobalMaxPeriods" onchange="setDefaultGlobalMaxPeriods(this.value)">
            <option value=""${!settings.defaultGlobalMaxPeriods ? ' selected' : ''}>No Limit</option>
            ${Array.from({ length: Math.max(1, settings.defaultPeriods - 1) }, (_, i) => i + 1).map(v =>
              `<option value="${v}"${settings.defaultGlobalMaxPeriods === v ? ' selected' : ''}>${v}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Tracking & Clock</div>
        <div class="settings-row">
          <span class="settings-label">Sub tracking</span>
          <div class="tri-toggle" id="settingsTrackingToggle">
            <button class="tri-opt${(settings.defaultTrackingMode || 'simple') === 'simple' ? ' active' : ''}" onclick="setDefaultTrackingMode('simple')">Simple</button>
            <button class="tri-opt${settings.defaultTrackingMode === 'coarse' ? ' active' : ''}" onclick="setDefaultTrackingMode('coarse')">Coarse</button>
            <button class="tri-opt${settings.defaultTrackingMode === 'fine' ? ' active' : ''}" onclick="setDefaultTrackingMode('fine')">Fine</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Clock direction</span>
          <div class="tri-toggle">
            <button class="tri-opt${(settings.defaultClockDirection || 'down') === 'down' ? ' active' : ''}" onclick="setDefaultClockDirection('down')">↓ Down</button>
            <button class="tri-opt${settings.defaultClockDirection === 'up' ? ' active' : ''}" onclick="setDefaultClockDirection('up')">↑ Up</button>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Help</div>
        <div class="settings-row">
          <span class="settings-label">Tab hints</span>
          <button class="btn btn-sm btn-outline" onclick="resetAllHints()">Show Again</button>
        </div>
        <div class="settings-row">
          <span class="settings-label">Dismiss all hints</span>
          <button class="btn btn-sm btn-outline" onclick="dismissAllHints()">Dismiss All</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Links</div>
        <div class="settings-row">
          <span class="settings-label">Source code</span>
          <a href="https://github.com/greenwoodms06/roster-rotation" target="_blank" rel="noopener" class="settings-link" onclick="closeSettings()">GitHub <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
        </div>
        <div class="settings-row">
          <span class="settings-label">Privacy policy</span>
          <a href="privacy.html" target="_blank" rel="noopener" class="settings-link" onclick="closeSettings()">View <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeSettings() {
  closeDynamicModal('settingsModal');
}

function setTheme(theme) {
  const settings = loadSettings();
  settings.theme = theme;
  saveSettings(settings);
  applyTheme(theme);

  // Update toggle UI
  const toggle = document.getElementById('settingsThemeToggle');
  if (toggle) {
    toggle.querySelectorAll('.tri-opt').forEach(btn => btn.classList.remove('active'));
    const labels = ['dark', 'light', 'system'];
    labels.forEach((l, i) => {
      if (l === theme) toggle.children[i].classList.add('active');
    });
  }
}

function toggleColorblind() {
  const settings = loadSettings();
  settings.colorblind = !settings.colorblind;
  saveSettings(settings);
  applyColorblind(settings.colorblind);
  const toggle = document.getElementById('settingsColorblindToggle');
  if (toggle) toggle.classList.toggle('on', settings.colorblind);
  // Re-render season charts if they're visible
  renderSeason();
}

function applyColorblind(enabled) {
  const html = document.documentElement;
  if (!html || !html.classList) return;
  if (enabled) {
    html.classList.add('colorblind');
  } else {
    html.classList.remove('colorblind');
  }
}

function setDefaultPeriods(val) {
  const settings = loadSettings();
  settings.defaultPeriods = parseInt(val);
  // If global max is now >= periods, reset it
  if (settings.defaultGlobalMaxPeriods != null && settings.defaultGlobalMaxPeriods >= settings.defaultPeriods) {
    settings.defaultGlobalMaxPeriods = null;
  }
  saveSettings(settings);
  // Refresh the max periods dropdown since options depend on period count
  const maxSel = document.getElementById('settingsGlobalMaxPeriods');
  if (maxSel) {
    let optHtml = `<option value=""${!settings.defaultGlobalMaxPeriods ? ' selected' : ''}>No Limit</option>`;
    for (let v = 1; v < settings.defaultPeriods; v++) {
      optHtml += `<option value="${v}"${settings.defaultGlobalMaxPeriods === v ? ' selected' : ''}>${v}</option>`;
    }
    maxSel.innerHTML = optHtml;
  }
}

function setDefaultSport(sportKey) {
  const settings = loadSettings();
  settings.defaultSport = sportKey;
  // Reset format to first available for this sport
  const sport = SPORTS[sportKey];
  settings.defaultFormat = sport ? sport.formats[0].key : '';
  saveSettings(settings);
  // Update format dropdown
  const formatSel = document.getElementById('settingsDefaultFormat');
  if (formatSel && sport) {
    formatSel.innerHTML = sport.formats.map(f =>
      `<option value="${f.key}"${settings.defaultFormat === f.key ? ' selected' : ''}>${f.name}</option>`
    ).join('');
  }
}

function setDefaultFormat(formatKey) {
  const settings = loadSettings();
  settings.defaultFormat = formatKey;
  saveSettings(settings);
}

function toggleDefaultStarterMode() {
  const settings = loadSettings();
  settings.defaultStarterMode = !settings.defaultStarterMode;
  saveSettings(settings);
  const toggle = document.getElementById('settingsStarterToggle');
  if (toggle) toggle.classList.toggle('on', settings.defaultStarterMode);
}

function setDefaultContinuity(val) {
  const settings = loadSettings();
  settings.defaultContinuity = val;
  saveSettings(settings);
  // Update toggle UI
  const toggle = document.getElementById('settingsContinuityToggle');
  if (toggle) {
    toggle.querySelectorAll('.tri-opt').forEach((btn, i) => {
      btn.classList.toggle('active', i === val);
    });
  }
}

function setDefaultGlobalMaxPeriods(val) {
  const settings = loadSettings();
  settings.defaultGlobalMaxPeriods = val === '' ? null : parseInt(val);
  saveSettings(settings);
}

function setDefaultTrackingMode(mode) {
  const settings = loadSettings();
  settings.defaultTrackingMode = mode;
  saveSettings(settings);
  const toggle = document.getElementById('settingsTrackingToggle');
  if (toggle) {
    toggle.querySelectorAll('.tri-opt').forEach((btn, i) => {
      btn.classList.toggle('active', ['simple','coarse','fine'][i] === mode);
    });
  }
}

function saveSettingsDuration() {
  const m = parseInt(document.getElementById('settingsDurMin')?.value) || 0;
  const s = parseInt(document.getElementById('settingsDurSec')?.value) || 0;
  const secs = m * 60 + s;
  if (secs > 0) {
    const settings = loadSettings();
    settings.defaultPeriodDuration = secs;
    saveSettings(settings);
  }
}

function setDefaultClockDirection(dir) {
  const settings = loadSettings();
  settings.defaultClockDirection = dir;
  saveSettings(settings);
  closeDynamicModal('settingsModal');
  openSettings();
}

function resetGameDayDefaults() {
  const settings = loadSettings();
  settings.defaultPeriods = 4;
  settings.defaultStarterMode = true;
  settings.defaultSport = 'soccer';
  settings.defaultFormat = '7v7';
  settings.defaultContinuity = 0;
  settings.defaultGlobalMaxPeriods = null;
  settings.defaultTrackingMode = 'simple';
  settings.defaultPeriodDuration = 720;
  settings.defaultClockDirection = 'down';
  saveSettings(settings);
  closeDynamicModal('settingsModal');
  openSettings();
  showToast('Defaults reset', 'success');
}

function resetAllHints() {
  for (const tab of Object.keys(TAB_HINTS)) {
    localStorage.removeItem('rot_hint_' + tab);
  }
  // Remove any currently visible hints so they re-show on next tab switch
  document.querySelectorAll('.tab-hint').forEach(h => h.remove());
  showToast('Hints will show again', 'success');
}

function dismissAllHints() {
  for (const tab of Object.keys(TAB_HINTS)) {
    localStorage.setItem('rot_hint_' + tab, '1');
  }
  document.querySelectorAll('.tab-hint').forEach(h => h.remove());
  showToast('All hints dismissed', 'success');
}

// -- Modal Accessibility -----------------------------------------------

/** Global Escape key handler — closes the topmost open modal. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Close in reverse stacking order — custom confirm modal is topmost
  if (document.getElementById('customModal')) { closeCustomModal(); return; }

  // Tournament modal is dynamic
  const tournament = document.getElementById('tournamentModal');
  if (tournament) { closeTournamentModal(); return; }

  // Close dynamic data modals
  for (const id of ['editRosterModal', 'gamePickerModal', 'settingsModal', 'shareTeamModal']) {
    if (document.getElementById(id)) { closeDynamicModal(id); return; }
  }

  // Close header/donate menus first
  if (document.getElementById('donateMenu')) { closeDonateMenu(); return; }
  if (document.getElementById('headerMenu')) { closeHeaderMenu(); return; }

  // Then static modals (check topmost first)
  const modals = [
    { id: 'aboutModal', close: closeAbout },
    { id: 'seasonModal', close: closeSeasonModal },
    { id: 'teamModal', close: closeTeamModal },
    { id: 'playerModal', close: closePlayerModal },
    { id: 'contextModal', close: closeContextPicker },
  ];
  for (const m of modals) {
    const el = document.getElementById(m.id);
    if (el && !el.classList.contains('hidden')) {
      m.close();
      return;
    }
  }
});

/** Focus trap: keeps Tab cycling within the visible modal. */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;

  // Find the topmost visible modal overlay
  const overlays = document.querySelectorAll('.modal-overlay:not(.hidden)');
  if (overlays.length === 0) return;
  const overlay = overlays[overlays.length - 1];
  const modal = overlay.querySelector('.modal');
  if (!modal) return;

  const focusable = modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first || !modal.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last || !modal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
});

// -- PWA Registration -----------------------------------------------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    // SW already waiting from a previous visit
    if (reg.waiting) {
      showUpdateBanner(reg.waiting);
    }
    // Check for updates on load
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        // New SW installed and waiting — show update banner
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(newSW);
        }
      });
    });

    // Re-check when user returns to the app (tab/app switch)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update();
    });

    // Periodic check every 60 minutes
    setInterval(() => reg.update(), 60 * 60 * 1000);
  }).catch(() => {});

  // Reload when new SW takes over
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

function showUpdateBanner(waitingSW) {
  // Don't show duplicate
  if (document.getElementById('updateBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.className = 'update-banner';
  banner.innerHTML = `
    <div class="update-banner-text">
      <strong>Update available</strong>
      <span>Back up your data first, then tap Update.</span>
    </div>
    <div class="update-banner-actions">
      <button class="btn btn-sm btn-outline" onclick="closeUpdateBanner()">Later</button>
      <button class="btn btn-sm btn-primary" onclick="applyUpdate()">Update</button>
    </div>
  `;
  document.body.appendChild(banner);

  // Store reference to waiting SW
  window._waitingSW = waitingSW;
}

function closeUpdateBanner() {
  document.getElementById('updateBanner')?.remove();
}

function applyUpdate() {
  if (window._waitingSW) {
    window._waitingSW.postMessage({ type: 'SKIP_WAITING' });
  }
  closeUpdateBanner();
}

// -- PWA Install Prompt ------------------------------------------------
let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _deferredInstallPrompt = e;

  // Only show once per session — check sessionStorage
  if (sessionStorage.getItem('rot_installDismissed')) return;

  // Delay slightly so it doesn't compete with page load
  setTimeout(() => showInstallBanner(), 2000);
});

window.addEventListener('appinstalled', () => {
  _deferredInstallPrompt = null;
  closeInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById('installBanner')) return;
  if (!_deferredInstallPrompt) return;

  const banner = document.createElement('div');
  banner.id = 'installBanner';
  banner.className = 'install-banner';
  banner.innerHTML = `
    <div class="install-banner-text">
      <strong>Install Rotations</strong>
      <span>Add to your home screen for the best experience.</span>
    </div>
    <div class="install-banner-actions">
      <button class="btn btn-sm btn-outline" onclick="dismissInstallBanner()">Later</button>
      <button class="btn btn-sm btn-primary" onclick="acceptInstallPrompt()">Install</button>
    </div>
  `;
  document.body.appendChild(banner);
}

function dismissInstallBanner() {
  sessionStorage.setItem('rot_installDismissed', '1');
  closeInstallBanner();
}

function closeInstallBanner() {
  document.getElementById('installBanner')?.remove();
}

async function acceptInstallPrompt() {
  if (!_deferredInstallPrompt) return;
  closeInstallBanner();
  _deferredInstallPrompt.prompt();
  const { outcome } = await _deferredInstallPrompt.userChoice;
  _deferredInstallPrompt = null;
  if (outcome === 'accepted') {
    showToast('App installed', 'success');
  }
}

// -- Keyboard-vs-Modal Handler (iOS Safari + Android Chrome) ----------------
// Only active on touch devices (coarse pointer) that have virtual keyboards.
// Desktop browsers skip this entirely — no virtual keyboard, no resize needed.
//
// Strategy: When keyboard opens, shrink the MODAL (not the overlay) so it fits
// above the keyboard. The overlay stays full-screen with align-items:flex-end,
// keeping the modal anchored to the bottom of the screen — right above the keyboard.
//
//   Android Chrome: visualViewport.height shrinks with overlays-content → exact sizing.
//   iOS Safari: visualViewport does NOT shrink → focusin heuristic (~55% of screen).

const _hasTouchKb = window.matchMedia('(pointer: coarse)').matches;

let _kbActiveModal = null;   // .modal element currently adjusted for keyboard
let _kbUsedVV = false;       // whether visualViewport gave us real dimensions

function _kbResetAllModals() {
  document.querySelectorAll('.modal-overlay .modal').forEach(m => {
    m.style.maxHeight = '';
    m.style.marginBottom = '';
  });
  _kbActiveModal = null;
  _kbUsedVV = false;
}

if (_hasTouchKb) {
  document.addEventListener('focusin', (e) => {
    const el = e.target;
    if (!el) return;
    const overlay = el.closest('.modal-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
    // Numeric keypads are small — don't resize the modal for them
    if (el.type === 'number' || el.inputMode === 'numeric') return;

    const modal = overlay.querySelector('.modal');
    if (!modal) return;
    _kbActiveModal = modal;
    _kbUsedVV = false;

    // Heuristic: assume keyboard is ~45% of screen. Set modal max-height
    // to fit above it and margin-bottom to push it above the keyboard.
    // On Android this is quickly overridden by visualViewport with exact dims.
    const kbGuess = window.innerHeight * 0.45;
    const safeHeight = window.innerHeight - kbGuess;
    modal.style.maxHeight = safeHeight + 'px';
    modal.style.marginBottom = kbGuess + 'px';

    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 300);
  });

  document.addEventListener('focusout', (e) => {
    // Delay: focusout fires before focusin when tapping between inputs.
    setTimeout(() => {
      const focused = document.activeElement;
      const stillInModal = focused && focused.closest('.modal-overlay') &&
        (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT');
      if (!stillInModal) {
        _kbResetAllModals();
      }
    }, 150);
  });

  // Precise sizing via visualViewport (works on Android Chrome; no-ops on iOS
  // because visualViewport.height stays constant with overlays-content).
  if (window.visualViewport) {
    let _kbRafId = null;
    const refineForKeyboard = () => {
      _kbRafId = null;
      const vv = window.visualViewport;
      const kbHeight = window.innerHeight - vv.height;

      // If no active modal tracked, try to find one from the focused element
      if (!_kbActiveModal && kbHeight > 100) {
        const focused = document.activeElement;
        if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA' || focused.tagName === 'SELECT')) {
          if (focused.type !== 'number' && focused.inputMode !== 'numeric') {
            const overlay = focused.closest('.modal-overlay');
            if (overlay && !overlay.classList.contains('hidden')) {
              _kbActiveModal = overlay.querySelector('.modal');
            }
          }
        }
      }

      if (!_kbActiveModal) return;

      if (kbHeight > 100) {
        _kbUsedVV = true;
        _kbActiveModal.style.maxHeight = (vv.height - 20) + 'px';
        _kbActiveModal.style.marginBottom = kbHeight + 'px';
        const focused = document.activeElement;
        if (focused && focused.closest('.modal')) {
          focused.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      } else if (kbHeight < 50) {
        // Keyboard closed (input may still have focus — Android dismiss button)
        _kbResetAllModals();
      }
    };
    const scheduleRefine = () => {
      if (_kbRafId) return;
      _kbRafId = requestAnimationFrame(refineForKeyboard);
    };
    window.visualViewport.addEventListener('resize', scheduleRefine);
    window.visualViewport.addEventListener('scroll', scheduleRefine);
  }
}

// -- Boot -----------------------------------------------------------
init();
