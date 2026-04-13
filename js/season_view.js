/**
 * season_view.js — Season tab: overview, games list, players table.
 * Uses globals from app.js (ctx, roster, currentPlan, seasonSubTab).
 * Calls renderLineup, closeDynamicModal, and others defined in app.js.
 */

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
