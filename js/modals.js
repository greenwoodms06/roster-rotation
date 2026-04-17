/**
 * modals.js — Custom modal/prompt helpers + About, Help, Settings.
 * Reads/writes globals from app.js (TAB_HINTS, ctx, currentPlan, etc.).
 */

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

// -- About Modal ---------------------------------------------------
// -- Help Modal -----------------------------------------------------

const HELP_SECTIONS = [
  { title: 'Getting Started', items: [
    { title: 'Create a Team & Season', desc: 'Tap the header label (e.g. "No team") to open the context picker. Create a team, then a season. Each season has its own roster, positions, and game history.' },
    { title: 'Players per Side', desc: 'When creating a season, pick the sport and use the <strong>Players per side</strong> stepper (e.g. 7v7, 5v5, 11v11). The positions field auto-fills from the sport. Edit positions directly to override, or step up to sizes beyond a preset to extend the list.' },
    { title: 'Add Players', desc: 'On the <strong>Roster</strong> tab, tap <strong>+ Add</strong> to add players. You need at least as many players as positions to generate a lineup.' },
    { title: 'Position Preferences', desc: 'Tap any player on the Roster to set position weights. Cycle through: Normal, Prefer, Strong Prefer, Never. The engine uses these to bias assignments while keeping things fair.' },
  ]},
  { title: 'Game Day', items: [
    { title: 'Select Available Players', desc: 'Tap players from the Roster column to move them to Available. Drag to reorder — order determines starters (if enabled).' },
    { title: 'Game Format', desc: 'Use the <strong>+ / −</strong> stepper to pick any number of segments. Labels auto-derive: 4 = Quarters, 2 = Halves, 1 = Game, anything else = Periods. The engine divides playing time across these segments.' },
    { title: 'Generate Lineup', desc: 'Tap <strong>Generate Lineup</strong> to create a fair rotation. The engine balances equal playing time, season fairness, and position exposure. You land on the Lineup tab.' },
    { title: 'Constraints (optional)', desc: 'Expand the Constraints panel to fine-tune generation. <strong>Position stickiness</strong> reduces mid-game position changes. <strong>Max periods</strong> caps how many periods any player plays (hard cap) — if you later add a period and every player is at the cap, the app offers to raise it by 1. <strong>Max subs / break</strong> limits roster changes between periods (useful for large rosters); it auto-relaxes if hitting it would force anyone past the Max Periods cap or push a player into a long consecutive-play streak. Tap a player name to <strong>lock</strong> them to a position.' },
    { title: 'Re-generating', desc: 'You can go back to Game Day at any time to adjust who is available, change the format, or tweak constraints, then re-generate. This replaces the current lineup for that date. To add a second game on the same date (e.g. a tournament), the app will ask whether to add or replace.' },
  ]},
  { title: 'Lineup', items: [
    { title: 'Swapping Players', desc: 'Tap two players in the same period to open the swap popup. <strong>Swap</strong> trades their positions instantly. Pick a fraction (¼, ½, etc.) or use <strong>Exact</strong> mode to record exactly when the sub happened. Then tap <strong>Confirm</strong>.' },
    { title: 'Reset to Full Period', desc: 'In the swap popup, the <strong>Reset to full period</strong> link at the bottom wipes sub history for that slot — the selected player gets credit for the entire period. Useful for correcting mistakes.' },
    { title: 'Goal Tracking', desc: 'Use the <strong>+/−</strong> buttons on each player row to track who scored. Opponent goals are tracked per period in the period headers.' },
    { title: 'Game Clock', desc: 'The clock row shows elapsed or remaining time. Tap <strong>▶</strong> to start, <strong>⏸</strong> to pause, <strong>↺</strong> to reset. Tap the duration to change period length. The <strong>↑/↓</strong> button toggles count direction.' },
    { title: 'Edit Lineup', desc: 'Tap <strong>Edit Lineup</strong> to add a late arrival or remove a player mid-game (injury or early departure). The engine rebalances automatically from that point forward.' },
    { title: 'Rebalance', desc: 'The refresh icon on each period header (except the first) re-optimizes the lineup from that period onward, keeping earlier periods frozen.' },
    { title: 'Add a Period', desc: 'Tap <strong>+ Add Quarter</strong> (or Period / Half) at the bottom of the lineup to extend the game. Existing periods stay frozen; the new one is generated fairly against that history. Useful for overtime, extra drills, or format changes.' },
    { title: 'Remove a Period', desc: 'Tap the trash icon on any period card. A modal offers four options: <strong>Rebalance All</strong> (regenerates every remaining period), <strong>Rebalance After</strong> (freezes earlier periods, regenerates the tail), <strong>Remove Only</strong> (deletes with no regeneration), or Cancel. Each option shows inline which goals will be cleared.' },
    { title: 'Timeline Bars', desc: 'Colored bars on each player row show how long they played each position during that period. Tap a bar for a detailed breakdown popup with per-period stats.' },
    { title: 'Scrimmage', desc: 'Check <strong>Scrimmage</strong> to exclude a game from season stats. Useful for practice games.' },
    { title: 'Game Notes', desc: 'Tap the notes area below the clock to add free-text notes for the game. Notes are saved automatically.' },
  ]},
  { title: 'Season', items: [
    { title: 'Overview', desc: 'Games played, win-loss-draw record, roster size, average availability, goals for/against, goal differential, shutouts, and a playing time chart.' },
    { title: 'Games', desc: 'Game history with scores, availability dots, W/L/D letters, and fairness badges. Tap a game to jump to its lineup.' },
    { title: 'Players', desc: 'Per-player stats table with games played, total playing time, position distribution, and goals chart.' },
  ]},
  { title: 'Field', items: [
    { title: 'Formation View', desc: 'See your players on a field diagram. Drag position dots to arrange formations. Works standalone (no team needed) or synced with a game lineup.' },
    { title: 'Routes & Zones', desc: 'Use the <strong>pencil</strong> to draw routes between positions. Use the <strong>box</strong> tool to draw shaded zones with a 4-color palette. Tap a route or zone to select and delete it.' },
    { title: 'Saved Plays', desc: 'Create and name plays for quick reuse. Each play saves dot positions, routes, and zones.' },
    { title: 'Defense Overlay', desc: 'Toggle <strong>DEF</strong> to add opponent position markers on the field. Drag to position them.' },
  ]},
  { title: 'Data & Backup', items: [
    { title: 'All Data is Local', desc: 'Everything is stored on your device. Nothing is sent to any server. Back up regularly to avoid data loss.' },
    { title: 'Back Up & Restore', desc: 'Use the <strong>⋮</strong> menu to back up all data as a file, or restore from a previous backup. A safety backup is auto-created before restoring.' },
    { title: 'Share & Import Team', desc: 'Export a single team to share with another coach, or import a shared team file.' },
    { title: 'Multi-Team & Multi-Season', desc: 'Tap the header label to switch between teams, seasons, or field-only mode. Each team/season has independent data. You can copy a roster when creating a new season.' },
  ]},
];

function openHelp() {
  closeDynamicModal('helpModal');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'helpModal';

  let sectionsHtml = '';
  for (const section of HELP_SECTIONS) {
    sectionsHtml += `<div class="help-section" data-section="${esc(section.title)}">`;
    sectionsHtml += `<div class="help-section-title">${esc(section.title)}</div>`;
    for (const item of section.items) {
      sectionsHtml += `<div class="help-item"><div class="help-item-title">${esc(item.title)}</div><div class="help-item-desc">${item.desc}</div></div>`;
    }
    sectionsHtml += '</div>';
  }

  overlay.innerHTML = `<div class="modal help-modal" role="dialog" aria-label="Help" aria-modal="true">
    <h2>
      <span>Help</span>
      <button class="close-btn" onclick="closeDynamicModal('helpModal')" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
    </h2>
    <input type="text" class="help-search" id="helpSearchInput" placeholder="Search help..." oninput="filterHelp()" autocomplete="off">
    <div class="help-body" id="helpBody">${sectionsHtml}</div>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDynamicModal('helpModal'); });
  document.body.appendChild(overlay);
  document.getElementById('helpSearchInput').focus();
}

function filterHelp() {
  const q = (document.getElementById('helpSearchInput')?.value || '').toLowerCase().trim();
  const body = document.getElementById('helpBody');
  if (!body) return;

  for (const section of body.querySelectorAll('.help-section')) {
    let sectionVisible = false;
    for (const item of section.querySelectorAll('.help-item')) {
      const title = item.querySelector('.help-item-title')?.textContent?.toLowerCase() || '';
      const desc = item.querySelector('.help-item-desc')?.textContent?.toLowerCase() || '';
      const match = !q || title.includes(q) || desc.includes(q);
      item.style.display = match ? '' : 'none';
      if (match) sectionVisible = true;
    }
    section.style.display = sectionVisible ? '' : 'none';
  }
}

function openAbout() {
  document.getElementById('aboutModal').classList.remove('hidden');
}
function closeAbout() {
  document.getElementById('aboutModal').classList.add('hidden');
}

// -- Settings Modal ------------------------------------------------

function loadSettings() {
  const raw = StorageAdapter.get('rot_settings');
  const defaults = {
    theme: 'dark',
    colorblind: false,
    defaultPeriods: 4,
    defaultStarterMode: true,
    defaultSport: 'soccer',
    defaultPlayerCount: 7,
    defaultContinuity: 0,
    defaultGlobalMaxPeriods: null,
    defaultMaxSubsPerBreak: null,
    defaultPositionMax: null,
    defaultPeriodDuration: 720,
  };
  if (!raw) return defaults;
  try {
    const parsed = { ...defaults, ...JSON.parse(raw) };
    // Migrate legacy defaultFormat ("7v7") → defaultPlayerCount (7)
    if (parsed.defaultFormat && !('defaultPlayerCount' in JSON.parse(raw))) {
      const m = String(parsed.defaultFormat).match(/^(\d+)v\d+$/);
      if (m) parsed.defaultPlayerCount = parseInt(m[1]);
    }
    delete parsed.defaultFormat;
    return parsed;
  }
  catch { return defaults; }
}

function saveSettings(settings) {
  StorageAdapter.set('rot_settings', JSON.stringify(settings));
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
          <span class="settings-label">Players per side</span>
          ${renderStepperHtml({
            minusFn: 'bumpSettingsDefaultPlayerCount(-1)',
            plusFn: 'bumpSettingsDefaultPlayerCount(1)',
            label: `${settings.defaultPlayerCount}v${settings.defaultPlayerCount}`,
            id: 'settingsDefaultPlayerCountLabel',
            minusDisabled: settings.defaultPlayerCount <= SEASON_COUNT_MIN,
            plusDisabled: settings.defaultPlayerCount >= SEASON_COUNT_MAX,
          })}
        </div>
        <div class="settings-row">
          <span class="settings-label">Game format</span>
          ${renderStepperHtml({
            minusFn: 'bumpSettingsDefaultPeriods(-1)',
            plusFn: 'bumpSettingsDefaultPeriods(1)',
            label: formatPeriodCount(settings.defaultPeriods),
            id: 'settingsDefaultPeriodsLabel',
            minusDisabled: settings.defaultPeriods <= 1,
            plusDisabled: settings.defaultPeriods >= 999,
          })}
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
          ${renderStepperHtml({
            minusFn: 'bumpSettingsGlobalMaxPeriods(-1)',
            plusFn: 'bumpSettingsGlobalMaxPeriods(1)',
            label: settings.defaultGlobalMaxPeriods == null ? 'Any' : String(settings.defaultGlobalMaxPeriods),
            id: 'settingsGlobalMaxPeriodsLabel',
            minusDisabled: settings.defaultGlobalMaxPeriods == null,
            plusDisabled: settings.defaultGlobalMaxPeriods != null && settings.defaultGlobalMaxPeriods >= settings.defaultPeriods - 1,
          })}
        </div>
        <div class="settings-row">
          <span class="settings-label">Max per position (all)</span>
          ${renderStepperHtml({
            minusFn: 'bumpSettingsPositionMax(-1)',
            plusFn: 'bumpSettingsPositionMax(1)',
            label: settings.defaultPositionMax == null ? 'Any' : String(settings.defaultPositionMax),
            id: 'settingsPositionMaxLabel',
            minusDisabled: settings.defaultPositionMax == null,
            plusDisabled: settings.defaultPositionMax != null && settings.defaultPositionMax >= settings.defaultPeriods - 1,
          })}
        </div>
        <div class="settings-row">
          <span class="settings-label">Max subs / break</span>
          ${renderStepperHtml({
            minusFn: 'bumpSettingsMaxSubsPerBreak(-1)',
            plusFn: 'bumpSettingsMaxSubsPerBreak(1)',
            label: settings.defaultMaxSubsPerBreak == null ? 'Any' : String(settings.defaultMaxSubsPerBreak),
            id: 'settingsMaxSubsPerBreakLabel',
            minusDisabled: settings.defaultMaxSubsPerBreak === 0,
            plusDisabled: settings.defaultMaxSubsPerBreak == null,
          })}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Tracking & Clock</div>
        <div class="settings-row">
          <span class="settings-label">Timing precision</span>
          <div class="tri-toggle" id="settingsTimingToggle">
            <button class="tri-opt${(settings.defaultTimingPrecision || 'approx') !== 'exact' ? ' active' : ''}" onclick="setDefaultTimingPrecision('approx')">Approx</button>
            <button class="tri-opt${settings.defaultTimingPrecision === 'exact' ? ' active' : ''}" onclick="setDefaultTimingPrecision('exact')">Exact</button>
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

function bumpSettingsDefaultPeriods(delta) {
  const settings = loadSettings();
  const cur = settings.defaultPeriods || 4;
  const next = Math.max(1, Math.min(999,cur + delta));
  if (next === cur) return;
  setDefaultPeriods(next);
  // Update the stepper label + disabled states in-place
  const labelEl = document.getElementById('settingsDefaultPeriodsLabel');
  if (labelEl) labelEl.textContent = formatPeriodCount(next);
  const wrap = labelEl?.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = next <= 1;
    if (plusBtn) plusBtn.disabled = next >= 999;
  }
}

function setDefaultPeriods(val) {
  const settings = loadSettings();
  settings.defaultPeriods = parseInt(val);
  // If max values are now >= periods, reset them (no effective limit)
  if (settings.defaultGlobalMaxPeriods != null && settings.defaultGlobalMaxPeriods >= settings.defaultPeriods) {
    settings.defaultGlobalMaxPeriods = null;
  }
  if (settings.defaultPositionMax != null && settings.defaultPositionMax >= settings.defaultPeriods) {
    settings.defaultPositionMax = null;
  }
  saveSettings(settings);
  updateMaxPerPlayerStepper(settings);
  updateMaxPerPositionStepper(settings);
}

function updateMaxPerPlayerStepper(settings) {
  const labelEl = document.getElementById('settingsGlobalMaxPeriodsLabel');
  if (!labelEl) return;
  labelEl.textContent = settings.defaultGlobalMaxPeriods == null ? 'Any' : String(settings.defaultGlobalMaxPeriods);
  const wrap = labelEl.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = settings.defaultGlobalMaxPeriods == null;
    if (plusBtn) plusBtn.disabled = settings.defaultGlobalMaxPeriods != null && settings.defaultGlobalMaxPeriods >= settings.defaultPeriods - 1;
  }
}

function updateMaxPerPositionStepper(settings) {
  const labelEl = document.getElementById('settingsPositionMaxLabel');
  if (!labelEl) return;
  labelEl.textContent = settings.defaultPositionMax == null ? 'Any' : String(settings.defaultPositionMax);
  const wrap = labelEl.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = settings.defaultPositionMax == null;
    if (plusBtn) plusBtn.disabled = settings.defaultPositionMax != null && settings.defaultPositionMax >= settings.defaultPeriods - 1;
  }
}

function bumpSettingsGlobalMaxPeriods(delta) {
  const settings = loadSettings();
  const maxVal = settings.defaultPeriods - 1;
  const cur = settings.defaultGlobalMaxPeriods;
  let next;
  if (cur == null) next = delta > 0 ? 1 : null;
  else {
    next = cur + delta;
    if (next < 1) next = null;
    else if (next > maxVal) next = maxVal;
  }
  settings.defaultGlobalMaxPeriods = next;
  saveSettings(settings);
  updateMaxPerPlayerStepper(settings);
}

function updateMaxSubsPerBreakStepper(settings) {
  const labelEl = document.getElementById('settingsMaxSubsPerBreakLabel');
  if (!labelEl) return;
  labelEl.textContent = settings.defaultMaxSubsPerBreak == null ? 'Any' : String(settings.defaultMaxSubsPerBreak);
  const wrap = labelEl.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = settings.defaultMaxSubsPerBreak === 0;
    if (plusBtn) plusBtn.disabled = settings.defaultMaxSubsPerBreak == null;
  }
}

function bumpSettingsMaxSubsPerBreak(delta) {
  const settings = loadSettings();
  const maxVal = (settings.defaultPlayerCount || 1) - 1;
  const cur = settings.defaultMaxSubsPerBreak;
  let next;
  if (cur == null) {
    next = delta < 0 ? maxVal : null;
  } else {
    next = cur + delta;
    if (next < 0) next = 0;
    else if (next > maxVal) next = null;
  }
  settings.defaultMaxSubsPerBreak = next;
  saveSettings(settings);
  updateMaxSubsPerBreakStepper(settings);
}

function bumpSettingsPositionMax(delta) {
  const settings = loadSettings();
  const maxVal = settings.defaultPeriods - 1;
  const cur = settings.defaultPositionMax;
  let next;
  if (cur == null) next = delta > 0 ? 1 : null;
  else {
    next = cur + delta;
    if (next < 1) next = null;
    else if (next > maxVal) next = maxVal;
  }
  settings.defaultPositionMax = next;
  saveSettings(settings);
  updateMaxPerPositionStepper(settings);
}

function setDefaultSport(sportKey) {
  const settings = loadSettings();
  settings.defaultSport = sportKey;
  // Reset player count to this sport's default
  const sport = SPORTS[sportKey];
  if (sport) settings.defaultPlayerCount = sport.defaultN;
  saveSettings(settings);
  // Refresh the player-count stepper label + disabled states in place
  const labelEl = document.getElementById('settingsDefaultPlayerCountLabel');
  if (labelEl) labelEl.textContent = `${settings.defaultPlayerCount}v${settings.defaultPlayerCount}`;
  const wrap = labelEl?.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = settings.defaultPlayerCount <= SEASON_COUNT_MIN;
    if (plusBtn) plusBtn.disabled = settings.defaultPlayerCount >= SEASON_COUNT_MAX;
  }
}

function bumpSettingsDefaultPlayerCount(delta) {
  const settings = loadSettings();
  const cur = settings.defaultPlayerCount || (SPORTS[settings.defaultSport]?.defaultN ?? 7);
  const next = Math.max(SEASON_COUNT_MIN, Math.min(SEASON_COUNT_MAX, cur + delta));
  if (next === cur) return;
  settings.defaultPlayerCount = next;
  saveSettings(settings);
  const labelEl = document.getElementById('settingsDefaultPlayerCountLabel');
  if (labelEl) labelEl.textContent = `${next}v${next}`;
  const wrap = labelEl?.parentElement;
  if (wrap) {
    const [minusBtn, , plusBtn] = wrap.children;
    if (minusBtn) minusBtn.disabled = next <= SEASON_COUNT_MIN;
    if (plusBtn) plusBtn.disabled = next >= SEASON_COUNT_MAX;
  }
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

function setDefaultTimingPrecision(mode) {
  const settings = loadSettings();
  settings.defaultTimingPrecision = mode;
  saveSettings(settings);
  const toggle = document.getElementById('settingsTimingToggle');
  if (toggle) {
    toggle.querySelectorAll('.tri-opt').forEach((btn, i) => {
      btn.classList.toggle('active', ['approx','exact'][i] === mode);
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
  settings.defaultPlayerCount = 7;
  settings.defaultContinuity = 0;
  settings.defaultGlobalMaxPeriods = null;
  settings.defaultMaxSubsPerBreak = null;
  settings.defaultPositionMax = null;
  settings.defaultTimingPrecision = 'approx';
  settings.defaultPeriodDuration = 720;
  settings.defaultClockDirection = 'down';
  saveSettings(settings);
  closeDynamicModal('settingsModal');
  openSettings();
  showToast('Defaults reset', 'success');
}

function resetAllHints() {
  for (const tab of Object.keys(TAB_HINTS)) {
    StorageAdapter.remove('rot_hint_' + tab);
  }
  // Remove any currently visible hints so they re-show on next tab switch
  document.querySelectorAll('.tab-hint').forEach(h => h.remove());
  showToast('Hints will show again', 'success');
}

function dismissAllHints() {
  for (const tab of Object.keys(TAB_HINTS)) {
    StorageAdapter.set('rot_hint_' + tab, '1');
  }
  document.querySelectorAll('.tab-hint').forEach(h => h.remove());
  showToast('All hints dismissed', 'success');
}
