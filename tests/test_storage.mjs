// tests/test_storage.mjs — Storage layer, CRUD, export (v3), import, stats
import { suite, assert, assertEqual, assertThrows, createContext, run } from './helpers.mjs';

// Fresh context for each suite to avoid state leaks
function freshCtx() { return createContext(); }

suite('slugify');
{
  const ctx = freshCtx();
  assertEqual(run(ctx, "slugify('U10 King Cobras')"), 'u10-king-cobras', 'basic slugify');
  assertEqual(run(ctx, "slugify('  Hello World  ')"), 'hello-world', 'trims and slugifies');
  assertEqual(run(ctx, "slugify('Spring 2026!')"), 'spring-2026', 'strips special chars');
  assertEqual(run(ctx, "slugify('')"), '', 'empty string');
}

suite('Storage — team CRUD');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'King Cobras' })");
  let teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 1, 'one team after add');
  assertEqual(teams[0].slug, 'cobras', 'team slug correct');
  assertEqual(teams[0].name, 'King Cobras', 'team name correct');

  run(ctx, "Storage.addTeam({ slug: 'hawks', name: 'Hawks' })");
  teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 2, 'two teams');

  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'King Cobras Updated' })");
  teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 2, 'still two teams after update');
  assertEqual(teams.find(t => t.slug === 'cobras').name, 'King Cobras Updated', 'name updated');
}

suite('Storage — season CRUD');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'Cobras' })");
  run(ctx, "Storage.addSeason('cobras', { slug: 'spring-2026', name: 'Spring 2026', preset: 'soccer-7v7', positions: ['GK','LB','RB','CM','ST'] })");

  let seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons.length, 1, 'one season');
  assertEqual(seasons[0].slug, 'spring-2026', 'season slug');
  assertEqual(seasons[0].positions.length, 5, 'season positions');
  assertEqual(seasons[0].preset, 'soccer-7v7', 'season preset preserved');

  run(ctx, "Storage.addSeason('cobras', { slug: 'fall-2026', name: 'Fall 2026', preset: 'soccer-7v7', positions: ['GK','LB','RB','CM','ST','LW','RW'] })");
  seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons.length, 2, 'two seasons');
}

suite('Storage — roster save/load');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A','B'] })");

  const roster = { positions: ['A', 'B'], players: { p01: { name: 'Alice', positionWeights: {} } } };
  run(ctx, `Storage.saveRoster('t1', 's1', ${JSON.stringify(roster)})`);

  const loaded = run(ctx, "Storage.loadRoster('t1', 's1')");
  assertEqual(loaded.players.p01.name, 'Alice', 'roster loads correctly');
  assertEqual(loaded.positions, ['A', 'B'], 'positions preserved');

  const none = run(ctx, "Storage.loadRoster('t1', 'nonexistent')");
  assertEqual(none, null, 'missing roster returns null');
}

suite('Storage — game save/load/delete');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A','B'] })");

  const game1 = {
    gameId: '2026-03-25', date: '2026-03-25', numPeriods: 4,
    availablePlayers: ['p01', 'p02', 'p03'],
    periodAssignments: [
      { period: 1, assignments: { A: 'p01', B: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { A: 'p02', B: 'p03' }, bench: ['p01'] },
      { period: 3, assignments: { A: 'p03', B: 'p01' }, bench: ['p02'] },
      { period: 4, assignments: { A: 'p01', B: 'p03' }, bench: ['p02'] },
    ],
  };
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify(game1)})`);

  let games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  assertEqual(games.length, 1, 'one game saved');
  assertEqual(games[0].gameId, '2026-03-25', 'gameId correct');

  const game2 = { ...game1, gameId: '2026-03-25_2' };
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify(game2)})`);
  games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  assertEqual(games.length, 2, 'two games');

  run(ctx, "Storage.deleteGame('t1', 's1', '2026-03-25')");
  games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  assertEqual(games.length, 1, 'one game after delete');
  assertEqual(games[0].gameId, '2026-03-25_2', 'correct game remains');
}

suite('Storage — game sorting');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");

  const base = { numPeriods: 2, availablePlayers: ['p01'], periodAssignments: [] };
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify({ ...base, gameId: '2026-03-28', date: '2026-03-28' })})`);
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify({ ...base, gameId: '2026-03-21', date: '2026-03-21' })})`);
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify({ ...base, gameId: '2026-03-25', date: '2026-03-25' })})`);

  const games = run(ctx, "Storage.loadAllGames('t1', 's1')");
  assertEqual(games.map(g => g.date), ['2026-03-21', '2026-03-25', '2026-03-28'], 'games sorted by date');
}

suite('Storage — getSeasonStats');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['GK','ST'] })");

  const game = {
    gameId: '2026-03-25', date: '2026-03-25', numPeriods: 2,
    availablePlayers: ['p01', 'p02', 'p03'],
    periodAssignments: [
      { period: 1, assignments: { GK: 'p01', ST: 'p02' }, bench: ['p03'] },
      { period: 2, assignments: { GK: 'p03', ST: 'p01' }, bench: ['p02'] },
    ],
  };
  run(ctx, `Storage.saveGame('t1', 's1', ${JSON.stringify(game)})`);

  const stats = run(ctx, "Storage.getSeasonStats('t1', 's1')");
  assertEqual(stats.p01.gamesAttended, 1, 'p01 attended 1 game');
  assertEqual(stats.p01.totalPeriodsPlayed, 2, 'p01 played 2 periods');
  assertEqual(stats.p01.totalPeriodsAvailable, 2, 'p01 available 2 periods');
  assertEqual(stats.p01.periodsByPosition.GK, 1, 'p01 played GK once');
  assertEqual(stats.p01.periodsByPosition.ST, 1, 'p01 played ST once');
  assertEqual(stats.p02.totalPeriodsPlayed, 1, 'p02 played 1 period');
  assertEqual(stats.p03.totalPeriodsPlayed, 1, 'p03 played 1 period');
}

suite('Storage — deleteTeam cascades');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");
  run(ctx, "Storage.saveRoster('t1', 's1', { positions: ['A'], players: { p01: { name: 'A', positionWeights: {} } } })");
  run(ctx, `Storage.saveGame('t1', 's1', { gameId: 'g1', date: '2026-01-01', numPeriods: 1, availablePlayers: ['p01'], periodAssignments: [] })`);

  run(ctx, "Storage.deleteTeam('t1')");

  assertEqual(run(ctx, 'Storage.loadTeams()'), [], 'team deleted');
  assertEqual(run(ctx, "Storage.loadSeasons('t1')"), [], 'seasons cleared');
  assertEqual(run(ctx, "Storage.loadRoster('t1', 's1')"), null, 'roster cleared');
  assertEqual(run(ctx, "Storage.loadAllGames('t1', 's1')"), [], 'games cleared');
}

suite('Storage — deleteSeason cleanup');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");
  run(ctx, "Storage.addSeason('t1', { slug: 's2', name: 'S2', positions: ['B'] })");

  run(ctx, "Storage.deleteSeason('t1', 's1')");

  const seasons = run(ctx, "Storage.loadSeasons('t1')");
  assertEqual(seasons.length, 1, 'one season remains');
  assertEqual(seasons[0].slug, 's2', 'correct season remains');
}

suite('Storage — plays save/load');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");

  const plays = [{ id: 'play1', name: 'Sweep Left', dotPositions: {} }];
  run(ctx, `Storage.savePlays('t1', 's1', ${JSON.stringify(plays)})`);

  const loaded = run(ctx, "Storage.loadPlays('t1', 's1')");
  assertEqual(loaded.length, 1, 'one play loaded');
  assertEqual(loaded[0].name, 'Sweep Left', 'play name correct');

  const empty = run(ctx, "Storage.loadPlays('t1', 'nonexistent')");
  assertEqual(empty, [], 'non-existent returns empty array');
}

suite('Storage — context save/load');
{
  const ctx = freshCtx();
  run(ctx, "Storage.saveContext({ teamSlug: 't1', seasonSlug: 's1' })");
  const loaded = run(ctx, 'Storage.loadContext()');
  assertEqual(loaded, { teamSlug: 't1', seasonSlug: 's1' }, 'context round-trips');
}

// ── v3 Export Tests ─────────────────────────────────────────────

suite('Storage — exportTeam v4 format');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'Cobras' })");
  run(ctx, "Storage.addSeason('cobras', { slug: 's1', name: 'Spring', preset: 'soccer-7v7', positions: ['GK','LB','RB','CM','ST','LW','RW'] })");
  run(ctx, "Storage.saveRoster('cobras', 's1', { positions: ['GK','LB','RB','CM','ST','LW','RW'], players: { p01: { name: 'X', positionWeights: {} } } })");
  run(ctx, `Storage.savePlays('cobras', 's1', [{ id: 'play1', name: 'Corner', formation: 0, positions: {} }])`);

  const exported = run(ctx, "Storage.exportTeam('cobras')");
  assertEqual(exported.version, 4, 'export version is 4');
  assertEqual(exported.app, 'roster-rotation', 'app field present');
  assert(exported.exportedAt, 'has exportedAt timestamp');
  assertEqual(exported.teams.length, 1, 'one team exported');
  assertEqual(exported.teams[0].slug, 'cobras', 'team slug in export');
  assertEqual(exported.teams[0].seasons.length, 1, 'one season in export');
  assert(exported.teams[0].seasons[0].roster, 'season includes roster');
  assertEqual(exported.teams[0].seasons[0].preset, 'soccer-7v7', 'preset preserved');
  assertEqual(exported.teams[0].seasons[0].plays.length, 1, 'plays included');
  assertEqual(exported.context, undefined, 'no context in team export');
  assertEqual(exported.standalonePlays, undefined, 'no standalonePlays in team export');
}

suite('Storage — exportTeam returns null for missing team');
{
  const ctx = freshCtx();
  const result = run(ctx, "Storage.exportTeam('nonexistent')");
  assertEqual(result, null, 'returns null for missing team');
}

suite('Storage — exportAll v4 format');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addTeam({ slug: 't2', name: 'T2' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', preset: 'soccer-5v5', positions: ['GK','LB','RB','CM','ST'] })");
  run(ctx, "Storage.addSeason('t2', { slug: 's2', name: 'S2', preset: 'basketball', positions: ['PG','SG','SF','PF','C'] })");
  run(ctx, "Storage.saveContext({ teamSlug: 't1', seasonSlug: 's1' })");
  run(ctx, `Storage.savePlays('__standalone__', '__standalone__', [{ id: 'sp1', name: 'Quick Play', formation: 0, positions: {} }])`);

  const exported = run(ctx, 'Storage.exportAll()');
  assertEqual(exported.version, 4, 'export version is 4');
  assertEqual(exported.app, 'roster-rotation', 'app field present');
  assertEqual(exported.teams.length, 2, 'two teams exported');
  assertEqual(exported.context, { teamSlug: 't1', seasonSlug: 's1' }, 'context included');
  assertEqual(exported.standalonePlays.length, 1, 'standalone plays included');
  assertEqual(exported.standalonePlays[0].id, 'sp1', 'standalone play data correct');
  assertEqual(exported.teams[0].seasons[0].preset, 'soccer-5v5', 'preset on season t1');
  assertEqual(exported.teams[1].seasons[0].preset, 'basketball', 'preset on season t2');
}

suite('Storage — exportAll empty arrays not undefined');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");
  run(ctx, "Storage.saveRoster('t1', 's1', { positions: ['A'], players: {} })");

  const exported = run(ctx, 'Storage.exportAll()');
  const season = exported.teams[0].seasons[0];
  assert(Array.isArray(season.games), 'games is array not undefined');
  assert(Array.isArray(season.plays), 'plays is array not undefined');
  assertEqual(season.games.length, 0, 'games is empty array');
  assertEqual(season.plays.length, 0, 'plays is empty array');
  assert(Array.isArray(exported.standalonePlays), 'standalonePlays is array');
}

// ── clearAll Tests ──────────────────────────────────────────────

suite('Storage — clearAll');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 't1', name: 'T1' })");
  run(ctx, "Storage.addSeason('t1', { slug: 's1', name: 'S1', positions: ['A'] })");
  run(ctx, "Storage.saveRoster('t1', 's1', { positions: ['A'], players: { p01: { name: 'X', positionWeights: {} } } })");
  run(ctx, "Storage.saveContext({ teamSlug: 't1', seasonSlug: 's1' })");
  run(ctx, `localStorage.setItem('rot_settings', '{"theme":"light"}')`);

  run(ctx, 'Storage.clearAll()');

  assertEqual(run(ctx, 'Storage.loadTeams()'), [], 'teams empty after clearAll');
  assertEqual(run(ctx, "Storage.loadSeasons('t1')"), [], 'seasons empty after clearAll');
  assertEqual(run(ctx, "Storage.loadRoster('t1', 's1')"), null, 'roster null after clearAll');
  assertEqual(run(ctx, 'Storage.loadContext()'), null, 'context null after clearAll');
  assertEqual(run(ctx, `localStorage.getItem('rot_settings')`), '{"theme":"light"}', 'settings preserved after clearAll');
}

// ── importBackup Tests ──────────────────────────────────────────

suite('Storage — importBackup full restore');
{
  const ctx = freshCtx();
  // Pre-existing data that should be wiped
  run(ctx, "Storage.addTeam({ slug: 'old', name: 'Old Team' })");
  run(ctx, "Storage.addSeason('old', { slug: 'old-s', name: 'Old Season', positions: ['X'] })");

  const backup = {
    version: 3,
    app: 'roster-rotation',
    exportedAt: '2026-03-26T00:00:00.000Z',
    context: { teamSlug: 'cobras', seasonSlug: 'spring' },
    teams: [
      {
        slug: 'cobras', name: 'Cobras',
        seasons: [{
          slug: 'spring', name: 'Spring 2026',
          preset: 'soccer-7v7',
          positions: ['GK','LB','RB','CM','ST','LW','RW'],
          roster: { positions: ['GK','LB','RB','CM','ST','LW','RW'], players: { p01: { name: 'Alex', positionWeights: {} } } },
          games: [{ gameId: '2026-03-25', date: '2026-03-25', numPeriods: 4, availablePlayers: ['p01'], periodAssignments: [] }],
          plays: [{ id: 'play1', name: 'Corner', formation: 0, positions: {} }],
        }],
      },
    ],
    standalonePlays: [{ id: 'sp1', name: 'Quick', formation: 0, positions: {} }],
  };

  const result = run(ctx, `Storage.importBackup(${JSON.stringify(backup)})`);

  // Old data is gone
  assertEqual(run(ctx, "Storage.loadSeasons('old')"), [], 'old team seasons cleared');

  // New data is present
  const teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 1, 'one team after restore');
  assertEqual(teams[0].slug, 'cobras', 'correct team restored');

  const seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons.length, 1, 'one season restored');
  assertEqual(seasons[0].preset, 'soccer-7v7', 'preset restored');

  const roster = run(ctx, "Storage.loadRoster('cobras', 'spring')");
  assertEqual(roster.players.p01.name, 'Alex', 'roster restored');

  const games = run(ctx, "Storage.loadAllGames('cobras', 'spring')");
  assertEqual(games.length, 1, 'games restored');

  const plays = run(ctx, "Storage.loadPlays('cobras', 'spring')");
  assertEqual(plays.length, 1, 'plays restored');

  const standalone = run(ctx, "Storage.loadPlays('__standalone__', '__standalone__')");
  assertEqual(standalone.length, 1, 'standalone plays restored');

  assertEqual(result.context, { teamSlug: 'cobras', seasonSlug: 'spring' }, 'context returned');
  assertEqual(run(ctx, 'Storage.loadContext()'), { teamSlug: 'cobras', seasonSlug: 'spring' }, 'context saved');
}

suite('Storage — importBackup rejects invalid format');
{
  const ctx = freshCtx();
  assertThrows(
    () => run(ctx, "Storage.importBackup({ version: 2, teams: [] })"),
    'rejects version 2'
  );
  assertThrows(
    () => run(ctx, "Storage.importBackup({ version: 3 })"),
    'rejects missing teams array'
  );
}

suite('Storage — importBackup with null context and empty data');
{
  const ctx = freshCtx();
  const backup = {
    version: 3, app: 'roster-rotation',
    exportedAt: '2026-03-26T00:00:00.000Z',
    context: null, teams: [], standalonePlays: [],
  };

  const result = run(ctx, `Storage.importBackup(${JSON.stringify(backup)})`);
  assertEqual(result.context, null, 'null context accepted');
  assertEqual(run(ctx, 'Storage.loadTeams()'), [], 'empty backup produces empty state');
}

// ── importSharedTeam Tests ──────────────────────────────────────

suite('Storage — importSharedTeam adds new team');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'hawks', name: 'Hawks' })");
  run(ctx, "Storage.addSeason('hawks', { slug: 'h-s1', name: 'H Season', positions: ['A'] })");

  const shared = {
    version: 3, app: 'roster-rotation',
    exportedAt: '2026-03-26T00:00:00.000Z',
    teams: [{
      slug: 'cobras', name: 'Cobras',
      seasons: [{
        slug: 'spring', name: 'Spring',
        preset: 'soccer-7v7',
        positions: ['GK','LB','RB','CM','ST','LW','RW'],
        roster: { positions: ['GK','LB','RB','CM','ST','LW','RW'], players: { p01: { name: 'Z', positionWeights: {} } } },
        games: [], plays: [],
      }],
    }],
  };

  const result = run(ctx, `Storage.importSharedTeam(${JSON.stringify(shared)})`);

  const teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 2, 'two teams: hawks + cobras');
  assert(teams.find(t => t.slug === 'hawks'), 'hawks untouched');

  const seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons.length, 1, 'cobras season added');
  assertEqual(result.teamSlug, 'cobras', 'returns team slug');
  assertEqual(result.seasonSlugs, ['spring'], 'returns season slugs');
}

suite('Storage — importSharedTeam replaces existing team');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'Old Cobras' })");
  run(ctx, "Storage.addSeason('cobras', { slug: 'old-season', name: 'Old', positions: ['X'] })");
  run(ctx, "Storage.saveRoster('cobras', 'old-season', { positions: ['X'], players: { p99: { name: 'Old', positionWeights: {} } } })");

  const shared = {
    version: 3, app: 'roster-rotation',
    exportedAt: '2026-03-26T00:00:00.000Z',
    teams: [{
      slug: 'cobras', name: 'New Cobras',
      seasons: [{
        slug: 'new-season', name: 'New',
        preset: 'soccer-5v5',
        positions: ['GK','LB','RB','CM','ST'],
        roster: { positions: ['GK','LB','RB','CM','ST'], players: { p01: { name: 'New Player', positionWeights: {} } } },
        games: [], plays: [],
      }],
    }],
  };

  run(ctx, `Storage.importSharedTeam(${JSON.stringify(shared)})`);

  const teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 1, 'still one team');
  assertEqual(teams[0].name, 'New Cobras', 'team name updated');

  assertEqual(run(ctx, "Storage.loadRoster('cobras', 'old-season')"), null, 'old season roster cleared');

  const seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons.length, 1, 'one new season');
  assertEqual(seasons[0].slug, 'new-season', 'new season slug');
  assertEqual(seasons[0].preset, 'soccer-5v5', 'new preset');

  const roster = run(ctx, "Storage.loadRoster('cobras', 'new-season')");
  assertEqual(roster.players.p01.name, 'New Player', 'new roster loaded');
}

suite('Storage — importSharedTeam rejects invalid format');
{
  const ctx = freshCtx();
  assertThrows(
    () => run(ctx, "Storage.importSharedTeam({ version: 3, teams: [] })"),
    'rejects zero teams'
  );
  assertThrows(
    () => run(ctx, `Storage.importSharedTeam({ version: 3, teams: [{slug:'a'},{slug:'b'}] })`),
    'rejects two teams'
  );
  assertThrows(
    () => run(ctx, "Storage.importSharedTeam({ version: 2, teams: [{slug:'a'}] })"),
    'rejects version 2'
  );
}

// ── Roundtrip Tests ─────────────────────────────────────────────

suite('Storage — exportAll → importBackup roundtrip');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'Cobras' })");
  run(ctx, "Storage.addSeason('cobras', { slug: 'spring', name: 'Spring', preset: 'soccer-7v7', positions: ['GK','LB','RB','CM','ST','LW','RW'] })");
  run(ctx, `Storage.saveRoster('cobras', 'spring', { positions: ['GK','LB','RB','CM','ST','LW','RW'], players: { p01: { name: 'Alex', positionWeights: { GK: 3 } } } })`);
  run(ctx, `Storage.saveGame('cobras', 'spring', { gameId: '2026-03-25', date: '2026-03-25', numPeriods: 4, availablePlayers: ['p01'], periodAssignments: [] })`);
  run(ctx, `Storage.savePlays('cobras', 'spring', [{ id: 'play1', name: 'Corner', formation: 0, positions: {} }])`);
  run(ctx, `Storage.savePlays('__standalone__', '__standalone__', [{ id: 'sp1', name: 'Quick', formation: 0, positions: {} }])`);
  run(ctx, "Storage.saveContext({ teamSlug: 'cobras', seasonSlug: 'spring' })");

  const exported = run(ctx, 'Storage.exportAll()');

  run(ctx, 'Storage.clearAll()');
  assertEqual(run(ctx, 'Storage.loadTeams()'), [], 'empty after clear');

  run(ctx, `Storage.importBackup(${JSON.stringify(exported)})`);

  const teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 1, 'roundtrip: team count');
  assertEqual(teams[0].name, 'Cobras', 'roundtrip: team name');

  const seasons = run(ctx, "Storage.loadSeasons('cobras')");
  assertEqual(seasons[0].preset, 'soccer-7v7', 'roundtrip: preset');

  const roster = run(ctx, "Storage.loadRoster('cobras', 'spring')");
  assertEqual(roster.players.p01.positionWeights.GK, 3, 'roundtrip: position weights');

  assertEqual(run(ctx, "Storage.loadAllGames('cobras', 'spring')").length, 1, 'roundtrip: games');
  assertEqual(run(ctx, "Storage.loadPlays('cobras', 'spring')").length, 1, 'roundtrip: plays');
  assertEqual(run(ctx, "Storage.loadPlays('__standalone__', '__standalone__')").length, 1, 'roundtrip: standalone plays');
  assertEqual(run(ctx, 'Storage.loadContext()'), { teamSlug: 'cobras', seasonSlug: 'spring' }, 'roundtrip: context');
}

suite('Storage — exportTeam → importSharedTeam roundtrip');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'cobras', name: 'Cobras' })");
  run(ctx, "Storage.addSeason('cobras', { slug: 'spring', name: 'Spring', preset: 'soccer-7v7', positions: ['GK','LB','RB','CM','ST','LW','RW'] })");
  run(ctx, `Storage.saveRoster('cobras', 'spring', { positions: ['GK','LB','RB','CM','ST','LW','RW'], players: { p01: { name: 'Alex', positionWeights: {} } } })`);

  const exported = run(ctx, "Storage.exportTeam('cobras')");

  run(ctx, "Storage.deleteTeam('cobras')");
  assertEqual(run(ctx, 'Storage.loadTeams()'), [], 'team deleted');

  run(ctx, `Storage.importSharedTeam(${JSON.stringify(exported)})`);

  const teams = run(ctx, 'Storage.loadTeams()');
  assertEqual(teams.length, 1, 'share roundtrip: team back');
  assertEqual(teams[0].name, 'Cobras', 'share roundtrip: name');

  const roster = run(ctx, "Storage.loadRoster('cobras', 'spring')");
  assertEqual(roster.players.p01.name, 'Alex', 'share roundtrip: roster');
}

suite('Storage — archived flag preserved in export/import roundtrip');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'archive-rt', name: 'Archive RT' })");
  run(ctx, "Storage.addSeason('archive-rt', { slug: 's1', name: 'S1', preset: 'soccer-7v7', positions: ['GK','CB','LB'] })");
  run(ctx, `Storage.saveRoster('archive-rt', 's1', {
    positions: ['GK','CB','LB'],
    players: {
      p01: { name: 'Alex', positionWeights: {} },
      p02: { name: 'Jordan', positionWeights: {}, archived: true },
      p03: { name: 'Sam', positionWeights: { GK: 0 } },
    }
  })`);

  // Full backup roundtrip
  const exported = run(ctx, "Storage.exportAll()");
  run(ctx, `Storage.importBackup(${JSON.stringify(exported)})`);

  const roster = run(ctx, "Storage.loadRoster('archive-rt', 's1')");
  assertEqual(roster.players.p01.name, 'Alex', 'active player preserved');
  assertEqual(roster.players.p01.archived, undefined, 'active player has no archived flag');
  assertEqual(roster.players.p02.name, 'Jordan', 'archived player name preserved');
  assertEqual(roster.players.p02.archived, true, 'archived flag preserved after backup roundtrip');
  assertEqual(roster.players.p03.name, 'Sam', 'third player preserved');
  assertEqual(roster.players.p03.archived, undefined, 'non-archived player has no archived flag');
}

suite('Storage — archived flag preserved in shared team roundtrip');
{
  const ctx = freshCtx();
  run(ctx, "Storage.addTeam({ slug: 'share-arch', name: 'Share Arch' })");
  run(ctx, "Storage.addSeason('share-arch', { slug: 's1', name: 'S1', positions: ['GK','CB'] })");
  run(ctx, `Storage.saveRoster('share-arch', 's1', {
    positions: ['GK','CB'],
    players: {
      p01: { name: 'Active', positionWeights: {} },
      p02: { name: 'Archived', positionWeights: {}, archived: true },
    }
  })`);

  const exported = run(ctx, "Storage.exportTeam('share-arch')");
  run(ctx, "Storage.deleteTeam('share-arch')");
  run(ctx, `Storage.importSharedTeam(${JSON.stringify(exported)})`);

  const roster = run(ctx, "Storage.loadRoster('share-arch', 's1')");
  assertEqual(roster.players.p01.archived, undefined, 'active player still active after share roundtrip');
  assertEqual(roster.players.p02.archived, true, 'archived flag preserved after share roundtrip');
  assertEqual(roster.players.p02.name, 'Archived', 'archived player name preserved after share roundtrip');
}

suite('Storage — old data without archived field imports cleanly');
{
  const ctx = freshCtx();
  // Simulate old v3 data with no archived flags
  const oldData = {
    version: 3, app: 'roster-rotation',
    exportedAt: '2026-01-01T00:00:00Z',
    context: null, teams: [{
      slug: 'old-team', name: 'Old Team',
      seasons: [{
        slug: 's1', name: 'S1', preset: 'soccer-7v7',
        positions: ['GK','CB','LB'],
        roster: {
          positions: ['GK','CB','LB'],
          players: {
            p01: { name: 'OldPlayer', positionWeights: {} },
          }
        },
        games: [], plays: [],
      }]
    }],
    standalonePlays: [],
  };

  run(ctx, `Storage.importBackup(${JSON.stringify(oldData)})`);
  const roster = run(ctx, "Storage.loadRoster('old-team', 's1')");
  assertEqual(roster.players.p01.name, 'OldPlayer', 'old data player name preserved');
  assertEqual(roster.players.p01.archived, undefined, 'old data has no archived flag (treated as active)');
}

export default function run_storage_tests() {}
