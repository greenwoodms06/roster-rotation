/**
 * storage.js — Data persistence layer (localStorage, multi-team/season)
 * No dependencies on algorithm or UI code.
 */

// ── Utility: slugify ────────────────────────────────────────────────
function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Storage Layer (v2: multi-team/season) ───────────────────────────
const Storage = {

  // ── Team Registry ──────────────────────────────────────────────

  loadTeams() {
    const raw = localStorage.getItem('rot_teams');
    return raw ? JSON.parse(raw) : [];
  },

  saveTeams(teams) {
    localStorage.setItem('rot_teams', JSON.stringify(teams));
  },

  addTeam(team) {
    const teams = this.loadTeams();
    const existing = teams.findIndex(t => t.slug === team.slug);
    if (existing >= 0) {
      teams[existing] = { ...teams[existing], ...team };
    } else {
      teams.push(team);
    }
    this.saveTeams(teams);
    return teams;
  },

  deleteTeam(teamSlug) {
    let teams = this.loadTeams();
    if (!teams.find(t => t.slug === teamSlug)) return teams;

    const seasons = this.loadSeasons(teamSlug);
    for (const s of seasons) {
      localStorage.removeItem(this._key(teamSlug, s.slug, 'roster'));
      localStorage.removeItem(this._key(teamSlug, s.slug, 'games'));
      localStorage.removeItem(this._key(teamSlug, s.slug, 'plays'));
    }
    localStorage.removeItem(`rot_${teamSlug}_seasons`);

    teams = teams.filter(t => t.slug !== teamSlug);
    this.saveTeams(teams);
    return teams;
  },

  // ── Season Registry (per team) ─────────────────────────────────

  loadSeasons(teamSlug) {
    const raw = localStorage.getItem(`rot_${teamSlug}_seasons`);
    return raw ? JSON.parse(raw) : [];
  },

  saveSeasons(teamSlug, seasons) {
    localStorage.setItem(`rot_${teamSlug}_seasons`, JSON.stringify(seasons));
  },

  addSeason(teamSlug, season) {
    const seasons = this.loadSeasons(teamSlug);
    const existing = seasons.findIndex(s => s.slug === season.slug);
    if (existing >= 0) {
      seasons[existing] = { ...seasons[existing], ...season };
    } else {
      seasons.push(season);
    }
    this.saveSeasons(teamSlug, seasons);
    return seasons;
  },

  deleteSeason(teamSlug, seasonSlug) {
    localStorage.removeItem(this._key(teamSlug, seasonSlug, 'roster'));
    localStorage.removeItem(this._key(teamSlug, seasonSlug, 'games'));
    localStorage.removeItem(this._key(teamSlug, seasonSlug, 'plays'));
    let seasons = this.loadSeasons(teamSlug);
    seasons = seasons.filter(s => s.slug !== seasonSlug);
    this.saveSeasons(teamSlug, seasons);
    return seasons;
  },

  // ── Active Context ─────────────────────────────────────────────

  loadContext() {
    const raw = localStorage.getItem('rot_context');
    return raw ? JSON.parse(raw) : null;
  },

  saveContext(ctx) {
    localStorage.setItem('rot_context', JSON.stringify(ctx));
  },

  // ── Data Keys ──────────────────────────────────────────────────

  _key(teamSlug, seasonSlug, sub) {
    return `rot_${teamSlug}_${seasonSlug}_${sub}`;
  },

  // ── Roster ─────────────────────────────────────────────────────

  saveRoster(teamSlug, seasonSlug, roster) {
    localStorage.setItem(this._key(teamSlug, seasonSlug, 'roster'), JSON.stringify(roster));
  },

  loadRoster(teamSlug, seasonSlug) {
    const raw = localStorage.getItem(this._key(teamSlug, seasonSlug, 'roster'));
    return raw ? JSON.parse(raw) : null;
  },

  // ── Plays ─────────────────────────────────────────────────────

  loadPlays(teamSlug, seasonSlug) {
    const raw = localStorage.getItem(this._key(teamSlug, seasonSlug, 'plays'));
    return raw ? JSON.parse(raw) : [];
  },

  savePlays(teamSlug, seasonSlug, plays) {
    localStorage.setItem(this._key(teamSlug, seasonSlug, 'plays'), JSON.stringify(plays));
  },

  // ── Games ──────────────────────────────────────────────────────

  saveGame(teamSlug, seasonSlug, game) {
    const games = this.loadAllGames(teamSlug, seasonSlug);
    const idx = games.findIndex(g => g.gameId === game.gameId);
    if (idx >= 0) games[idx] = game;
    else games.push(game);
    games.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.gameId.localeCompare(b.gameId);
    });
    localStorage.setItem(this._key(teamSlug, seasonSlug, 'games'), JSON.stringify(games));
  },

  loadAllGames(teamSlug, seasonSlug) {
    const raw = localStorage.getItem(this._key(teamSlug, seasonSlug, 'games'));
    if (!raw) return [];
    let games = JSON.parse(raw);

    // Auto-migrate v3 → v4 on load
    let needsSave = false;
    for (const game of games) {
      for (const pa of game.periodAssignments) {
        if (!isV4Assignments(pa.assignments)) {
          needsSave = true;
          break;
        }
      }
      if (needsSave) break;
    }
    if (needsSave) {
      games = migrateGamesToV4(games);
      localStorage.setItem(this._key(teamSlug, seasonSlug, 'games'), JSON.stringify(games));
    }
    return games;
  },

  deleteGame(teamSlug, seasonSlug, gameId) {
    const games = this.loadAllGames(teamSlug, seasonSlug)
      .filter(g => g.gameId !== gameId);
    localStorage.setItem(this._key(teamSlug, seasonSlug, 'games'), JSON.stringify(games));
  },

  // ── Season Stats ───────────────────────────────────────────────

  getSeasonStats(teamSlug, seasonSlug) {
    const games = this.loadAllGames(teamSlug, seasonSlug);
    const stats = {};

    for (const game of games) {
      for (const pid of game.availablePlayers) {
        if (!stats[pid]) {
          stats[pid] = {
            gamesAttended: 0,
            totalPeriodsPlayed: 0,
            totalPeriodsAvailable: 0,
            periodsByPosition: {},
          };
        }
        stats[pid].gamesAttended++;
        stats[pid].totalPeriodsAvailable += game.numPeriods;
      }
      for (const pa of game.periodAssignments) {
        for (const [pos, val] of Object.entries(pa.assignments)) {
          if (Array.isArray(val)) {
            // v4 format: array of occupant entries
            for (const entry of val) {
              if (!stats[entry.pid]) continue;
              const credit = entry.timeOut - entry.timeIn;
              stats[entry.pid].totalPeriodsPlayed += credit;
              stats[entry.pid].periodsByPosition[pos] =
                (stats[entry.pid].periodsByPosition[pos] || 0) + credit;
            }
          } else {
            // v3 fallback (shouldn't happen after migration, but defensive)
            if (!stats[val]) continue;
            stats[val].totalPeriodsPlayed++;
            stats[val].periodsByPosition[pos] =
              (stats[val].periodsByPosition[pos] || 0) + 1;
          }
        }
      }
    }
    return stats;
  },

  // ── Export Helpers (v4 format) ───────────────────────────────────

  exportTeam(teamSlug) {
    const teams = this.loadTeams();
    const team = teams.find(t => t.slug === teamSlug);
    if (!team) return null;

    const seasons = this.loadSeasons(teamSlug);
    const teamData = { slug: team.slug, name: team.name, seasons: [] };
    for (const season of seasons) {
      teamData.seasons.push(this._exportSeason(teamSlug, season));
    }
    return {
      version: 4,
      app: 'roster-rotation',
      exportedAt: new Date().toISOString(),
      teams: [teamData],
    };
  },

  exportAll() {
    const teams = this.loadTeams();
    const data = {
      version: 4,
      app: 'roster-rotation',
      exportedAt: new Date().toISOString(),
      context: this.loadContext(),
      teams: [],
      standalonePlays: this.loadPlays('__standalone__', '__standalone__'),
    };

    for (const team of teams) {
      const teamData = { slug: team.slug, name: team.name, seasons: [] };
      const seasons = this.loadSeasons(team.slug);
      for (const season of seasons) {
        teamData.seasons.push(this._exportSeason(team.slug, season));
      }
      data.teams.push(teamData);
    }
    return data;
  },

  /** Internal: export a single season's data bundle. */
  _exportSeason(teamSlug, season) {
    return {
      slug: season.slug,
      name: season.name,
      preset: season.preset || null,
      positions: season.positions || [],
      roster: this.loadRoster(teamSlug, season.slug) || { players: {}, positions: season.positions || [] },
      games: this.loadAllGames(teamSlug, season.slug),
      plays: this.loadPlays(teamSlug, season.slug),
    };
  },

  // ── Import Helpers (v3 and v4 format) ───────────────────────────

  /**
   * Clear all app data from localStorage (all rot_* keys).
   * Preserves rot_settings (device preferences).
   * Used before a full backup restore.
   */
  clearAll() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rot_') && key !== 'rot_settings') keysToRemove.push(key);
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  },

  /**
   * Restore a full backup. Clears all existing data first.
   * Accepts v3 (auto-migrates games to v4) or v4 format.
   * @param {object} data — parsed backup JSON
   * @returns {{ context: object|null }} — the context to activate
   */
  importBackup(data) {
    if ((data.version !== 3 && data.version !== 4) || !Array.isArray(data.teams)) {
      throw new Error('Invalid backup format (expected version 3 or 4)');
    }

    this.clearAll();

    for (const teamData of data.teams) {
      this._importTeamData(teamData, data.version);
    }

    // Standalone plays
    if (Array.isArray(data.standalonePlays) && data.standalonePlays.length > 0) {
      this.savePlays('__standalone__', '__standalone__', data.standalonePlays);
    }

    // Restore context
    const ctx = data.context || null;
    this.saveContext(ctx);

    return { context: ctx };
  },

  /**
   * Import a shared single-team file. Adds the team if new,
   * replaces it (cascade delete + re-add) if the slug already exists.
   * Does not touch other teams or standalone data.
   * Accepts v3 (auto-migrates) or v4 format.
   * @param {object} data — parsed single-team JSON
   * @returns {{ teamSlug: string, seasonSlugs: string[] }}
   */
  importSharedTeam(data) {
    if ((data.version !== 3 && data.version !== 4) || !Array.isArray(data.teams) || data.teams.length !== 1) {
      throw new Error('Invalid shared team format (expected version 3 or 4 with exactly one team)');
    }

    const teamData = data.teams[0];

    // If team already exists, cascade delete first
    const existing = this.loadTeams().find(t => t.slug === teamData.slug);
    if (existing) {
      this.deleteTeam(teamData.slug);
    }

    this._importTeamData(teamData, data.version);

    return {
      teamSlug: teamData.slug,
      seasonSlugs: (teamData.seasons || []).map(s => s.slug),
    };
  },

  /** Internal: write a single team's data into localStorage. Migrates v3 games to v4. */
  _importTeamData(teamData, version) {
    this.addTeam({ slug: teamData.slug, name: teamData.name });

    for (const seasonData of (teamData.seasons || [])) {
      this.addSeason(teamData.slug, {
        slug: seasonData.slug,
        name: seasonData.name,
        preset: seasonData.preset || null,
        positions: seasonData.positions || [],
      });

      if (seasonData.roster) {
        this.saveRoster(teamData.slug, seasonData.slug, seasonData.roster);
      }

      if (Array.isArray(seasonData.games) && seasonData.games.length > 0) {
        // Migrate v3 games to v4 on import
        const games = (version === 3) ? migrateGamesToV4(seasonData.games) : seasonData.games;
        localStorage.setItem(
          this._key(teamData.slug, seasonData.slug, 'games'),
          JSON.stringify(games)
        );
      }

      if (Array.isArray(seasonData.plays) && seasonData.plays.length > 0) {
        this.savePlays(teamData.slug, seasonData.slug, seasonData.plays);
      }
    }
  },
};
