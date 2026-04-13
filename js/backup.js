/**
 * backup.js — Full backup/restore + share-team + import-team.
 * Routes through Storage and StorageAdapter. Uses showModal/showToast/
 * closeDynamicModal from app.js. Reads/writes the global ctx and teams.
 */

function openBackupModal() {
  backUpData();
}

function openRestoreModal() {
  restoreFromLocalFile();
}

async function shareOrDownload(blob, filename, toastMsg) {
  // Only attempt native share on mobile. Desktop always downloads directly —
  // navigator.userAgentData.mobile is the only reliable desktop/mobile signal.
  const isMobile = navigator.userAgentData
    ? navigator.userAgentData.mobile
    : /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // .txt extension has broader share-sheet compatibility on Android.
    const shareFilename = filename.replace(/\.json$/, '.txt');
    const file = new File([blob], shareFilename, { type: 'text/plain' });
    const canShare = navigator.canShare && navigator.canShare({ files: [file] });

    if (canShare) {
      try {
        await navigator.share({ files: [file], title: shareFilename });
        if (toastMsg) showToast(toastMsg, 'success');
        return true;
      } catch (e) {
        if (e.name === 'AbortError') return false;
      }
    }
  }
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

      if ((data.version !== 3 && data.version !== 4) || !Array.isArray(data.teams)) {
        showToast('Not a valid backup file (expected v3 or v4 format)', 'error');
        return;
      }

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
            if (existingTeams.length > 0) {
              const safetyBackup = Storage.exportAll();
              const safetyBlob = new Blob([JSON.stringify(safetyBackup, null, 2)], { type: 'application/json' });
              downloadBlob(safetyBlob, `roster-rotation-pre-restore-${new Date().toISOString().split('T')[0]}.json`);
            }

            const result = Storage.importBackup(data);

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

      if ((data.version !== 3 && data.version !== 4) || !Array.isArray(data.teams) || data.teams.length !== 1) {
        showToast('Not a valid team file (expected v3 or v4 with one team)', 'error');
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
