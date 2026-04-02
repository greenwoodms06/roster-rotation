/**
 * field.js -- Field tab rendering, SVG field backgrounds, and drag handling
 * Requires: formations.js (FORMATIONS, POSITION_PRESETS, SPORT_ICONS, generateAutoLayout,
 *                          getSeasonPreset, matchPresetFromPositions)
 *           storage.js (Storage)
 *           app.js globals (ctx, roster, currentPlan, fieldPeriodIdx, fieldFormationIdx,
 *                          fieldDotPositions, fieldDragState, esc)
 */

// -- Field Tab State --------------------------------------------------
// (declared in app.js: fieldPeriodIdx, fieldFormationIdx, fieldDotPositions, fieldDragState)

/** Returns positions for standalone mode — generates P1..Pn for custom sport. */
function getStandalonePositions() {
  if (fieldStandalonePreset === 'custom') {
    return Array.from({ length: fieldCustomCount }, (_, i) => `P${i + 1}`);
  }
  return POSITION_PRESETS[fieldStandalonePreset] || [];
}

function getFieldFormations() {
  const preset = (ctx && roster) ? getSeasonPreset() : fieldStandalonePreset;
  const info = preset ? FORMATIONS[preset] : null;
  if (info) return info;
  const positions = roster
    ? roster.positions
    : getStandalonePositions();
  const fieldType = (fieldStandalonePreset === 'custom') ? fieldCustomFieldType : 'generic';
  return {
    fieldType,
    layouts: [{ name: 'Auto', coords: generateAutoLayout(positions) }]
  };
}

/** Returns the ctx to use for plays storage — falls back to standalone key when no team. */
function getPlaysCtx() {
  return ctx || { teamSlug: '__standalone__', seasonSlug: '__standalone__' };
}

/** Sport/format selector rendered only in standalone (no team) mode. */
function buildStandaloneSportSelectorHTML() {
  const parsed = parsePresetKey(fieldStandalonePreset);
  const currentSportKey = parsed.sport;
  const currentFormatKey = parsed.format;
  const currentSport = SPORTS[currentSportKey];

  let html = '<div class="standalone-sport-row">';

  // Sport dropdown
  html += '<select id="standaloneSportSelect" onchange="changeStandaloneSport(this.value)">';
  for (const [sportKey, sport] of Object.entries(SPORTS)) {
    if (sport.formats.length === 0) continue;
    const sel = sportKey === currentSportKey ? ' selected' : '';
    html += `<option value="${sportKey}"${sel}>${sport.icon} ${sport.name}</option>`;
  }
  html += '</select>';

  // Format dropdown (or field type selector for custom)
  if (currentSportKey === 'custom') {
    const fieldTypes = [
      { key: 'generic', label: 'Generic' },
      { key: 'soccer', label: '\u26BD Soccer' },
      { key: 'basketball', label: '\uD83C\uDFC0 Basketball' },
      { key: 'hockey', label: '\uD83C\uDFD2 Hockey' },
      { key: 'lacrosse', label: '\uD83E\uDD4D Lacrosse' },
      { key: 'football', label: '\uD83C\uDFC8 Football' },
      { key: 'baseball', label: '\u26BE Baseball' },
    ];
    html += '<select id="standaloneFieldTypeSelect" onchange="changeCustomFieldType(this.value)">';
    for (const ft of fieldTypes) {
      const sel = ft.key === fieldCustomFieldType ? ' selected' : '';
      html += `<option value="${ft.key}"${sel}>${ft.label}</option>`;
    }
    html += '</select>';
  } else if (currentSport) {
    html += '<select id="standaloneFormatSelect" onchange="changeStandaloneFormat(this.value)">';
    for (const fmt of currentSport.formats) {
      const sel = fmt.key === currentFormatKey ? ' selected' : '';
      html += `<option value="${fmt.key}"${sel}>${fmt.name}</option>`;
    }
    html += '</select>';
  }

  html += '</div>';
  return html;
}

function changeStandaloneSport(sportKey) {
  const sport = SPORTS[sportKey];
  if (!sport || sport.formats.length === 0) return;
  const firstFormat = sport.formats[0];
  const presetKey = makePresetKey(sportKey, firstFormat.key);
  changeStandalonePreset(presetKey);
}

function changeStandaloneFormat(formatKey) {
  const parsed = parsePresetKey(fieldStandalonePreset);
  const presetKey = makePresetKey(parsed.sport, formatKey);
  changeStandalonePreset(presetKey);
}

function changeStandalonePreset(presetKey) {
  fieldStandalonePreset = presetKey;
  fieldFormationIdx = 0;
  fieldDotPositions = {};
  fieldRoutes = [];
  fieldSelectedRoute = null;
  fieldActivePlayId = null;
  fieldDefenseOn = false;
  fieldDefenseMarkers = [];
  fieldZones = [];
  fieldZoneMode = false;
  fieldSelectedZone = null;
  fieldCustomFieldType = 'generic';
  fieldPlays = Storage.loadPlays('__standalone__', '__standalone__');
  renderField();
}

function changeCustomFieldType(fieldType) {
  fieldCustomFieldType = fieldType;
  renderField();
}

function addCustomDot() {
  if (fieldCustomCount >= 15) return;
  fieldCustomCount++;
  fieldDotPositions = {};
  renderField();
}

function removeCustomDot() {
  if (fieldCustomCount <= 1) return;
  fieldCustomCount--;
  fieldDotPositions = {};
  renderField();
}

function renderField() {
  const el = document.getElementById('fieldContent');
  if (!el) return;

  if (typeof FORMATIONS === 'undefined') {
    el.innerHTML = '<div class="empty-state"><p style="color:var(--warn)">Update needed -- close the app completely and reopen it to refresh.</p></div>';
    return;
  }

  const isStandalone = !ctx || !roster;
  const isCustomStandalone = isStandalone && fieldStandalonePreset === 'custom';
  const formInfo = getFieldFormations();
  const layouts = formInfo.layouts;
  if (layouts.length === 0) {
    const positions = roster
      ? roster.positions
      : getStandalonePositions();
    layouts.push({ name: 'Auto', coords: generateAutoLayout(positions) });
  }
  if (fieldFormationIdx >= layouts.length) fieldFormationIdx = 0;

  const hasGame = !!currentPlan;
  const plan = currentPlan;

  let html = '';

  // Standalone sport/format selector (only when no team is active)
  if (isStandalone) {
    html += buildStandaloneSportSelectorHTML();
  }

  // Formation selector + reset (or custom +/- controls)
  html += '<div class="field-controls">';
  if (isCustomStandalone) {
    html += `<span class="custom-count-label">${fieldCustomCount} position${fieldCustomCount !== 1 ? 's' : ''}</span>`;
    html += `<button class="btn-icon" onclick="removeCustomDot()" title="Remove position"${fieldCustomCount <= 1 ? ' disabled' : ''}>&#x2212;</button>`;
    html += `<button class="btn-icon" onclick="addCustomDot()" title="Add position"${fieldCustomCount >= 15 ? ' disabled' : ''}>+</button>`;
  } else {
    html += '<select id="fieldFormationSelect" onchange="changeFormation(this.value)">';
    layouts.forEach((l, i) => {
      html += `<option value="${i}" ${i === fieldFormationIdx ? 'selected' : ''}>${l.name}</option>`;
    });
    html += '</select>';
  }
  html += '<button class="btn-icon" onclick="resetFieldDots()" title="Reset positions">&#x21BA;</button>';
  if (hasGame) {
    html += `<button class="btn-icon${fieldShowNames ? ' active-icon' : ''}" onclick="toggleFieldNames()" title="Toggle player names">${fieldShowNames ? 'Aa' : 'Aa'}</button>`;
  }
  html += `<button class="btn-icon${fieldDrawMode ? ' active-icon' : ''}" onclick="toggleDrawMode()" title="Draw routes">&#x270E;</button>`;
  html += `<button class="btn-icon${fieldZoneMode ? ' active-icon' : ''}" onclick="toggleZoneMode()" title="Draw zones">&#x25A2;</button>`;
  html += `<button class="btn-icon${fieldDefenseOn ? ' active-icon def-active' : ''}" onclick="toggleDefense()" title="Defense overlay">DEF</button>`;
  html += '</div>';

  // Plays controls row
  html += buildPlaysControlsHTML();

  // Draw toolbar (visible when draw mode is on)
  if (fieldDrawMode) {
    html += '<div class="draw-toolbar">';
    if (fieldSelectedRoute !== null) {
      html += '<span class="draw-toolbar-label">Route selected</span>';
      html += '<button class="btn-sm-outline btn-sm-danger" onclick="deleteSelectedRoute()">Delete Route</button>';
      html += '<button class="btn-sm-outline" onclick="deselectRoute()">Cancel</button>';
    } else {
      html += '<span class="draw-toolbar-label">Drawing routes</span>';
      html += `<button class="btn-sm-outline" onclick="undoRoute()"${fieldRoutes.length === 0 ? ' disabled' : ''}>&#x21A9; Undo</button>`;
      html += `<button class="btn-sm-outline" onclick="clearRoutes()"${fieldRoutes.length === 0 ? ' disabled' : ''}>Clear All</button>`;
    }
    html += '</div>';
  }

  // Defense toolbar (visible when defense is on)
  if (fieldDefenseOn) {
    html += '<div class="draw-toolbar def-toolbar">';
    html += `<span class="draw-toolbar-label def-label">Defense &#xd7; ${fieldDefenseMarkers.length}</span>`;
    html += '<button class="btn-sm-outline" onclick="addDefenseMarker()">+ Add</button>';
    html += `<button class="btn-sm-outline" onclick="removeDefenseMarker()"${fieldDefenseMarkers.length === 0 ? ' disabled' : ''}>&#x2212; Remove</button>`;
    html += '</div>';
  }

  // Zone toolbar (visible when zone mode is on)
  if (fieldZoneMode) {
    html += '<div class="draw-toolbar zone-toolbar">';
    if (fieldSelectedZone !== null) {
      html += '<span class="draw-toolbar-label">Zone selected</span>';
      html += '<button class="btn-sm-outline btn-sm-danger" onclick="deleteSelectedZone()">Delete</button>';
      html += '<button class="btn-sm-outline" onclick="deselectZone()">Cancel</button>';
    } else {
      html += '<span class="draw-toolbar-label">Drawing zones</span>';
      const zoneColors = [
        { key: 'blue', fill: 'rgba(66,133,244,0.5)' },
        { key: 'red', fill: 'rgba(234,67,53,0.5)' },
        { key: 'yellow', fill: 'rgba(251,188,4,0.5)' },
        { key: 'green', fill: 'rgba(0,230,118,0.5)' },
      ];
      for (const c of zoneColors) {
        const active = fieldZoneColor === c.key ? ' active' : '';
        html += `<span class="zone-color-chip${active}" style="background:${c.fill}" onclick="setZoneColor('${c.key}')"></span>`;
      }
      html += `<button class="btn-sm-outline" onclick="undoZone()"${fieldZones.length === 0 ? ' disabled' : ''}>&#x21A9;</button>`;
      html += `<button class="btn-sm-outline" onclick="clearZones()"${fieldZones.length === 0 ? ' disabled' : ''}>Clear</button>`;
    }
    html += '</div>';
  }

  // Period pills (only if game plan exists)
  if (hasGame) {
    const periodLabel = getPeriodLabel(plan.numPeriods, true);
    html += '<div class="period-pills">';
    for (let i = 0; i < plan.numPeriods; i++) {
      const active = i === fieldPeriodIdx ? ' active' : '';
      html += `<button class="period-pill${active}" onclick="fieldSelectPeriod(${i})">${periodLabel}${i + 1}</button>`;
    }
    html += '</div>';
    if (fieldPeriodIdx >= plan.numPeriods) fieldPeriodIdx = 0;
  }

  // SVG field
  html += `<div class="field-container${fieldDrawMode ? ' draw-mode' : ''}${fieldZoneMode ? ' draw-mode' : ''}" id="fieldSvgContainer">`;
  html += buildFieldSVG(formInfo, layouts[fieldFormationIdx], hasGame ? plan : null, fieldPeriodIdx);

  // HTML touch overlays for reliable drag on mobile
  if (!fieldDrawMode && !fieldZoneMode) {
    const positions = roster ? roster.positions : getStandalonePositions();
    const coords = layouts[fieldFormationIdx].coords;
    const _W = 340, _H = 480, _pad = 12;
    for (const pos of positions) {
      const baseCoord = coords[pos];
      if (!baseCoord) continue;
      let cx, cy;
      if (fieldDotPositions[pos]) {
        cx = fieldDotPositions[pos][0];
        cy = fieldDotPositions[pos][1];
      } else {
        cx = _pad + baseCoord[0] / 100 * (_W - 2 * _pad);
        cy = _pad + baseCoord[1] / 100 * (_H - 2 * _pad);
      }
      html += `<div class="dot-overlay" data-pos="${pos}" style="left:${(cx/_W*100).toFixed(2)}%;top:${(cy/_H*100).toFixed(2)}%"></div>`;
    }
    if (fieldDefenseOn) {
      for (let di = 0; di < fieldDefenseMarkers.length; di++) {
        const dm = fieldDefenseMarkers[di];
        html += `<div class="def-overlay" data-def-idx="${di}" style="left:${(dm.x/_W*100).toFixed(2)}%;top:${(dm.y/_H*100).toFixed(2)}%"></div>`;
      }
    }
  }

  html += '</div>';

  // Bench (game mode)
  if (hasGame) {
    const pa = plan.periodAssignments[fieldPeriodIdx];
    if (pa.bench.length > 0) {
      html += '<div class="field-bench"><div class="field-bench-label">Bench</div>';
      for (const bpid of pa.bench) {
        const bname = roster.players[bpid]?.name || bpid;
        html += `<div class="bench-chip">${esc(bname)}</div>`;
      }
      html += '</div>';
    }
  }

  // Mode label — minimal hint
  let modeText;
  if (hasGame || fieldActivePlayId) {
    modeText = 'Drag to reposition';
  } else {
    modeText = 'Drag to explore positions';
  }
  html += `<div class="field-mode-label">${modeText}</div>`;

  el.innerHTML = html;
  setupFieldDrag();
  if (fieldDrawMode) setupFieldDraw();
  if (fieldZoneMode) setupZoneDraw();
  if (fieldDefenseOn && !fieldDrawMode && !fieldZoneMode) setupDefenseDrag();
  if (fieldDrawMode && fieldRoutes.length > 0) setupRouteSelection();
  if (fieldZoneMode && fieldZones.length > 0) setupZoneSelection();
}

// -- SVG Building -----------------------------------------------------

function buildFieldSVG(formInfo, layout, plan, periodIdx) {
  const W = 340;
  const H = 480;
  const pad = 12;

  const positions = roster
    ? roster.positions
    : getStandalonePositions();
  const coords = layout.coords;
  let playerMap = null;
  if (plan) {
    const pa = plan.periodAssignments[periodIdx];
    playerMap = {};
    for (const [pos, pid] of Object.entries(pa.assignments)) {
      playerMap[pos] = roster.players[pid]?.name || pid;
    }
  }

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += buildFieldBackground(formInfo.fieldType, W, H, pad);

  // Render zones (above field, below everything else)
  const zoneColorMap = {
    blue:   { fill: 'rgba(66,133,244,0.20)', stroke: 'rgba(66,133,244,0.60)' },
    red:    { fill: 'rgba(234,67,53,0.20)', stroke: 'rgba(234,67,53,0.60)' },
    yellow: { fill: 'rgba(251,188,4,0.20)', stroke: 'rgba(251,188,4,0.60)' },
    green:  { fill: 'rgba(0,230,118,0.20)', stroke: 'rgba(0,230,118,0.60)' },
  };
  for (let zi = 0; zi < fieldZones.length; zi++) {
    const zone = fieldZones[zi];
    if (zone.points.length < 3) continue;
    const colors = zoneColorMap[zone.color] || zoneColorMap.blue;
    const isSelected = zi === fieldSelectedZone;
    const pathD = smoothPath(zone.points) + ' Z';
    // Hit area for selection
    svg += `<path d="${pathD}" fill="transparent" stroke="transparent" stroke-width="14" class="zone-hit" data-zone-idx="${zi}"/>`;
    svg += `<path d="${pathD}" fill="${colors.fill}" stroke="${isSelected ? 'rgba(255,255,255,0.9)' : colors.stroke}" stroke-width="${isSelected ? 3 : 2}" stroke-linejoin="round" class="zone-path" data-zone-idx="${zi}"/>`;
  }

  // Render zone in progress
  if (fieldZoneDrawState && fieldZoneDrawState.points.length >= 2) {
    const previewColors = zoneColorMap[fieldZoneColor] || zoneColorMap.blue;
    const previewD = smoothPath(fieldZoneDrawState.points);
    svg += `<path d="${previewD}" fill="${previewColors.fill}" stroke="${previewColors.stroke}" stroke-width="2" stroke-linejoin="round" stroke-dasharray="6 4" class="zone-drawing"/>`;
  }

  // Render route lines (under dots)
  let arrowheadsSvg = '';
  for (let ri = 0; ri < fieldRoutes.length; ri++) {
    const route = fieldRoutes[ri];
    if (route.points.length < 2) continue;
    const isSelected = ri === fieldSelectedRoute;
    const pathD = smoothPath(route.points);
    const strokeColor = isSelected ? 'rgba(0,230,118,0.9)' : 'rgba(255,255,255,1.0)';
    const strokeW = isSelected ? 3.5 : 2.5;

    // Selection hit area (wider invisible path)
    svg += `<path d="${pathD}" fill="none" stroke="transparent" stroke-width="18" class="route-hit" data-route-idx="${ri}"/>`;
    // Visible path
    svg += `<path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round" class="route-path" data-route-idx="${ri}"/>`;
    // Collect arrowhead for later (rendered on top)
    const pts = route.points;
    arrowheadsSvg += buildArrowhead(pts[pts.length - 2], pts[pts.length - 1], 10, strokeColor);
  }

  // Render in-progress drawing
  if (fieldDrawState && fieldDrawState.points.length >= 2) {
    const pathD = smoothPath(fieldDrawState.points);
    svg += `<path d="${pathD}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6 4" class="route-drawing"/>`;
  }

  const dotR = 16;
  const hitR = 26;
  for (const pos of positions) {
    const baseCoord = coords[pos];
    if (!baseCoord) continue;

    let cx, cy;
    if (fieldDotPositions[pos]) {
      cx = fieldDotPositions[pos][0];
      cy = fieldDotPositions[pos][1];
    } else {
      cx = pad + baseCoord[0] / 100 * (W - 2 * pad);
      cy = pad + baseCoord[1] / 100 * (H - 2 * pad);
    }

    const isGK = pos === 'GK' || pos === 'G';
    const hasPlayer = playerMap && playerMap[pos];
    const dotClass = isGK ? 'gk-dot' : (hasPlayer ? 'player-dot' : 'template-dot');

    svg += `<g class="dot-group" data-pos="${pos}">`;
    svg += `<circle class="dot-hit" cx="${cx}" cy="${cy}" r="${hitR}"/>`;
    svg += `<circle class="dot-circle ${dotClass}" cx="${cx}" cy="${cy}" r="${dotR}"/>`;
    svg += `<text class="dot-label" x="${cx}" y="${cy + 1}" font-size="9">${pos}</text>`;

    if (hasPlayer && fieldShowNames) {
      const displayName = playerMap[pos].length > 10 ? playerMap[pos].slice(0, 9) + '...' : playerMap[pos];
      svg += `<text class="dot-name" x="${cx}" y="${cy + dotR + 13}" font-size="11">${escXml(displayName)}</text>`;
    }

    svg += '</g>';
  }

  // Defense markers (X shapes)
  if (fieldDefenseOn && fieldDefenseMarkers.length > 0) {
    const defR = 12;
    const defHitR = 22;
    for (let di = 0; di < fieldDefenseMarkers.length; di++) {
      const dm = fieldDefenseMarkers[di];
      svg += `<g class="def-group" data-def-idx="${di}">`;
      svg += `<circle cx="${dm.x}" cy="${dm.y}" r="${defHitR}" fill="transparent"/>`;
      const s = defR * 0.6;
      svg += `<line x1="${dm.x - s}" y1="${dm.y - s}" x2="${dm.x + s}" y2="${dm.y + s}" stroke="rgba(255,82,82,0.7)" stroke-width="3" stroke-linecap="round"/>`;
      svg += `<line x1="${dm.x + s}" y1="${dm.y - s}" x2="${dm.x - s}" y2="${dm.y + s}" stroke="rgba(255,82,82,0.7)" stroke-width="3" stroke-linecap="round"/>`;
      svg += '</g>';
    }
  }

  // Arrowheads on top of everything
  svg += arrowheadsSvg;

  svg += '</svg>';
  return svg;
}

function escXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Build an SVG arrowhead triangle at tip, pointing from prev toward tip.
 */
function buildArrowhead(prev, tip, size, color) {
  const angle = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]);
  // Shift tip forward so the arrow's center sits on the endpoint
  const half = size * 0.5;
  const tx = tip[0] + half * Math.cos(angle);
  const ty = tip[1] + half * Math.sin(angle);
  const a1 = angle + Math.PI * 0.82;
  const a2 = angle - Math.PI * 0.82;
  const x1 = tx + size * Math.cos(a1);
  const y1 = ty + size * Math.sin(a1);
  const x2 = tx + size * Math.cos(a2);
  const y2 = ty + size * Math.sin(a2);
  return `<polygon points="${tx},${ty} ${x1},${y1} ${x2},${y2}" fill="${color}"/>`;
}

// -- Field Backgrounds ------------------------------------------------

function buildFieldBackground(fieldType, W, H, pad) {
  const lw = pad;
  const rw = W - pad;
  const th = pad;
  const bh = H - pad;
  const fw = rw - lw;
  const fh = bh - th;
  const cx = W / 2;
  const cy = H / 2;
  const line = 'rgba(255,255,255,0.2)';
  const lineLight = 'rgba(255,255,255,0.13)';
  const lineFaint = 'rgba(255,255,255,0.08)';

  let bg = '';

  if (fieldType === 'soccer') {
    bg += buildSoccerField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else if (fieldType === 'basketball') {
    bg += buildBasketballCourt(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else if (fieldType === 'hockey') {
    bg += buildHockeyRink(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else if (fieldType === 'lacrosse') {
    bg += buildLacrosseField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else if (fieldType === 'football') {
    bg += buildFootballField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else if (fieldType === 'baseball') {
    bg += buildBaseballDiamond(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint);
  } else {
    // Generic field
    bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1a2a3a"/>`;
    bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="none" stroke="${line}" stroke-width="1.5"/>`;
    bg += `<line x1="${lw}" y1="${cy}" x2="${rw}" y2="${cy}" stroke="${lineLight}" stroke-width="1.5"/>`;
    bg += `<circle cx="${cx}" cy="${cy}" r="${fw * 0.1}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  }

  return bg;
}

function buildSoccerField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1a472a"/>`;
  for (let i = 0; i < 8; i++) {
    const sy = th + (fh / 8) * i;
    if (i % 2 === 0) bg += `<rect x="${lw}" y="${sy}" width="${fw}" height="${fh/8}" fill="rgba(255,255,255,0.015)"/>`;
  }
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="none" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${lw}" y1="${cy}" x2="${rw}" y2="${cy}" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<circle cx="${cx}" cy="${cy}" r="${fw * 0.13}" fill="none" stroke="${lineLight}" stroke-width="1.5"/>`;
  bg += `<circle cx="${cx}" cy="${cy}" r="2.5" fill="rgba(255,255,255,0.3)"/>`;
  const paW = fw * 0.52, paH = fh * 0.15;
  bg += `<rect x="${cx - paW/2}" y="${th}" width="${paW}" height="${paH}" fill="none" stroke="${lineLight}" stroke-width="1"/>`;
  bg += `<rect x="${cx - paW/2}" y="${bh - paH}" width="${paW}" height="${paH}" fill="none" stroke="${lineLight}" stroke-width="1"/>`;
  const gaW = fw * 0.26, gaH = fh * 0.06;
  bg += `<rect x="${cx - gaW/2}" y="${th}" width="${gaW}" height="${gaH}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<rect x="${cx - gaW/2}" y="${bh - gaH}" width="${gaW}" height="${gaH}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<circle cx="${cx}" cy="${th + paH * 0.75}" r="2" fill="rgba(255,255,255,0.2)"/>`;
  bg += `<circle cx="${cx}" cy="${bh - paH * 0.75}" r="2" fill="rgba(255,255,255,0.2)"/>`;
  const arcR = fh * 0.06;
  bg += `<path d="M ${cx - arcR} ${th + paH} A ${arcR} ${arcR} 0 0 0 ${cx + arcR} ${th + paH}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<path d="M ${cx - arcR} ${bh - paH} A ${arcR} ${arcR} 0 0 1 ${cx + arcR} ${bh - paH}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  const cornerR = 8;
  bg += `<path d="M ${lw + cornerR} ${th} A ${cornerR} ${cornerR} 0 0 0 ${lw} ${th + cornerR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<path d="M ${rw - cornerR} ${th} A ${cornerR} ${cornerR} 0 0 1 ${rw} ${th + cornerR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<path d="M ${lw + cornerR} ${bh} A ${cornerR} ${cornerR} 0 0 1 ${lw} ${bh - cornerR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<path d="M ${rw - cornerR} ${bh} A ${cornerR} ${cornerR} 0 0 0 ${rw} ${bh - cornerR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  const goalW = fw * 0.14, goalH = 10;
  bg += `<rect x="${cx - goalW/2}" y="${th - goalH}" width="${goalW}" height="${goalH}" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
  bg += `<rect x="${cx - goalW/2}" y="${bh}" width="${goalW}" height="${goalH}" rx="2" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
  return bg;
}

function buildBasketballCourt(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#4a2812"/>`;
  for (let i = 0; i < 12; i++) {
    const gx = lw + (fw / 12) * i + (fw / 24);
    bg += `<line x1="${gx}" y1="${th}" x2="${gx}" y2="${bh}" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>`;
  }
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="none" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${lw}" y1="${cy}" x2="${rw}" y2="${cy}" stroke="${line}" stroke-width="1.5"/>`;
  const ccR = fw * 0.12;
  bg += `<circle cx="${cx}" cy="${cy}" r="${ccR}" fill="none" stroke="${lineLight}" stroke-width="1.5"/>`;
  const paintW = fw * 0.32, paintH = fh * 0.2;
  bg += `<rect x="${cx - paintW/2}" y="${th}" width="${paintW}" height="${paintH}" fill="rgba(255,100,50,0.06)" stroke="${lineLight}" stroke-width="1"/>`;
  bg += `<rect x="${cx - paintW/2}" y="${bh - paintH}" width="${paintW}" height="${paintH}" fill="rgba(255,100,50,0.06)" stroke="${lineLight}" stroke-width="1"/>`;
  const ftR = paintW / 2;
  bg += `<circle cx="${cx}" cy="${th + paintH}" r="${ftR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<circle cx="${cx}" cy="${bh - paintH}" r="${ftR}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  const tpR = fw * 0.42, tpSideY = fh * 0.07;
  bg += `<path d="M ${cx - tpR} ${th} L ${cx - tpR} ${th + tpSideY}" stroke="${lineFaint}" stroke-width="1" fill="none"/>`;
  bg += `<path d="M ${cx + tpR} ${th} L ${cx + tpR} ${th + tpSideY}" stroke="${lineFaint}" stroke-width="1" fill="none"/>`;
  bg += `<path d="M ${cx - tpR} ${th + tpSideY} A ${tpR} ${tpR} 0 0 0 ${cx + tpR} ${th + tpSideY}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<path d="M ${cx - tpR} ${bh} L ${cx - tpR} ${bh - tpSideY}" stroke="${lineFaint}" stroke-width="1" fill="none"/>`;
  bg += `<path d="M ${cx + tpR} ${bh} L ${cx + tpR} ${bh - tpSideY}" stroke="${lineFaint}" stroke-width="1" fill="none"/>`;
  bg += `<path d="M ${cx - tpR} ${bh - tpSideY} A ${tpR} ${tpR} 0 0 1 ${cx + tpR} ${bh - tpSideY}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  const bbW = 22, rimR = 6;
  bg += `<line x1="${cx - bbW/2}" y1="${th + 6}" x2="${cx + bbW/2}" y2="${th + 6}" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>`;
  bg += `<circle cx="${cx}" cy="${th + 6 + rimR + 2}" r="${rimR}" fill="none" stroke="rgba(255,140,0,0.5)" stroke-width="1.5"/>`;
  bg += `<line x1="${cx - bbW/2}" y1="${bh - 6}" x2="${cx + bbW/2}" y2="${bh - 6}" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>`;
  bg += `<circle cx="${cx}" cy="${bh - 6 - rimR - 2}" r="${rimR}" fill="none" stroke="rgba(255,140,0,0.5)" stroke-width="1.5"/>`;
  return bg;
}

function buildHockeyRink(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0f2236"/>`;
  const rinkR = 40;
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" rx="${rinkR}" fill="#162e44" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>`;
  bg += `<line x1="${lw + 10}" y1="${cy}" x2="${rw - 10}" y2="${cy}" stroke="rgba(220,60,60,0.45)" stroke-width="3"/>`;
  bg += `<circle cx="${cx}" cy="${cy}" r="${fw * 0.1}" fill="none" stroke="rgba(70,120,220,0.4)" stroke-width="1.5"/>`;
  bg += `<circle cx="${cx}" cy="${cy}" r="4" fill="rgba(70,120,220,0.5)"/>`;
  const blueY1 = th + fh * 0.33, blueY2 = th + fh * 0.67;
  bg += `<line x1="${lw + 10}" y1="${blueY1}" x2="${rw - 10}" y2="${blueY1}" stroke="rgba(70,120,220,0.4)" stroke-width="3"/>`;
  bg += `<line x1="${lw + 10}" y1="${blueY2}" x2="${rw - 10}" y2="${blueY2}" stroke="rgba(70,120,220,0.4)" stroke-width="3"/>`;
  const foR = fw * 0.11, foX1 = cx - fw * 0.26, foX2 = cx + fw * 0.26;
  const foY1 = th + fh * 0.2, foY2 = bh - fh * 0.2;
  [foX1, foX2].forEach(fx => {
    [foY1, foY2].forEach(fy => {
      bg += `<circle cx="${fx}" cy="${fy}" r="${foR}" fill="none" stroke="rgba(220,40,40,0.25)" stroke-width="1"/>`;
      bg += `<circle cx="${fx}" cy="${fy}" r="3" fill="rgba(220,40,40,0.35)"/>`;
    });
  });
  // Neutral zone dots
  bg += `<circle cx="${foX1}" cy="${blueY1 + 15}" r="3" fill="rgba(220,40,40,0.3)"/>`;
  bg += `<circle cx="${foX2}" cy="${blueY1 + 15}" r="3" fill="rgba(220,40,40,0.3)"/>`;
  bg += `<circle cx="${foX1}" cy="${blueY2 - 15}" r="3" fill="rgba(220,40,40,0.3)"/>`;
  bg += `<circle cx="${foX2}" cy="${blueY2 - 15}" r="3" fill="rgba(220,40,40,0.3)"/>`;
  // Goal lines — thin red lines inside the rink (about 12% from each end)
  const goalLineTop = th + fh * 0.09;
  const goalLineBot = bh - fh * 0.09;
  bg += `<line x1="${lw + 15}" y1="${goalLineTop}" x2="${rw - 15}" y2="${goalLineTop}" stroke="rgba(220,40,40,0.3)" stroke-width="1.5"/>`;
  bg += `<line x1="${lw + 15}" y1="${goalLineBot}" x2="${rw - 15}" y2="${goalLineBot}" stroke="rgba(220,40,40,0.3)" stroke-width="1.5"/>`;
  // Goal nets — sit on the goal line, extending toward the boards
  const goalNetW = 20, goalNetH = 8;
  bg += `<rect x="${cx - goalNetW/2}" y="${goalLineTop - goalNetH}" width="${goalNetW}" height="${goalNetH}" rx="1" fill="rgba(220,40,40,0.12)" stroke="rgba(220,40,40,0.35)" stroke-width="1.5"/>`;
  bg += `<rect x="${cx - goalNetW/2}" y="${goalLineBot}" width="${goalNetW}" height="${goalNetH}" rx="1" fill="rgba(220,40,40,0.12)" stroke="rgba(220,40,40,0.35)" stroke-width="1.5"/>`;
  // Goal creases — semicircles opening toward center ice
  const creaseR = 18;
  bg += `<path d="M ${cx - creaseR} ${goalLineTop} A ${creaseR} ${creaseR} 0 0 1 ${cx + creaseR} ${goalLineTop}" fill="rgba(100,180,255,0.12)" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  bg += `<line x1="${cx - creaseR}" y1="${goalLineTop}" x2="${cx - creaseR}" y2="${goalLineTop - 5}" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  bg += `<line x1="${cx + creaseR}" y1="${goalLineTop}" x2="${cx + creaseR}" y2="${goalLineTop - 5}" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  bg += `<path d="M ${cx - creaseR} ${goalLineBot} A ${creaseR} ${creaseR} 0 0 0 ${cx + creaseR} ${goalLineBot}" fill="rgba(100,180,255,0.12)" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  bg += `<line x1="${cx - creaseR}" y1="${goalLineBot}" x2="${cx - creaseR}" y2="${goalLineBot + 5}" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  bg += `<line x1="${cx + creaseR}" y1="${goalLineBot}" x2="${cx + creaseR}" y2="${goalLineBot + 5}" stroke="rgba(220,40,40,0.3)" stroke-width="1"/>`;
  return bg;
}

function buildLacrosseField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1a472a"/>`;
  for (let i = 0; i < 6; i++) {
    const sy = th + (fh / 6) * i;
    if (i % 2 === 0) bg += `<rect x="${lw}" y="${sy}" width="${fw}" height="${fh/6}" fill="rgba(255,255,255,0.012)"/>`;
  }
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="none" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${lw}" y1="${cy}" x2="${rw}" y2="${cy}" stroke="${lineLight}" stroke-width="1.5"/>`;
  const restY1 = th + fh * 0.3, restY2 = bh - fh * 0.3;
  bg += `<line x1="${lw}" y1="${restY1}" x2="${rw}" y2="${restY1}" stroke="${lineFaint}" stroke-width="1" stroke-dasharray="6,4"/>`;
  bg += `<line x1="${lw}" y1="${restY2}" x2="${rw}" y2="${restY2}" stroke="${lineFaint}" stroke-width="1" stroke-dasharray="6,4"/>`;
  // Wing areas
  bg += `<line x1="${lw}" y1="${cy - 20}" x2="${lw + 20}" y2="${cy - 20}" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<line x1="${lw}" y1="${cy + 20}" x2="${lw + 20}" y2="${cy + 20}" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<line x1="${rw}" y1="${cy - 20}" x2="${rw - 20}" y2="${cy - 20}" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<line x1="${rw}" y1="${cy + 20}" x2="${rw - 20}" y2="${cy + 20}" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<circle cx="${cx}" cy="${cy}" r="12" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;
  // Creases — goals sit 15 yards from end line on a 110-yard field (≈14%)
  const goalY1 = th + fh * 0.14;
  const goalY2 = bh - fh * 0.14;
  const creaseR2 = 28;
  bg += `<circle cx="${cx}" cy="${goalY1}" r="${creaseR2}" fill="rgba(255,255,255,0.03)" stroke="${lineLight}" stroke-width="1"/>`;
  bg += `<circle cx="${cx}" cy="${goalY2}" r="${creaseR2}" fill="rgba(255,255,255,0.03)" stroke="${lineLight}" stroke-width="1"/>`;
  // Goals
  const goalS = 12;
  bg += `<rect x="${cx - goalS/2}" y="${goalY1 - goalS/2}" width="${goalS}" height="${goalS}" rx="1" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
  bg += `<rect x="${cx - goalS/2}" y="${goalY2 - goalS/2}" width="${goalS}" height="${goalS}" rx="1" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>`;
  return bg;
}

function buildFootballField(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1a472a"/>`;
  // Grass stripes
  const stripeCount = 10;
  for (let i = 0; i < stripeCount; i++) {
    const sy = th + (fh / stripeCount) * i;
    if (i % 2 === 0) bg += `<rect x="${lw}" y="${sy}" width="${fw}" height="${fh/stripeCount}" fill="rgba(255,255,255,0.015)"/>`;
  }
  // Field outline
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="none" stroke="${line}" stroke-width="1.5"/>`;
  // End zones
  const ezH = fh * 0.1;
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${ezH}" fill="rgba(180,40,40,0.12)" stroke="${lineFaint}" stroke-width="1"/>`;
  bg += `<rect x="${lw}" y="${bh - ezH}" width="${fw}" height="${ezH}" fill="rgba(40,80,180,0.12)" stroke="${lineFaint}" stroke-width="1"/>`;
  // Yard lines (every 10%)
  const playFieldTop = th + ezH;
  const playFieldH = fh - 2 * ezH;
  for (let i = 1; i < 10; i++) {
    const yy = playFieldTop + (playFieldH / 10) * i;
    const isMid = i === 5;
    bg += `<line x1="${lw}" y1="${yy}" x2="${rw}" y2="${yy}" stroke="${isMid ? lineLight : lineFaint}" stroke-width="${isMid ? 2 : 1}"/>`;
  }
  // Hash marks along sidelines
  for (let i = 0; i <= 20; i++) {
    const yy = playFieldTop + (playFieldH / 20) * i;
    bg += `<line x1="${lw}" y1="${yy}" x2="${lw + 6}" y2="${yy}" stroke="${lineFaint}" stroke-width="0.8"/>`;
    bg += `<line x1="${rw - 6}" y1="${yy}" x2="${rw}" y2="${yy}" stroke="${lineFaint}" stroke-width="0.8"/>`;
    // Center hash marks
    bg += `<line x1="${cx - 8}" y1="${yy}" x2="${cx - 3}" y2="${yy}" stroke="${lineFaint}" stroke-width="0.6"/>`;
    bg += `<line x1="${cx + 3}" y1="${yy}" x2="${cx + 8}" y2="${yy}" stroke="${lineFaint}" stroke-width="0.6"/>`;
  }
  // Yard numbers (simplified: 10, 20, 30, 40, 50, 40, 30, 20, 10)
  const yardNums = [10, 20, 30, 40, 50, 40, 30, 20, 10];
  for (let i = 0; i < 9; i++) {
    const yy = playFieldTop + (playFieldH / 10) * (i + 1);
    bg += `<text x="${lw + 14}" y="${yy + 3}" font-size="8" fill="rgba(255,255,255,0.15)" font-family="sans-serif">${yardNums[i]}</text>`;
    bg += `<text x="${rw - 14}" y="${yy + 3}" font-size="8" fill="rgba(255,255,255,0.15)" font-family="sans-serif" text-anchor="end">${yardNums[i]}</text>`;
  }
  // Goal posts (simple)
  const gpW = 18;
  bg += `<line x1="${cx - gpW/2}" y1="${th + 2}" x2="${cx + gpW/2}" y2="${th + 2}" stroke="rgba(255,255,0,0.3)" stroke-width="2"/>`;
  bg += `<line x1="${cx}" y1="${th}" x2="${cx}" y2="${th + 6}" stroke="rgba(255,255,0,0.2)" stroke-width="1"/>`;
  bg += `<line x1="${cx - gpW/2}" y1="${bh - 2}" x2="${cx + gpW/2}" y2="${bh - 2}" stroke="rgba(255,255,0,0.3)" stroke-width="2"/>`;
  bg += `<line x1="${cx}" y1="${bh}" x2="${cx}" y2="${bh - 6}" stroke="rgba(255,255,0,0.2)" stroke-width="1"/>`;
  return bg;
}

function buildBaseballDiamond(lw, rw, th, bh, fw, fh, cx, cy, W, H, line, lineLight, lineFaint) {
  let bg = '';
  bg += `<rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#1a472a"/>`;
  // Subtle grass
  bg += `<rect x="${lw}" y="${th}" width="${fw}" height="${fh}" fill="rgba(255,255,255,0.01)"/>`;

  // Diamond geometry -- home plate at bottom center, rotated 45deg
  const homeX = cx;
  const homeY = bh - fh * 0.12;
  const baseR = fh * 0.28;  // distance from home to each base

  const firstX = homeX + baseR * 0.707;
  const firstY = homeY - baseR * 0.707;
  const secondX = homeX;
  const secondY = homeY - baseR * 1.414;
  const thirdX = homeX - baseR * 0.707;
  const thirdY = homeY - baseR * 0.707;

  // Outfield arc
  const outfieldR = fh * 0.52;
  bg += `<path d="M ${homeX - outfieldR * 0.707} ${homeY - outfieldR * 0.707} A ${outfieldR} ${outfieldR} 0 0 1 ${homeX + outfieldR * 0.707} ${homeY - outfieldR * 0.707}" fill="none" stroke="${lineFaint}" stroke-width="1"/>`;

  // Infield dirt (diamond fill)
  const infieldR = baseR * 0.55;
  bg += `<circle cx="${(homeX + secondX) / 2}" cy="${(homeY + secondY) / 2}" r="${infieldR}" fill="rgba(180,140,80,0.08)"/>`;

  // Foul lines (from home through 1B and 3B to outfield)
  bg += `<line x1="${homeX}" y1="${homeY}" x2="${homeX + outfieldR * 0.707}" y2="${homeY - outfieldR * 0.707}" stroke="${lineLight}" stroke-width="1"/>`;
  bg += `<line x1="${homeX}" y1="${homeY}" x2="${homeX - outfieldR * 0.707}" y2="${homeY - outfieldR * 0.707}" stroke="${lineLight}" stroke-width="1"/>`;

  // Baselines (diamond)
  bg += `<line x1="${homeX}" y1="${homeY}" x2="${firstX}" y2="${firstY}" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${firstX}" y1="${firstY}" x2="${secondX}" y2="${secondY}" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${secondX}" y1="${secondY}" x2="${thirdX}" y2="${thirdY}" stroke="${line}" stroke-width="1.5"/>`;
  bg += `<line x1="${thirdX}" y1="${thirdY}" x2="${homeX}" y2="${homeY}" stroke="${line}" stroke-width="1.5"/>`;

  // Bases (small squares rotated 45deg)
  const baseS = 6;
  [[firstX, firstY], [secondX, secondY], [thirdX, thirdY]].forEach(([bx, by]) => {
    bg += `<rect x="${bx - baseS/2}" y="${by - baseS/2}" width="${baseS}" height="${baseS}" fill="rgba(255,255,255,0.35)" transform="rotate(45 ${bx} ${by})"/>`;
  });

  // Home plate (pentagon)
  const hpS = 7;
  bg += `<polygon points="${homeX},${homeY - hpS} ${homeX + hpS},${homeY - 2} ${homeX + hpS * 0.6},${homeY + hpS * 0.5} ${homeX - hpS * 0.6},${homeY + hpS * 0.5} ${homeX - hpS},${homeY - 2}" fill="rgba(255,255,255,0.35)"/>`;

  // Pitcher's mound
  const moundX = (homeX + secondX) / 2;
  const moundY = (homeY + secondY) / 2;
  bg += `<circle cx="${moundX}" cy="${moundY}" r="10" fill="rgba(180,140,80,0.1)" stroke="${lineFaint}" stroke-width="0.8"/>`;
  bg += `<circle cx="${moundX}" cy="${moundY}" r="3" fill="rgba(255,255,255,0.3)"/>`;

  // Pitcher's rubber
  bg += `<rect x="${moundX - 5}" y="${moundY - 1}" width="10" height="2" fill="rgba(255,255,255,0.2)" rx="0.5"/>`;

  // Batter's boxes
  const bbW2 = 8, bbH2 = 14;
  bg += `<rect x="${homeX - bbW2 - 6}" y="${homeY - bbH2/2}" width="${bbW2}" height="${bbH2}" fill="none" stroke="${lineFaint}" stroke-width="0.8" rx="1"/>`;
  bg += `<rect x="${homeX + 6}" y="${homeY - bbH2/2}" width="${bbW2}" height="${bbH2}" fill="none" stroke="${lineFaint}" stroke-width="0.8" rx="1"/>`;

  // On-deck circles
  bg += `<circle cx="${homeX - fw * 0.22}" cy="${homeY + 10}" r="6" fill="none" stroke="${lineFaint}" stroke-width="0.6"/>`;
  bg += `<circle cx="${homeX + fw * 0.22}" cy="${homeY + 10}" r="6" fill="none" stroke="${lineFaint}" stroke-width="0.6"/>`;

  return bg;
}

// -- Field Controls ---------------------------------------------------

function changeFormation(idx) {
  fieldFormationIdx = parseInt(idx);
  fieldDotPositions = {};
  fieldRoutes = [];
  fieldSelectedRoute = null;
  fieldActivePlayId = null;
  fieldDefenseOn = false;
  fieldDefenseMarkers = [];
  fieldZones = [];
  fieldZoneMode = false;
  fieldSelectedZone = null;
  renderField();
}

function resetFieldDots() {
  fieldDotPositions = {};
  fieldRoutes = [];
  fieldSelectedRoute = null;
  fieldActivePlayId = null;
  fieldDefenseOn = false;
  fieldDefenseMarkers = [];
  fieldZones = [];
  fieldZoneMode = false;
  fieldSelectedZone = null;
  renderField();
}

function fieldSelectPeriod(idx) {
  fieldPeriodIdx = idx;
  fieldDotPositions = {};
  fieldRoutes = [];
  fieldSelectedRoute = null;
  fieldZones = [];
  fieldSelectedZone = null;
  renderField();
}

function toggleFieldNames() {
  fieldShowNames = !fieldShowNames;
  renderField();
}

// -- Plays Management -------------------------------------------------

let playsMenuOpen = false;

function buildPlaysControlsHTML() {
  const plays = fieldPlays;
  const hasPlays = plays.length > 0;
  const showFilter = plays.length > 5;

  let html = '<div class="plays-controls">';

  if (showFilter) {
    html += `<input type="text" class="plays-filter" placeholder="Filter plays..." value="${escXml(fieldPlayFilter)}" oninput="fieldPlayFilter=this.value;renderPlaysDropdown()">`;
  }

  html += '<select id="fieldPlaySelect" onchange="loadPlay(this.value)">';
  html += `<option value="">-- ${hasPlays ? 'Saved Plays' : 'No plays yet'} --</option>`;

  const filtered = getFilteredPlays();
  for (const p of filtered) {
    const sel = p.id === fieldActivePlayId ? ' selected' : '';
    html += `<option value="${p.id}"${sel}>${escXml(p.name)}</option>`;
  }
  html += '</select>';

  // Reset to saved positions (only when a play is loaded)
  if (fieldActivePlayId) {
    html += '<button class="btn-icon" onclick="resetToActivePlay()" title="Reset to saved positions">&#x21BA;</button>';
  }

  // Actions menu button (+)
  html += '<div style="position:relative" id="playsMenuWrap">';
  html += '<button class="btn-icon" onclick="togglePlaysMenu()" title="Play actions">+</button>';
  if (playsMenuOpen) {
    html += '<div class="plays-menu">';
    html += '<button class="plays-menu-item" onclick="closePlaysMenu();savePlayAsNew()">Save as New...</button>';
    if (fieldActivePlayId) {
      const ap = fieldPlays.find(p => p.id === fieldActivePlayId);
      const apName = ap ? ap.name : 'play';
      html += `<button class="plays-menu-item" onclick="closePlaysMenu();overwriteActivePlay()">Overwrite &ldquo;${escXml(apName)}&rdquo;</button>`;
      html += `<button class="plays-menu-item plays-menu-danger" onclick="closePlaysMenu();deleteActivePlay()">Delete &ldquo;${escXml(apName)}&rdquo;</button>`;
    }
    html += '</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

function togglePlaysMenu() {
  playsMenuOpen = !playsMenuOpen;
  if (playsMenuOpen) {
    // Re-render just the menu area
    renderField();
    // Close on outside tap
    setTimeout(() => {
      document.addEventListener('pointerdown', closePlaysMenuOutside, { once: true });
    }, 0);
  } else {
    renderField();
  }
}

function closePlaysMenu() {
  playsMenuOpen = false;
}

function closePlaysMenuOutside(e) {
  const wrap = document.getElementById('playsMenuWrap');
  if (wrap && wrap.contains(e.target)) return;
  if (playsMenuOpen) {
    playsMenuOpen = false;
    renderField();
  }
}

function getFilteredPlays() {
  if (!fieldPlayFilter) return fieldPlays;
  const q = fieldPlayFilter.toLowerCase();
  return fieldPlays.filter(p => p.name.toLowerCase().includes(q));
}

function renderPlaysDropdown() {
  const select = document.getElementById('fieldPlaySelect');
  if (!select) return;
  const filtered = getFilteredPlays();
  let opts = `<option value="">-- ${fieldPlays.length > 0 ? 'Saved Plays' : 'No plays yet'} --</option>`;
  for (const p of filtered) {
    const sel = p.id === fieldActivePlayId ? ' selected' : '';
    opts += `<option value="${p.id}"${sel}>${escXml(p.name)}</option>`;
  }
  select.innerHTML = opts;
}

function generatePlayId() {
  return 'play_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

function savePlayAsNew() {
  showPromptModal({
    title: 'Save Play',
    placeholder: 'Play name',
    confirmLabel: 'Save',
    onConfirm: (trimmed) => {
      const playsCtx = getPlaysCtx();
      const routesCopy = fieldRoutes.length > 0 ? fieldRoutes.map(r => ({ points: r.points.map(p => [...p]) })) : undefined;
      const defenseCopy = fieldDefenseOn && fieldDefenseMarkers.length > 0 ? fieldDefenseMarkers.map(d => ({ ...d })) : undefined;
      const zonesCopy = fieldZones.length > 0 ? fieldZones.map(z => ({ points: z.points.map(p => [...p]), color: z.color })) : undefined;

      // Check for case-insensitive duplicate
      const existing = fieldPlays.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        showModal({
          title: 'Overwrite Play',
          message: `A play named "${existing.name}" already exists.\n\nOverwrite it?`,
          confirmLabel: 'Overwrite',
          onConfirm: () => {
            existing.formation = fieldFormationIdx;
            existing.positions = { ...fieldDotPositions };
            existing.routes = routesCopy;
            existing.defense = defenseCopy;
            existing.zones = zonesCopy;
            Storage.savePlays(playsCtx.teamSlug, playsCtx.seasonSlug, fieldPlays);
            fieldActivePlayId = existing.id;
            showToast('Overwritten: ' + existing.name, 'success');
            renderField();
          }
        });
        return;
      }

      const play = {
        id: generatePlayId(),
        name: trimmed,
        formation: fieldFormationIdx,
        positions: { ...fieldDotPositions },
        routes: routesCopy,
        defense: defenseCopy,
        zones: zonesCopy,
      };

      fieldPlays.push(play);
      Storage.savePlays(playsCtx.teamSlug, playsCtx.seasonSlug, fieldPlays);
      fieldActivePlayId = play.id;
      showToast('Play saved: ' + play.name, 'success');
      renderField();
    }
  });
}

function overwriteActivePlay() {
  if (!fieldActivePlayId) return;
  const play = fieldPlays.find(p => p.id === fieldActivePlayId);
  if (!play) return;

  play.formation = fieldFormationIdx;
  play.positions = { ...fieldDotPositions };
  play.routes = fieldRoutes.length > 0 ? fieldRoutes.map(r => ({ points: r.points.map(p => [...p]) })) : undefined;
  play.defense = fieldDefenseOn && fieldDefenseMarkers.length > 0 ? fieldDefenseMarkers.map(d => ({ ...d })) : undefined;
  play.zones = fieldZones.length > 0 ? fieldZones.map(z => ({ points: z.points.map(p => [...p]), color: z.color })) : undefined;
  const playsCtx = getPlaysCtx();
  Storage.savePlays(playsCtx.teamSlug, playsCtx.seasonSlug, fieldPlays);
  showToast('Overwritten: ' + play.name, 'success');
}

function loadPlay(playId) {
  if (!playId) {
    fieldActivePlayId = null;
    fieldDotPositions = {};
    fieldRoutes = [];
    fieldZones = [];
    fieldSelectedZone = null;
    renderField();
    return;
  }

  const play = fieldPlays.find(p => p.id === playId);
  if (!play) return;

  fieldActivePlayId = play.id;
  fieldFormationIdx = play.formation || 0;
  fieldDotPositions = play.positions ? { ...play.positions } : {};
  fieldRoutes = play.routes ? play.routes.map(r => ({ points: r.points.map(p => [...p]) })) : [];
  fieldSelectedRoute = null;
  if (play.defense) {
    fieldDefenseOn = true;
    fieldDefenseMarkers = play.defense.map(d => ({ ...d }));
  } else {
    fieldDefenseOn = false;
    fieldDefenseMarkers = [];
  }
  fieldZones = play.zones ? play.zones.map(z => ({ points: z.points.map(p => [...p]), color: z.color })) : [];
  fieldZoneMode = false;
  fieldSelectedZone = null;
  renderField();
}

function resetToActivePlay() {
  if (!fieldActivePlayId) return;
  const play = fieldPlays.find(p => p.id === fieldActivePlayId);
  if (!play) return;

  fieldFormationIdx = play.formation || 0;
  fieldDotPositions = play.positions ? { ...play.positions } : {};
  fieldRoutes = play.routes ? play.routes.map(r => ({ points: r.points.map(p => [...p]) })) : [];
  fieldSelectedRoute = null;
  if (play.defense) {
    fieldDefenseOn = true;
    fieldDefenseMarkers = play.defense.map(d => ({ ...d }));
  } else {
    fieldDefenseOn = false;
    fieldDefenseMarkers = [];
  }
  fieldZones = play.zones ? play.zones.map(z => ({ points: z.points.map(p => [...p]), color: z.color })) : [];
  fieldZoneMode = false;
  fieldSelectedZone = null;
  renderField();
}

function deleteActivePlay() {
  if (!fieldActivePlayId) return;
  const play = fieldPlays.find(p => p.id === fieldActivePlayId);
  if (!play) return;
  showModal({
    title: 'Delete Play',
    message: `Delete play "${play.name}"?`,
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: () => {
      fieldPlays = fieldPlays.filter(p => p.id !== fieldActivePlayId);
      const playsCtx = getPlaysCtx();
      Storage.savePlays(playsCtx.teamSlug, playsCtx.seasonSlug, fieldPlays);
      fieldActivePlayId = null;
      fieldDotPositions = {};
      fieldRoutes = [];
      fieldSelectedRoute = null;
      fieldDefenseOn = false;
      fieldDefenseMarkers = [];
      fieldZones = [];
      fieldZoneMode = false;
      fieldSelectedZone = null;
      showToast('Deleted: ' + play.name, 'success');
      renderField();
    }
  });
}

// -- Route Drawing ----------------------------------------------------

function toggleDrawMode() {
  fieldDrawMode = !fieldDrawMode;
  fieldDrawState = null;
  fieldSelectedRoute = null;
  // Deactivate zone mode if on
  if (fieldDrawMode && fieldZoneMode) {
    fieldZoneMode = false;
    fieldZoneDrawState = null;
    fieldSelectedZone = null;
  }
  renderField();
}

/**
 * Smooth an array of [x,y] points into an SVG path string.
 * Uses quadratic bezier curves through midpoints for natural-looking curves.
 */
function smoothPath(points) {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`;
  }

  let d = `M${points[0][0]},${points[0][1]}`;

  // Line to midpoint between first two points
  const mx0 = (points[0][0] + points[1][0]) / 2;
  const my0 = (points[0][1] + points[1][1]) / 2;
  d += ` L${mx0},${my0}`;

  // Quadratic beziers through midpoints
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2;
    const my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${points[i][0]},${points[i][1]} ${mx},${my}`;
  }

  // Line to last point
  const last = points[points.length - 1];
  d += ` L${last[0]},${last[1]}`;

  return d;
}

/**
 * Downsample points by minimum distance to reduce noise.
 */
function downsamplePoints(rawPoints, minDist) {
  if (rawPoints.length < 2) return rawPoints;
  const result = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = result[result.length - 1];
    const dx = rawPoints[i][0] - prev[0];
    const dy = rawPoints[i][1] - prev[1];
    if (Math.sqrt(dx * dx + dy * dy) >= minDist) {
      result.push(rawPoints[i]);
    }
  }
  // Always include last point
  const last = rawPoints[rawPoints.length - 1];
  const rLast = result[result.length - 1];
  if (last[0] !== rLast[0] || last[1] !== rLast[1]) {
    result.push(last);
  }
  return result;
}

// -- Route Selection --------------------------------------------------

function setupRouteSelection() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;
  const hits = container.querySelectorAll('.route-hit');
  hits.forEach(h => {
    h.addEventListener('pointerdown', onRouteHitDown, { passive: false });
  });
}

function onRouteHitDown(e) {
  e.preventDefault();
  e.stopPropagation();
  const idx = parseInt(e.currentTarget.getAttribute('data-route-idx'));
  if (isNaN(idx)) return;
  fieldSelectedRoute = (fieldSelectedRoute === idx) ? null : idx;
  renderField();
}

function deselectRoute() {
  fieldSelectedRoute = null;
  renderField();
}

function deleteSelectedRoute() {
  if (fieldSelectedRoute === null || fieldSelectedRoute >= fieldRoutes.length) return;
  fieldRoutes.splice(fieldSelectedRoute, 1);
  fieldSelectedRoute = null;
  renderField();
}

// -- Draw Handler -----------------------------------------------------

function setupFieldDraw() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;
  container.addEventListener('pointerdown', onDrawPointerDown, { passive: false });
  container.addEventListener('contextmenu', e => e.preventDefault());
}

function onDrawPointerDown(e) {
  if (!fieldDrawMode) return;
  if (e.target.closest('.draw-toolbar, .def-toolbar, .field-controls, .plays-controls')) return;

  // Route hit areas handle their own selection via setupRouteSelection
  if (e.target.closest('.route-hit')) return;

  // Clear route selection when starting a new draw
  if (fieldSelectedRoute !== null) {
    fieldSelectedRoute = null;
    // Re-render to clear selection highlight, but don't return --
    // the user may be starting a drag-draw from this point
  }

  e.preventDefault();
  e.stopPropagation();

  const container = document.getElementById('fieldSvgContainer');
  const svg = container.querySelector('svg');
  if (!svg) return;

  const rect = svg.getBoundingClientRect();
  const svgX = (e.clientX - rect.left) / rect.width * 340;
  const svgY = (e.clientY - rect.top) / rect.height * 480;

  fieldDrawState = {
    points: [[svgX, svgY]],
    pointerId: e.pointerId,
  };

  const move = (me) => {
    if (!fieldDrawState || fieldDrawState.pointerId !== me.pointerId) return;
    me.preventDefault();

    const r = svg.getBoundingClientRect();
    const x = (me.clientX - r.left) / r.width * 340;
    const y = (me.clientY - r.top) / r.height * 480;

    const cx = Math.max(4, Math.min(336, x));
    const cy = Math.max(4, Math.min(476, y));

    fieldDrawState.points.push([cx, cy]);

    // Live preview: update the drawing path in the SVG
    const drawPath = svg.querySelector('.route-drawing');
    if (drawPath) {
      const sampled = downsamplePoints(fieldDrawState.points, 6);
      drawPath.setAttribute('d', smoothPath(sampled));
    } else if (fieldDrawState.points.length >= 2) {
      const ns = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'rgba(255,255,255,0.5)');
      path.setAttribute('stroke-width', '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('class', 'route-drawing');
      const sampled = downsamplePoints(fieldDrawState.points, 6);
      path.setAttribute('d', smoothPath(sampled));
      svg.appendChild(path);
    }
  };

  const up = () => {
    if (!fieldDrawState) return;

    const sampled = downsamplePoints(fieldDrawState.points, 6);

    // Only create a route if there's meaningful movement
    if (sampled.length >= 2) {
      const dx = sampled[sampled.length - 1][0] - sampled[0][0];
      const dy = sampled[sampled.length - 1][1] - sampled[0][1];
      const totalDist = Math.sqrt(dx * dx + dy * dy);

      if (totalDist > 15) {
        fieldRoutes.push({ points: sampled });
      }
    }

    fieldDrawState = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    renderField();
  };

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

function undoRoute() {
  if (fieldRoutes.length === 0) return;
  fieldRoutes.pop();
  fieldSelectedRoute = null;
  renderField();
}

function clearRoutes() {
  if (fieldRoutes.length === 0) return;
  fieldRoutes = [];
  fieldSelectedRoute = null;
  renderField();
}

// -- Defense Overlay ---------------------------------------------------

function toggleDefense() {
  fieldDefenseOn = !fieldDefenseOn;
  // Seed with default positions if turning on for the first time with no markers
  if (fieldDefenseOn && fieldDefenseMarkers.length === 0) {
    seedDefenseMarkers();
  }
  renderField();
}

function seedDefenseMarkers() {
  // Place defense markers in the top third of the field, spread horizontally
  const count = roster ? roster.positions.length : 7;
  const W = 340, H = 480, pad = 12;
  fieldDefenseMarkers = [];
  for (let i = 0; i < count; i++) {
    fieldDefenseMarkers.push({
      x: pad + 30 + (W - 2 * pad - 60) * i / (count - 1 || 1),
      y: pad + H * 0.15 + (H * 0.25) * (i % 3 === 1 ? 0.3 : i % 3 === 2 ? 0.6 : 0),
    });
  }
}

function addDefenseMarker() {
  // Add at center of field
  fieldDefenseMarkers.push({ x: 170, y: 240 });
  renderField();
}

function removeDefenseMarker() {
  if (fieldDefenseMarkers.length === 0) return;
  fieldDefenseMarkers.pop();
  renderField();
}

function setupDefenseDrag() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;

  const overlays = container.querySelectorAll('.def-overlay');
  overlays.forEach(overlay => {
    overlay.addEventListener('pointerdown', onDefOverlayPointerDown, { passive: false });
    overlay.addEventListener('contextmenu', e => e.preventDefault());
  });
}

function onDefOverlayPointerDown(e) {
  if (fieldDrawMode) return;
  e.preventDefault();
  e.stopPropagation();
  const overlay = e.currentTarget;
  const idx = parseInt(overlay.getAttribute('data-def-idx'));
  const container = document.getElementById('fieldSvgContainer');
  const svg = container.querySelector('svg');
  if (!svg || isNaN(idx)) return;

  overlay.setPointerCapture(e.pointerId);

  const svgGroup = svg.querySelector(`.def-group[data-def-idx="${idx}"]`);
  const state = { idx, overlay, svgGroup, pointerId: e.pointerId };

  const move = (me) => {
    if (state.pointerId !== me.pointerId) return;
    me.preventDefault();
    const rect = svg.getBoundingClientRect();
    const svgX = (me.clientX - rect.left) / rect.width * 340;
    const svgY = (me.clientY - rect.top) / rect.height * 480;

    const dx = Math.max(12, Math.min(328, svgX));
    const dy = Math.max(12, Math.min(468, svgY));

    fieldDefenseMarkers[idx] = { x: dx, y: dy };

    if (state.svgGroup) {
      const circle = state.svgGroup.querySelector('circle');
      if (circle) { circle.setAttribute('cx', dx); circle.setAttribute('cy', dy); }
      const lines = state.svgGroup.querySelectorAll('line');
      const s = 12 * 0.6;
      if (lines[0]) {
        lines[0].setAttribute('x1', dx - s); lines[0].setAttribute('y1', dy - s);
        lines[0].setAttribute('x2', dx + s); lines[0].setAttribute('y2', dy + s);
      }
      if (lines[1]) {
        lines[1].setAttribute('x1', dx + s); lines[1].setAttribute('y1', dy - s);
        lines[1].setAttribute('x2', dx - s); lines[1].setAttribute('y2', dy + s);
      }
    }

    overlay.style.left = (dx / 340 * 100) + '%';
    overlay.style.top = (dy / 480 * 100) + '%';
  };

  const up = () => {
    overlay.releasePointerCapture(e.pointerId);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
  };

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

// -- Zone Drawing -------------------------------------------------------

var fieldZoneDrawState = null;

function toggleZoneMode() {
  fieldZoneMode = !fieldZoneMode;
  fieldZoneDrawState = null;
  fieldSelectedZone = null;
  // Deactivate draw mode if on
  if (fieldZoneMode && fieldDrawMode) {
    fieldDrawMode = false;
    fieldDrawState = null;
    fieldSelectedRoute = null;
  }
  renderField();
}

function setZoneColor(color) {
  fieldZoneColor = color;
  renderField();
}

function undoZone() {
  if (fieldZones.length === 0) return;
  fieldZones.pop();
  fieldSelectedZone = null;
  renderField();
}

function clearZones() {
  if (fieldZones.length === 0) return;
  fieldZones = [];
  fieldSelectedZone = null;
  renderField();
}

function deleteSelectedZone() {
  if (fieldSelectedZone === null) return;
  fieldZones.splice(fieldSelectedZone, 1);
  fieldSelectedZone = null;
  renderField();
}

function deselectZone() {
  fieldSelectedZone = null;
  renderField();
}

function setupZoneDraw() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;
  container.addEventListener('pointerdown', onZonePointerDown, { passive: false });
  container.addEventListener('contextmenu', e => e.preventDefault());
}

function onZonePointerDown(e) {
  if (!fieldZoneMode) return;
  if (e.target.closest('.draw-toolbar, .zone-toolbar, .def-toolbar, .field-controls, .plays-controls')) return;
  if (e.target.closest('.zone-hit')) return;

  if (fieldSelectedZone !== null) {
    fieldSelectedZone = null;
  }

  e.preventDefault();
  e.stopPropagation();

  const container = document.getElementById('fieldSvgContainer');
  const svg = container.querySelector('svg');
  if (!svg) return;

  const rect = svg.getBoundingClientRect();
  const svgX = (e.clientX - rect.left) / rect.width * 340;
  const svgY = (e.clientY - rect.top) / rect.height * 480;

  fieldZoneDrawState = {
    points: [[svgX, svgY]],
    pointerId: e.pointerId,
  };

  const move = (me) => {
    if (!fieldZoneDrawState || fieldZoneDrawState.pointerId !== me.pointerId) return;
    me.preventDefault();

    const r = svg.getBoundingClientRect();
    const x = (me.clientX - r.left) / r.width * 340;
    const y = (me.clientY - r.top) / r.height * 480;
    const cx = Math.max(4, Math.min(336, x));
    const cy = Math.max(4, Math.min(476, y));

    fieldZoneDrawState.points.push([cx, cy]);

    const drawPath = svg.querySelector('.zone-drawing');
    if (drawPath) {
      const sampled = downsamplePoints(fieldZoneDrawState.points, 8);
      drawPath.setAttribute('d', smoothPath(sampled));
    } else if (fieldZoneDrawState.points.length >= 2) {
      const zoneColorMap = {
        blue: { fill: 'rgba(66,133,244,0.20)', stroke: 'rgba(66,133,244,0.60)' },
        red: { fill: 'rgba(234,67,53,0.20)', stroke: 'rgba(234,67,53,0.60)' },
        yellow: { fill: 'rgba(251,188,4,0.20)', stroke: 'rgba(251,188,4,0.60)' },
        green: { fill: 'rgba(0,230,118,0.20)', stroke: 'rgba(0,230,118,0.60)' },
      };
      const colors = zoneColorMap[fieldZoneColor] || zoneColorMap.blue;
      const ns = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('fill', colors.fill);
      path.setAttribute('stroke', colors.stroke);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('class', 'zone-drawing');
      const sampled = downsamplePoints(fieldZoneDrawState.points, 8);
      path.setAttribute('d', smoothPath(sampled));
      svg.appendChild(path);
    }
  };

  const up = () => {
    if (!fieldZoneDrawState) return;

    const sampled = downsamplePoints(fieldZoneDrawState.points, 8);

    // Only create a zone if there are enough points for a meaningful shape
    if (sampled.length >= 3) {
      fieldZones.push({ points: sampled, color: fieldZoneColor });
    }

    fieldZoneDrawState = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
    renderField();
  };

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}

function setupZoneSelection() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;
  const hits = container.querySelectorAll('.zone-hit');
  hits.forEach(hit => {
    hit.addEventListener('pointerdown', (e) => {
      if (!fieldZoneMode) return;
      e.preventDefault();
      e.stopPropagation();
      const idx = parseInt(hit.getAttribute('data-zone-idx'));
      fieldSelectedZone = fieldSelectedZone === idx ? null : idx;
      renderField();
    });
  });
}

// -- Field Drag Handling ----------------------------------------------

function setupFieldDrag() {
  const container = document.getElementById('fieldSvgContainer');
  if (!container) return;

  const overlays = container.querySelectorAll('.dot-overlay');
  overlays.forEach(overlay => {
    overlay.addEventListener('pointerdown', onDotOverlayPointerDown, { passive: false });
    overlay.addEventListener('contextmenu', e => e.preventDefault());
  });
}

function onDotOverlayPointerDown(e) {
  if (fieldDrawMode || fieldZoneMode) return;
  e.preventDefault();
  e.stopPropagation();
  const overlay = e.currentTarget;
  const pos = overlay.getAttribute('data-pos');
  const container = document.getElementById('fieldSvgContainer');
  const svg = container.querySelector('svg');
  if (!svg) return;

  overlay.setPointerCapture(e.pointerId);

  const svgGroup = svg.querySelector(`.dot-group[data-pos="${pos}"]`);
  const state = { pos, overlay, svgGroup, pointerId: e.pointerId };

  const move = (me) => {
    if (state.pointerId !== me.pointerId) return;
    me.preventDefault();
    const rect = svg.getBoundingClientRect();
    const svgX = (me.clientX - rect.left) / rect.width * 340;
    const svgY = (me.clientY - rect.top) / rect.height * 480;

    const dotCx = Math.max(12, Math.min(328, svgX));
    const dotCy = Math.max(12, Math.min(468, svgY));

    fieldDotPositions[pos] = [dotCx, dotCy];

    if (state.svgGroup) {
      const circles = state.svgGroup.querySelectorAll('circle');
      circles.forEach(c => { c.setAttribute('cx', dotCx); c.setAttribute('cy', dotCy); });
      const texts = state.svgGroup.querySelectorAll('text');
      if (texts[0]) { texts[0].setAttribute('x', dotCx); texts[0].setAttribute('y', dotCy + 1); }
      if (texts[1]) { texts[1].setAttribute('x', dotCx); texts[1].setAttribute('y', dotCy + 16 + 13); }
    }

    overlay.style.left = (dotCx / 340 * 100) + '%';
    overlay.style.top = (dotCy / 480 * 100) + '%';
  };

  const up = () => {
    overlay.releasePointerCapture(e.pointerId);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', up);
  };

  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', up);
}
