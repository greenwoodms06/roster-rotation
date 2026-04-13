/**
 * engine.js -- Rotation Engine
 * Pure algorithm, zero dependencies. Generates fair lineup rotations.
 * Requires: DEFAULT_POSITIONS from formations.js
 *
 * Constraints (all optional, defaults match pre-constraint behavior):
 *   locks: [{ pid, position }]     -- player pinned to a position every period they play
 *   continuity: 0|1|2              -- 0=off, 1=medium, 2=high position stickiness
 *   positionMax: { pos: number }   -- max periods any player can play a given position
 *   specialPosMax: null|number     -- DEPRECATED, converted to positionMax for positions[0]
 *   maxSubsPerBreak: null|number   -- max subs out between consecutive periods (null = no limit).
 *                                     Soft constraint: relaxes if hold-over pool is exhausted
 *                                     (e.g., all prior players hit globalMaxPeriods cap).
 */

class RotationEngine {
  static WEIGHT_SEASON_BALANCE = 3.0;
  static WEIGHT_PREFERENCE = 2.0;
  static WEIGHT_GAME_DIVERSITY = 1.5;
  static EXCLUSION_COST = 1e9;

  // Continuity presets: [continuityWeight, gameDiversityWeight]
  static CONTINUITY_PRESETS = [
    [0,   1.5],  // 0 = Off (current behavior)
    [2.0, 0.5],  // 1 = Medium
    [4.0, 0.0],  // 2 = High
  ];

  constructor(roster, seasonStats) {
    this.roster = roster;
    this.seasonStats = seasonStats || {};
    this.positions = roster.positions || DEFAULT_POSITIONS;
    this.numPositions = this.positions.length;
  }

  generateGamePlan(date, availableIds, numPeriods, firstAvailableStart = false, constraints = {}) {
    if (availableIds.length < this.numPositions) {
      throw new Error(
        `Need at least ${this.numPositions} players, got ${availableIds.length}`
      );
    }

    // Normalize constraints with defaults
    const locks = constraints.locks || [];
    const continuity = constraints.continuity || 0;
    const globalMaxPeriods = constraints.globalMaxPeriods || null;
    const maxSubsPerBreak = constraints.maxSubsPerBreak ?? null;
    // Support both new positionMax map and deprecated specialPosMax
    let positionMax = constraints.positionMax || {};
    if (constraints.specialPosMax != null && Object.keys(positionMax).length === 0) {
      positionMax = { [this.positions[0]]: constraints.specialPosMax };
    }

    // Validate locks
    this._validateLocks(locks, availableIds);

    const periodsPerPlayer = this._allocatePlayingTime(availableIds, numPeriods, globalMaxPeriods, firstAvailableStart);
    const periodRosters = this._schedulePeriods(
      availableIds, periodsPerPlayer, numPeriods, firstAvailableStart, [], maxSubsPerBreak
    );

    const gamePositionCounts = {};
    availableIds.forEach(pid => (gamePositionCounts[pid] = {}));

    // Resolve continuity weights
    const preset = RotationEngine.CONTINUITY_PRESETS[continuity] || RotationEngine.CONTINUITY_PRESETS[0];
    const continuityWeight = preset[0];
    const gameDiversityWeight = preset[1];

    const periodAssignments = [];
    let prevAssignments = null; // previous period's {position: pid} map

    for (let i = 0; i < periodRosters.length; i++) {
      const periodPlayers = periodRosters[i];
      const assignments = this._assignPositions(
        periodPlayers, gamePositionCounts, {
          locks,
          prevAssignments,
          continuityWeight,
          gameDiversityWeight,
          positionMax,
        }
      );
      const bench = availableIds.filter(p => !periodPlayers.includes(p));

      periodAssignments.push({ period: i + 1, assignments, bench });

      for (const [pos, pid] of Object.entries(assignments)) {
        gamePositionCounts[pid][pos] = (gamePositionCounts[pid][pos] || 0) + 1;
      }
      prevAssignments = assignments;
    }

    return {
      date,
      numPeriods,
      availablePlayers: [...availableIds],
      periodAssignments,
    };
  }

  // -- Lock Validation ------------------------------------------------

  _validateLocks(locks, availableIds) {
    if (locks.length === 0) return;

    const availSet = new Set(availableIds);
    const posSet = new Set(this.positions);
    const usedPositions = new Set();

    for (const lock of locks) {
      if (!availSet.has(lock.pid)) {
        throw new Error(
          `Locked player ${lock.pid} is not in the available list`
        );
      }
      if (!posSet.has(lock.position)) {
        throw new Error(
          `Locked position "${lock.position}" is not valid`
        );
      }
      const player = this.roster.players[lock.pid];
      const w = player?.positionWeights?.[lock.position] ?? 1.0;
      if (w === 0) {
        const name = player?.name || lock.pid;
        throw new Error(
          `${name} is excluded from ${lock.position} but locked to it`
        );
      }
      if (usedPositions.has(lock.position)) {
        throw new Error(
          `Multiple players locked to ${lock.position}`
        );
      }
      usedPositions.add(lock.position);
    }
  }

  // -- Phase 1: Playing Time Allocation -----------------------------

  _allocatePlayingTime(availableIds, numPeriods, globalMaxPeriods = null, firstAvailableStart = false) {
    const n = availableIds.length;
    const totalSlots = this.numPositions * numPeriods;
    const cap = (globalMaxPeriods != null && globalMaxPeriods < numPeriods) ? globalMaxPeriods : numPeriods;

    // Non-starters miss period 1, so they can play at most (numPeriods - 1)
    const starterSet = firstAvailableStart
      ? new Set(availableIds.slice(0, this.numPositions))
      : null;
    const playerCap = (pid) => {
      const baseCap = (firstAvailableStart && !starterSet.has(pid))
        ? Math.min(cap, numPeriods - 1)
        : cap;
      return baseCap;
    };

    // Validate: enough player-slots to fill the game
    const totalCapacity = availableIds.reduce((sum, pid) => sum + playerCap(pid), 0);
    if (totalCapacity < totalSlots) {
      throw new Error(
        `Cannot fill all periods: ${totalCapacity} available player-slots, but ${totalSlots} needed`
      );
    }

    let base = Math.floor(totalSlots / n);
    const extra = totalSlots % n;

    const priority = this._rankBySeasonDeficit(availableIds);
    const periodsPerPlayer = {};

    for (let i = 0; i < priority.length; i++) {
      const pid = priority[i];
      const target = base + (i < extra ? 1 : 0);
      periodsPerPlayer[pid] = Math.min(target, playerCap(pid));
    }

    // If capping reduced total slots below totalSlots, redistribute
    let assigned = Object.values(periodsPerPlayer).reduce((a, b) => a + b, 0);
    if (assigned < totalSlots) {
      // Give extra periods to players with fewest, respecting their cap
      const byCount = priority.slice().sort((a, b) => periodsPerPlayer[a] - periodsPerPlayer[b]);
      for (const pid of byCount) {
        if (assigned >= totalSlots) break;
        if (periodsPerPlayer[pid] < playerCap(pid)) {
          periodsPerPlayer[pid]++;
          assigned++;
        }
      }
    }

    return periodsPerPlayer;
  }

  _rankBySeasonDeficit(availableIds) {
    const scored = availableIds.map(pid => {
      const s = this.seasonStats[pid];
      let score;
      if (s && s.gamesAttended > 0) {
        score = s.totalPeriodsAvailable > 0
          ? s.totalPeriodsPlayed / s.totalPeriodsAvailable
          : 0;
      } else {
        score = -1;
      }
      return { pid, score };
    });
    scored.sort((a, b) => a.score - b.score);
    return scored.map(s => s.pid);
  }

  // -- Phase 2: Period Scheduling -----------------------------------

  /**
   * Assign players to periods.
   * @param {string[]} availableIds
   * @param {object} periodsPerPlayer — {pid: count} from Phase 1
   * @param {number} numPeriods
   * @param {boolean} firstAvailableStart
   * @param {string[][]} [priorRosters=[]] — rosters from frozen periods (for rebalance
   *   spacing continuity). Each element is an array of player IDs who played that period.
   */
  _schedulePeriods(availableIds, periodsPerPlayer, numPeriods, firstAvailableStart, priorRosters = [], maxSubsPerBreak = null) {
    const remaining = { ...periodsPerPlayer };
    const periodRosters = Array.from({ length: numPeriods }, () => []);
    const N = this.numPositions;
    const holdMin = (maxSubsPerBreak != null)
      ? Math.max(0, N - maxSubsPerBreak)
      : 0;

    // Spacing trackers: seed from prior (frozen) periods if provided
    const lastPlayedPeriod = {};   // period index when player last played (-1 = never)
    const consecutivePlays = {};   // how many periods in a row the player has played
    const availSet = new Set(availableIds);
    availableIds.forEach(pid => {
      lastPlayedPeriod[pid] = -1;
      consecutivePlays[pid] = 0;
    });

    // Seed spacing state from frozen periods (negative indices: -priorRosters.length .. -1)
    for (let i = 0; i < priorRosters.length; i++) {
      const priorPeriod = i - priorRosters.length; // negative index relative to period 0
      const playedSet = new Set(priorRosters[i]);
      for (const pid of availableIds) {
        if (playedSet.has(pid)) {
          lastPlayedPeriod[pid] = priorPeriod;
          consecutivePlays[pid]++;
        } else {
          consecutivePlays[pid] = 0;
        }
      }
    }

    let startPeriod = 0;
    if (firstAvailableStart && numPeriods > 0) {
      const starters = availableIds.slice(0, this.numPositions);
      periodRosters[0] = [...starters];
      starters.forEach(pid => {
        remaining[pid]--;
        lastPlayedPeriod[pid] = 0;
        consecutivePlays[pid]++;
      });
      // Non-starters sit period 0 — reset their consecutive streak
      availableIds.forEach(pid => {
        if (!starters.includes(pid)) consecutivePlays[pid] = 0;
      });
      startPeriod = 1;
    }

    for (let period = startPeriod; period < numPeriods; period++) {
      const candidates = availableIds.filter(pid => remaining[pid] > 0);
      const periodsLeftAfter = numPeriods - period - 1;

      const cmp = (a, b) => {
        // Primary: urgency (must play soon or will run out of periods)
        const urgA = remaining[a] - periodsLeftAfter;
        const urgB = remaining[b] - periodsLeftAfter;
        if (urgA !== urgB) return urgB - urgA;
        // Secondary: more remaining periods first (redundant when urgency ties,
        // but kept for clarity)
        if (remaining[a] !== remaining[b]) return remaining[b] - remaining[a];
        // Tertiary: spacing — prefer players who sat longer (spread rest periods)
        const gapA = period - lastPlayedPeriod[a];
        const gapB = period - lastPlayedPeriod[b];
        if (gapA !== gapB) return gapB - gapA;
        // Quaternary: fatigue — prefer players with fewer consecutive plays
        return consecutivePlays[a] - consecutivePlays[b];
      };
      candidates.sort(cmp);

      // Determine prior-period roster for sub-cap hold-over floor.
      // Sources, in order: previous scheduled period, starters (firstAvailableStart),
      // or last frozen roster (rebalance across freeze boundary).
      let priorRoster = null;
      if (period > 0 && periodRosters[period - 1].length > 0) {
        priorRoster = periodRosters[period - 1];
      } else if (period === 0 && priorRosters.length > 0) {
        priorRoster = priorRosters[priorRosters.length - 1];
      }

      let selected;
      if (holdMin > 0 && priorRoster) {
        const priorSet = new Set(priorRoster);
        // Sub-cap wins over equal-time: allow hold-overs past their quota
        // rather than drop below the floor. Comparator naturally demotes
        // exhausted players (urgency = -periodsLeftAfter), so fresh players
        // are picked first.
        const holdPool = availableIds.filter(pid => priorSet.has(pid));
        holdPool.sort(cmp);
        const actualHold = Math.min(holdMin, holdPool.length);
        const holdovers = holdPool.slice(0, actualHold);
        const usedSet = new Set(holdovers);
        // Fill remaining slots: prefer eligible (remaining>0), fall back to any.
        const fillPrimary = candidates.filter(pid => !usedSet.has(pid));
        fillPrimary.sort(cmp);
        const filled = [...holdovers, ...fillPrimary.slice(0, N - actualHold)];
        if (filled.length < N) {
          const fillFallback = availableIds
            .filter(pid => !usedSet.has(pid) && !fillPrimary.includes(pid));
          fillFallback.sort(cmp);
          filled.push(...fillFallback.slice(0, N - filled.length));
        }
        selected = filled;
      } else {
        selected = candidates.slice(0, N);
      }
      const selectedSet = new Set(selected);
      periodRosters[period] = selected;

      // Update trackers
      for (const pid of availableIds) {
        if (selectedSet.has(pid)) {
          remaining[pid]--;
          lastPlayedPeriod[pid] = period;
          consecutivePlays[pid]++;
        } else if (remaining[pid] >= 0) {
          // Player sat this period — reset consecutive streak
          consecutivePlays[pid] = 0;
        }
      }
    }

    return periodRosters;
  }

  // -- Phase 3: Position Assignment ---------------------------------

  _assignPositions(periodPlayers, gamePositionCounts, opts = {}) {
    const locks = opts.locks || [];
    const prevAssignments = opts.prevAssignments || null;
    const continuityWeight = opts.continuityWeight || 0;
    const gameDiversityWeight = opts.gameDiversityWeight ?? RotationEngine.WEIGHT_GAME_DIVERSITY;
    const positionMax = opts.positionMax || {};

    // Separate locked players from free players for this period
    const periodPlayerSet = new Set(periodPlayers);
    const activeLocks = locks.filter(l => periodPlayerSet.has(l.pid));

    const lockedPids = new Set(activeLocks.map(l => l.pid));
    const lockedPositions = new Set(activeLocks.map(l => l.position));

    const freePlayers = periodPlayers.filter(pid => !lockedPids.has(pid));
    const freePositionIndices = [];
    const freePositions = [];
    for (let j = 0; j < this.numPositions; j++) {
      if (!lockedPositions.has(this.positions[j])) {
        freePositionIndices.push(j);
        freePositions.push(this.positions[j]);
      }
    }

    // Build cost matrix for free players x free positions
    const n = freePlayers.length;
    const costMatrix = this._buildCostMatrix(
      freePlayers, freePositionIndices, gamePositionCounts, {
        prevAssignments,
        continuityWeight,
        gameDiversityWeight,
        positionMax,
      }
    );

    // Find best permutation of free players to free positions
    let bestCost = Infinity;
    let bestPerm = null;

    if (n > 0) {
      const perm = Array.from({ length: n }, (_, i) => i);
      const permute = (arr, l = 0) => {
        if (l === arr.length - 1) {
          let cost = 0;
          for (let i = 0; i < n; i++) cost += costMatrix[i][arr[i]];
          if (cost < bestCost) {
            bestCost = cost;
            bestPerm = [...arr];
          }
          return;
        }
        for (let i = l; i < arr.length; i++) {
          [arr[l], arr[i]] = [arr[i], arr[l]];
          permute(arr, l + 1);
          [arr[l], arr[i]] = [arr[i], arr[l]];
        }
      };
      permute(perm);
    }

    // Build final assignment map
    const assignments = {};

    // Add locked assignments
    for (const lock of activeLocks) {
      assignments[lock.position] = lock.pid;
    }

    // Add free player assignments
    if (bestPerm) {
      for (let i = 0; i < n; i++) {
        const posIdx = freePositionIndices[bestPerm[i]];
        assignments[this.positions[posIdx]] = freePlayers[i];
      }
    }

    return assignments;
  }

  _buildCostMatrix(players, positionIndices, gamePositionCounts, opts = {}) {
    const n = players.length;
    const numPos = positionIndices.length;
    const prevAssignments = opts.prevAssignments || null;
    const continuityWeight = opts.continuityWeight || 0;
    const gameDiversityWeight = opts.gameDiversityWeight ?? RotationEngine.WEIGHT_GAME_DIVERSITY;
    const positionMax = opts.positionMax || {};

    // Build reverse lookup: pid > position from previous period
    let prevPosForPlayer = null;
    if (prevAssignments && continuityWeight > 0) {
      prevPosForPlayer = {};
      for (const [pos, pid] of Object.entries(prevAssignments)) {
        prevPosForPlayer[pid] = pos;
      }
    }

    const matrix = Array.from({ length: n }, () =>
      new Array(numPos).fill(0)
    );

    for (let i = 0; i < n; i++) {
      const pid = players[i];
      const player = this.roster.players[pid];
      const weights = player.positionWeights || {};
      const stats = this.seasonStats[pid];

      const eligible = {};
      for (const pos of this.positions) {
        const w = weights[pos] ?? 1.0;
        if (w !== 0) eligible[pos] = w;
      }
      const totalWeight = Object.values(eligible).reduce((a, b) => a + b, 0);
      const maxW = Math.max(...Object.values(eligible), 1);

      for (let j = 0; j < numPos; j++) {
        const posIdx = positionIndices[j];
        const pos = this.positions[posIdx];
        const weight = weights[pos] ?? 1.0;

        if (weight === 0) {
          matrix[i][j] = RotationEngine.EXCLUSION_COST;
          continue;
        }

        // Position max check (per-position cap)
        if (positionMax[pos] != null) {
          const timesAtPos = gamePositionCounts[pid]?.[pos] || 0;
          if (timesAtPos >= positionMax[pos]) {
            matrix[i][j] = RotationEngine.EXCLUSION_COST;
            continue;
          }
        }

        let exposureCost = 0;
        if (stats && stats.totalPeriodsPlayed > 0) {
          const actualFrac =
            (stats.periodsByPosition[pos] || 0) / stats.totalPeriodsPlayed;
          const idealFrac = totalWeight > 0 ? weight / totalWeight : 1 / this.numPositions;
          exposureCost = actualFrac - idealFrac;
        }

        const weightCost = maxW > 0 ? 1 - weight / maxW : 0;
        const timesThisGame = gamePositionCounts[pid]?.[pos] || 0;

        // Continuity: reduce cost if player was at this position last period
        let continuityCost = 0;
        if (prevPosForPlayer && continuityWeight > 0) {
          const prevPos = prevPosForPlayer[pid];
          if (prevPos) {
            // Negative cost = bonus for staying at same position
            continuityCost = (prevPos === pos) ? -continuityWeight : 0;
          }
        }

        matrix[i][j] =
          RotationEngine.WEIGHT_SEASON_BALANCE * exposureCost +
          RotationEngine.WEIGHT_PREFERENCE * weightCost +
          gameDiversityWeight * timesThisGame +
          continuityCost +
          Math.random() * 0.01;  // tiebreaker jitter — equally-fair plans vary between generations
      }
    }
    return matrix;
  }

  // -- Rebalance: regenerate from a given period forward ---------------

  /**
   * Re-optimize periods from `fromPeriodIdx` onward, keeping earlier periods frozen.
   * Optionally adds late-arrival players via `newPlayerIds`.
   *
   * @param {object} existingPlan — current game plan
   * @param {number} fromPeriodIdx — 0-based index: periods before this are frozen
   * @param {string[]} newPlayerIds — additional player IDs joining the game (late arrivals)
   * @param {object} constraints — same shape as generateGamePlan constraints
   * @returns {object} — updated plan with merged frozen + regenerated periods
   */
  rebalanceFromPeriod(existingPlan, fromPeriodIdx, newPlayerIds = [], constraints = {}, removedPlayerIds = []) {
    const numPeriods = existingPlan.numPeriods;
    const remainingPeriods = numPeriods - fromPeriodIdx;

    if (remainingPeriods <= 0) {
      throw new Error('No periods remaining to rebalance');
    }

    // All available players = existing + new arrivals - removed
    const removeSet = new Set(removedPlayerIds);
    const allAvailable = [...existingPlan.availablePlayers];
    for (const pid of newPlayerIds) {
      if (!allAvailable.includes(pid)) allAvailable.push(pid);
    }
    // Players available for remaining periods (removed players excluded)
    const remainingAvailable = allAvailable.filter(pid => !removeSet.has(pid));

    if (remainingAvailable.length < this.numPositions) {
      throw new Error(
        `Need at least ${this.numPositions} players, got ${remainingAvailable.length}`
      );
    }

    // Normalize constraints
    const locks = constraints.locks || [];
    const continuity = constraints.continuity || 0;
    const globalMaxPeriods = constraints.globalMaxPeriods || null;
    const maxSubsPerBreak = constraints.maxSubsPerBreak ?? null;
    let positionMax = constraints.positionMax || {};
    if (constraints.specialPosMax != null && Object.keys(positionMax).length === 0) {
      positionMax = { [this.positions[0]]: constraints.specialPosMax };
    }

    this._validateLocks(locks, remainingAvailable);

    // Step 1: Freeze periods before fromPeriodIdx
    const frozen = existingPlan.periodAssignments.slice(0, fromPeriodIdx);

    // Step 2: Count frozen play time and position exposure per player
    const frozenPlayCounts = {};
    const frozenPositionCounts = {};
    for (const pid of allAvailable) {
      frozenPlayCounts[pid] = 0;
      frozenPositionCounts[pid] = {};
    }
    for (const pa of frozen) {
      for (const [pos, val] of Object.entries(pa.assignments)) {
        if (Array.isArray(val)) {
          // v4 format: array of occupant entries with fractional credit
          for (const entry of val) {
            const credit = entry.timeOut - entry.timeIn;
            frozenPlayCounts[entry.pid] = (frozenPlayCounts[entry.pid] || 0) + credit;
            if (!frozenPositionCounts[entry.pid]) frozenPositionCounts[entry.pid] = {};
            frozenPositionCounts[entry.pid][pos] =
              (frozenPositionCounts[entry.pid][pos] || 0) + credit;
          }
        } else {
          // v3 fallback
          frozenPlayCounts[val] = (frozenPlayCounts[val] || 0) + 1;
          if (!frozenPositionCounts[val]) frozenPositionCounts[val] = {};
          frozenPositionCounts[val][pos] = (frozenPositionCounts[val][pos] || 0) + 1;
        }
      }
    }

    // Step 3: Build augmented season stats for fair allocation
    const augStats = {};
    for (const pid of remainingAvailable) {
      const orig = this.seasonStats[pid] || {
        gamesAttended: 0,
        totalPeriodsPlayed: 0,
        totalPeriodsAvailable: 0,
        periodsByPosition: {},
      };
      augStats[pid] = {
        gamesAttended: orig.gamesAttended,
        totalPeriodsPlayed: orig.totalPeriodsPlayed + (frozenPlayCounts[pid] || 0),
        totalPeriodsAvailable: orig.totalPeriodsAvailable + numPeriods,
        periodsByPosition: { ...orig.periodsByPosition },
      };
      // Add frozen position counts to season position counts
      for (const [pos, cnt] of Object.entries(frozenPositionCounts[pid] || {})) {
        augStats[pid].periodsByPosition[pos] =
          (augStats[pid].periodsByPosition[pos] || 0) + cnt;
      }
    }

    // Step 4: Allocate playing time for remaining periods using augmented stats
    const savedStats = this.seasonStats;
    this.seasonStats = augStats;

    const cap = (globalMaxPeriods != null && globalMaxPeriods < numPeriods)
      ? globalMaxPeriods : numPeriods;

    // Allocate for remaining periods, respecting global cap minus frozen plays
    const periodsPerPlayer = {};
    const totalRemainingSlots = this.numPositions * remainingPeriods;
    const totalGameSlots = this.numPositions * numPeriods;

    // Calculate how many more periods each player can play
    const maxRemaining = {};
    for (const pid of remainingAvailable) {
      const alreadyPlayed = frozenPlayCounts[pid] || 0;
      maxRemaining[pid] = Math.min(remainingPeriods, cap - alreadyPlayed);
      if (maxRemaining[pid] < 0) maxRemaining[pid] = 0;
    }

    // Allocate using full-game fairness: compute ideal total, subtract frozen
    const priority = this._rankBySeasonDeficit(remainingAvailable);

    const availCap = remainingAvailable.reduce((sum, pid) => sum + maxRemaining[pid], 0);
    if (availCap < totalRemainingSlots) {
      this.seasonStats = savedStats;
      throw new Error(
        `Cannot fill remaining periods: not enough available player-slots`
      );
    }

    // Compute ideal total periods for full game, then subtract frozen plays
    const n = remainingAvailable.length;
    let idealBase = Math.floor(totalGameSlots / n);
    const idealExtra = totalGameSlots % n;

    for (let i = 0; i < priority.length; i++) {
      const pid = priority[i];
      const idealTotal = idealBase + (i < idealExtra ? 1 : 0);
      const target = Math.max(0, idealTotal - frozenPlayCounts[pid]);
      periodsPerPlayer[pid] = Math.min(target, maxRemaining[pid]);
    }

    // Redistribute if capping reduced total below needed
    let assigned = Object.values(periodsPerPlayer).reduce((a, b) => a + b, 0);
    if (assigned < totalRemainingSlots) {
      const byCount = priority.slice().sort((a, b) => periodsPerPlayer[a] - periodsPerPlayer[b]);
      for (const pid of byCount) {
        if (assigned >= totalRemainingSlots) break;
        if (periodsPerPlayer[pid] < maxRemaining[pid]) {
          periodsPerPlayer[pid]++;
          assigned++;
        }
      }
    }

    // Step 5: Schedule remaining periods (Phase 2)
    // Build frozen rosters for spacing continuity across the rebalance boundary
    const frozenRosters = frozen.map(pa => extractPidsFromAssignments(pa.assignments));
    const periodRosters = this._schedulePeriods(
      remainingAvailable, periodsPerPlayer, remainingPeriods, false, frozenRosters, maxSubsPerBreak
    );

    // Step 6: Assign positions (Phase 3), seeding from frozen data
    const gamePositionCounts = {};
    for (const pid of remainingAvailable) {
      gamePositionCounts[pid] = { ...(frozenPositionCounts[pid] || {}) };
    }

    const preset = RotationEngine.CONTINUITY_PRESETS[continuity] || RotationEngine.CONTINUITY_PRESETS[0];
    const continuityWeight = preset[0];
    const gameDiversityWeight = preset[1];

    // Seed prevAssignments from last frozen period
    // Bridge v4 → v3 format for engine internals (continuity cost in _buildCostMatrix)
    let prevAssignments = frozen.length > 0
      ? v4AssignmentsToPrimary(frozen[frozen.length - 1].assignments)
      : null;

    const regenerated = [];
    for (let i = 0; i < periodRosters.length; i++) {
      const periodPlayers = periodRosters[i];
      const assignments = this._assignPositions(
        periodPlayers, gamePositionCounts, {
          locks,
          prevAssignments,
          continuityWeight,
          gameDiversityWeight,
          positionMax,
        }
      );
      const bench = remainingAvailable.filter(p => !periodPlayers.includes(p));

      regenerated.push({
        period: fromPeriodIdx + i + 1, // 1-based, continuing from frozen
        assignments,
        bench,
      });

      for (const [pos, pid] of Object.entries(assignments)) {
        gamePositionCounts[pid][pos] = (gamePositionCounts[pid][pos] || 0) + 1;
      }
      prevAssignments = assignments;
    }

    // Restore original season stats
    this.seasonStats = savedStats;

    // Step 7: Merge and return
    return {
      ...existingPlan,
      availablePlayers: allAvailable,
      periodAssignments: [...frozen, ...regenerated],
    };
  }
}

// -- Helper: player summary from a game plan ------------------------
function getPlayerSummary(plan) {
  const summary = {};
  for (const pid of plan.availablePlayers) {
    summary[pid] = { periodsPlayed: 0, positions: [], benched: 0 };
  }
  for (const pa of plan.periodAssignments) {
    const appearedInSlot = new Set();
    for (const [pos, val] of Object.entries(pa.assignments)) {
      if (Array.isArray(val)) {
        // v4 format: array of occupant entries
        const pidsInSlot = new Set(val.map(e => e.pid));
        for (const pid of pidsInSlot) appearedInSlot.add(pid);

        // Accumulate credit per pid, summing across all entries (handles re-entry)
        const creditByPid = {};
        for (const entry of val) {
          creditByPid[entry.pid] = (creditByPid[entry.pid] || 0) + (entry.timeOut - entry.timeIn);
        }
        for (const [pid, credit] of Object.entries(creditByPid)) {
          if (!summary[pid]) continue;
          summary[pid].periodsPlayed += credit;
          summary[pid].positions.push(pos); // record position once per slot per period
        }
      } else {
        // v3 fallback
        appearedInSlot.add(val);
        if (summary[val]) {
          summary[val].periodsPlayed++;
          summary[val].positions.push(pos);
        }
      }
    }
    for (const pid of pa.bench) {
      if (summary[pid] && !appearedInSlot.has(pid)) {
        summary[pid].benched++;
      }
    }
  }
  return summary;
}
