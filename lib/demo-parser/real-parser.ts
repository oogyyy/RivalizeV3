/**
 * Real CS2 demo parser using @laihoe/demoparser2.
 *
 * Team assignment uses team_num (2=T, 3=CT) rather than team_name, which is
 * a team-entity field not reliably available as a player entity prop. Players
 * switch sides at halftime, so we derive each player's starting side from
 * observations before the halftime tick and flip post-halftime observations.
 *
 * Team names are resolved in priority order:
 *   1. CCSTeam.m_szTeamname entity state (set by FACEIT/competitive servers)
 *   2. Majority clan tag (CCSPlayerController.m_szClan) across all side players
 *   3. "T-Side" / "CT-Side" fallback labels
 *
 * Halftime is fixed at round 12 (MR12 standard). OT mini-halves are 3 rounds.
 *
 * NOTE: `event_name` is auto-included by demoparser2 and must NOT be passed
 * as an otherExtra prop — doing so causes rm_user_friendly_names() to throw,
 * silently zeroing all events.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dp = require('@laihoe/demoparser2') as {
  parseHeader:    (b: Buffer) => Record<string, unknown>
  parseEvent: (
    b: Buffer, event: string,
    playerExtra: string[], otherExtra: string[],
  ) => Record<string, unknown>[]
  parseEvents: (
    b: Buffer, events: string[],
    playerExtra: string[], otherExtra: string[],
  ) => Record<string, unknown>[]
  parsePlayerInfo: (b: Buffer) => Record<string, unknown>[]
  // parseTicks is available in demoparser2 ≥ 0.5 and most 0.4x builds.
  // We access it dynamically so older builds that lack it degrade gracefully.
  parseTicks?: (b: Buffer, props: string[], ticks?: number[]) => Record<string, unknown>[]
}

import type { ParsedDemoData, PlayerStats } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>

function n(obj: Row, ...keys: string[]): number {
  for (const k of keys) {
    const v = obj[k]
    if (v != null) {
      const num = Number(v)
      if (!isNaN(num)) return num
    }
  }
  return 0
}

function s(obj: Row, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.length > 0) return v
    if (typeof v === 'bigint') return v.toString()
    if (typeof v === 'number' && !isNaN(v) && v !== 0) return String(v)
  }
  return ''
}

// ─── CS2 MR12 halftime constants ─────────────────────────────────────────────

// Standard CS2 competitive: MR12, regulation halftime after round 12.
// OT is MR3 (each OT half = 3 rounds).
const REGULATION_HALF = 12
const OT_HALF_SIZE    = 3

/**
 * Returns true if T-side wins this round go to team1 (original T-starters),
 * accounting for regulation halftime and OT mini-halves.
 *
 * team1 = players who started on T in round 1.
 * After regulation halftime (round 13), teams swap → T wins go to team2.
 * After OT round 4, teams swap again → back to first-half orientation.
 */
function tWinsGoToTeam1(roundIdx: number): boolean {
  if (roundIdx < REGULATION_HALF) return true   // Rounds 1–12: T is team1
  if (roundIdx < REGULATION_HALF * 2) return false  // Rounds 13–24: T is team2
  // OT rounds (25+): each mini-half is OT_HALF_SIZE rounds, alternating
  const otIdx  = roundIdx - REGULATION_HALF * 2
  const otHalf = Math.floor(otIdx / OT_HALF_SIZE)
  // OT halves 0,2,4… (even) continue second-half orientation (T = team2)
  // OT halves 1,3,5… (odd) flip back to first-half orientation (T = team1)
  return otHalf % 2 === 1
}

// ─── Public result type ───────────────────────────────────────────────────────

export interface RealParseResult {
  parsedData: ParsedDemoData
  warnings: string[]
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function parseCS2Demo(buf: Buffer): RealParseResult {
  const warnings: string[] = []

  // ── 1. Header (map name) ──────────────────────────────────────────────────
  let mapName = 'unknown'
  try {
    const h = dp.parseHeader(buf)
    const mn = s(h, 'map_name', 'map', 'mapName')
    if (mn && mn.length > 2) mapName = mn.toLowerCase()
  } catch (e) {
    warnings.push(`header: ${e}`)
  }

  // ── 2. Per-event-type scans ───────────────────────────────────────────────
  //
  // PLAYER_EXTRA uses only `team_num` — a confirmed-valid CS2 player entity
  // prop. `team_name` is a TEAM entity field, not a player entity field, so
  // requesting it via PLAYER_EXTRA returns empty strings.
  const PLAYER_EXTRA = ['team_num']

  let deathEvents: Row[] = []
  try {
    deathEvents = dp.parseEvent(
      buf, 'player_death', PLAYER_EXTRA,
      ['tick', 'headshot', 'weapon',
       'attacker_steamid', 'attacker_name', 'attacker_team_num',
       'assister_steamid', 'assister_name',
       'user_steamid', 'user_name'],
    ) ?? []
  } catch (e) { warnings.push(`parseEvent(player_death): ${e}`) }

  if (deathEvents.length > 0) {
    console.log('[real-parser] player_death field names:', Object.keys(deathEvents[0]))
  }

  let roundEnds: Row[] = []
  try {
    roundEnds = dp.parseEvent(
      buf, 'round_end', [],
      ['tick', 'winner', 'reason', 't_score', 'ct_score'],
    ) ?? []
  } catch (e) { warnings.push(`parseEvent(round_end): ${e}`) }

  if (roundEnds.length > 0) {
    console.log('[real-parser] round_end field names:', Object.keys(roundEnds[0]))
    console.log('[real-parser] first round_end values:', roundEnds[0])
  }

  let hurtEvents: Row[] = []
  try {
    hurtEvents = dp.parseEvent(
      buf, 'player_hurt', PLAYER_EXTRA,
      ['tick', 'attacker_steamid', 'attacker_team_num', 'dmg_health', 'health'],
    ) ?? []
  } catch (e) { warnings.push(`parseEvent(player_hurt): ${e}`) }

  let mvpEvents: Row[] = []
  try {
    mvpEvents = dp.parseEvent(
      buf, 'round_mvp', PLAYER_EXTRA,
      ['tick'],
    ) ?? []
  } catch (e) { warnings.push(`parseEvent(round_mvp): ${e}`) }

  // ── 2b. Clan-name scans ───────────────────────────────────────────────────
  //
  // CCSPlayerController.m_szClan is the only per-player field that contains a
  // team/clan label. We scan it from multiple event types to maximise coverage:
  //   • player_death victims   (every player who died at least once)
  //   • round_mvp subjects     (round winners — complement to victim scan)
  //
  // If players haven't set a Steam clan tag (common in MM), these maps stay
  // empty and we fall through to the CCSTeam entity scan below.
  const clanNameBySid = new Map<string, string>()

  function absorbClanScan(events: Row[]) {
    for (const ev of events) {
      const sid  = s(ev, 'steamid', 'user_steamid')
      const clan = s(ev, 'CCSPlayerController.m_szClan')
      if (sid && sid !== '0' && clan) clanNameBySid.set(sid, clan)
    }
  }

  try {
    absorbClanScan(dp.parseEvent(
      buf, 'player_death',
      ['team_num', 'CCSPlayerController.m_szClan'],
      ['tick', 'attacker_steamid'],
    ) ?? [])
  } catch (e) { warnings.push(`clan scan (death): ${e}`) }

  try {
    absorbClanScan(dp.parseEvent(
      buf, 'round_mvp',
      ['team_num', 'CCSPlayerController.m_szClan'],
      ['tick'],
    ) ?? [])
  } catch (e) { warnings.push(`clan scan (mvp): ${e}`) }

  if (clanNameBySid.size > 0) {
    console.log(`[real-parser] clan tags for ${clanNameBySid.size} players:`, [...new Set(clanNameBySid.values())])
  }

  // ── 2c. CCSTeam entity name scan (via parseTicks) ─────────────────────────
  //
  // FACEIT and other competitive platforms populate CCSTeam.m_szTeamname with
  // the real team name. This is a team entity prop (not player entity), so it
  // can only be read via parseTicks(), not via playerExtra in parseEvent().
  //
  // We sample it at the last round_end tick so the final team names are read.
  let tEntityName  = ''
  let ctEntityName = ''
  // Team observations from parseTicks — populated below, merged into
  // playerTeamObs in Pass 1 to ensure all 10 players have team assignments
  // even if they never appear as a victim or attacker in any event.
  const parsedTickTeamObs: Array<{sid: string; tick: number; team_num: number}> = []

  // Sort rounds first so we can find the last tick
  const sortedRounds = [...roundEnds].sort((a, b) => n(a, 'tick') - n(b, 'tick'))

  const lastRoundTick = sortedRounds.length > 0
    ? n(sortedRounds[sortedRounds.length - 1], 'tick')
    : 0

  if (lastRoundTick > 0 && typeof dp.parseTicks === 'function') {
    try {
      const GENERIC_NAMES = new Set([
        '', 'Unassigned', 'Spectator', 'TERRORIST', 'CT',
        'Terrorist', 'Counter-Terrorist', 'T', 'COUNTER-TERRORIST',
        'Terrorists', 'Counter-Terrorists', 'terrorist', 'counter-terrorist',
      ])
      // Sample at tick 1 (entity init) AND last round end tick.
      const sampleTicks = [...new Set([1, lastRoundTick])]
      const teamRows = dp.parseTicks(
        buf,
        // team_num is the player entity's team (2=T, 3=CT) at this tick.
        // m_szClan gives the FACEIT/organized team name per player (e.g. "team_Oogy").
        // CCSTeam.m_szTeamname only gives "TERRORIST"/"CT" for most FACEIT matches.
        ['team_num', 'CCSTeam.m_szTeamname', 'CCSTeam.m_iTeamNum', 'CCSPlayerController.m_szClan'],
        sampleTicks,
      ) ?? []

      console.log('[real-parser] parseTicks raw sample (first 6 rows):', JSON.stringify(teamRows.slice(0, 6)))

      // Populate clanNameBySid AND parsedTickTeamObs from ALL players visible
      // at these ticks — more complete than event scans which miss players who
      // only ever appear as the attacker (attacker_team_num is often 0 in CS2).
      for (const row of teamRows) {
        const sid     = s(row, 'steamid')
        const clan    = s(row, 'CCSPlayerController.m_szClan', 'm_szClan')
        const teamNum = n(row, 'team_num')
        const tickVal = n(row, 'tick')
        if (sid && sid !== '0') {
          if (clan) clanNameBySid.set(sid, clan)
          if (teamNum >= 2) parsedTickTeamObs.push({ sid, tick: tickVal, team_num: teamNum })
        }
      }

      // Also try CCSTeam.m_szTeamname in case the server set real names there.
      for (const row of teamRows) {
        const teamNum  = n(row, 'CCSTeam.m_iTeamNum', 'm_iTeamNum')
        const teamName = s(row, 'CCSTeam.m_szTeamname', 'm_szTeamname')
        if (!teamName || GENERIC_NAMES.has(teamName)) continue
        if (teamNum === 2 && !tEntityName)  tEntityName  = teamName
        if (teamNum === 3 && !ctEntityName) ctEntityName = teamName
      }

      if (tEntityName || ctEntityName) {
        console.log(`[real-parser] CCSTeam entity names: T="${tEntityName}", CT="${ctEntityName}"`)
      }
      if (clanNameBySid.size > 0) {
        console.log(`[real-parser] clan tags after parseTicks (${clanNameBySid.size} players):`, [...new Set(clanNameBySid.values())])
      }
    } catch (e) {
      warnings.push(`CCSTeam parseTicks: ${e}`)
    }
  } else if (!dp.parseTicks) {
    warnings.push('parseTicks not available in this demoparser2 build — CCSTeam names skipped')
  }

  // ── Knife round detection ─────────────────────────────────────────────────
  function isKnifeWeapon(w: string): boolean {
    return w.startsWith('knife') || w === 'bayonet'
  }

  // Strip consecutive leading pre-match rounds (knife rounds, warmup rounds).
  // FACEIT demos often have 1-2 rounds before competitive play starts:
  //   round 0: warmup/veto round (may have 0 deaths or knife-only deaths)
  //   round 1: knife round (players run to a side, typically 0 deaths)
  // We strip any leading round where ALL deaths used knife weapons (including
  // the case of zero deaths). Stop as soon as a round has a non-knife death.
  // Cap: never strip more than (totalRounds - REGULATION_HALF) to preserve
  // at least a full half of competitive rounds.
  let stripCount = 0
  if (sortedRounds.length > REGULATION_HALF) {
    const maxStrip = sortedRounds.length - REGULATION_HALF
    for (let ri = 0; ri < maxStrip; ri++) {
      const endTick  = n(sortedRounds[ri], 'tick')
      const prevTick = ri > 0 ? n(sortedRounds[ri - 1], 'tick') : 0
      const roundDeaths = deathEvents.filter(ev => {
        const t = n(ev, 'tick')
        return t > prevTick && t <= endTick
      })
      // allKnifeOrNone is true for 0-death rounds (Array.every on empty = true)
      if (roundDeaths.every(ev => isKnifeWeapon(s(ev, 'weapon')))) {
        stripCount++
        console.log(`[real-parser] stripping pre-match round ${ri + 1} (deaths=${roundDeaths.length}, endTick=${endTick})`)
      } else {
        break
      }
    }
  }

  const competitiveRounds = sortedRounds.slice(stripCount)
  const totalRounds = competitiveRounds.length
  // Tick boundary below which events belong to stripped pre-match rounds.
  const preMatchEndTick = stripCount > 0 ? n(sortedRounds[stripCount - 1], 'tick') : -1

  // Halftime tick: end of round 12 (MR12 fixed), or last round if shorter.
  // Used to determine each player's starting side before side-swap.
  const halfRoundIdx = Math.min(REGULATION_HALF - 1, competitiveRounds.length - 1)
  const halfTick = halfRoundIdx >= 0
    ? n(competitiveRounds[halfRoundIdx], 'tick')
    : Infinity

  console.log(`[real-parser] totalRounds=${totalRounds}, halfTick=${halfTick} (idx=${halfRoundIdx})`)

  // ── 3. Player info ────────────────────────────────────────────────────────
  let playerInfoRaw: Row[] = []
  try {
    playerInfoRaw = dp.parsePlayerInfo(buf) ?? []
  } catch (e) { warnings.push(`playerInfo: ${e}`) }

  if (playerInfoRaw.length > 0) {
    console.log('[real-parser] parsePlayerInfo field names:', Object.keys(playerInfoRaw[0]))
  } else {
    console.warn('[real-parser] parsePlayerInfo returned 0 rows')
  }

  const botSids  = new Set(playerInfoRaw.filter(p => p.is_bot ).map(p => s(p, 'xuid', 'steamid')))
  const hltvSids = new Set(playerInfoRaw.filter(p => p.is_hltv).map(p => s(p, 'xuid', 'steamid')))

  const infoName = new Map<string, string>(
    playerInfoRaw
      .filter(p => !p.is_bot && !p.is_hltv)
      .map(p => [s(p, 'xuid', 'steamid'), s(p, 'name')] as [string, string])
      .filter(([sid, name]) => sid && name),
  )

  const victimName   = new Map<string, string>()
  const attackerName = new Map<string, string>()
  for (const ev of deathEvents) {
    const vicSid  = s(ev, 'user_steamid', 'steamid')
    const vicName = s(ev, 'user_name')
    if (vicSid && vicName) victimName.set(vicSid, vicName)
    const atkSid  = s(ev, 'attacker_steamid')
    const atkName = s(ev, 'attacker_name')
    if (atkSid && atkName) attackerName.set(atkSid, atkName)
  }

  console.log(`[real-parser] name sources: parsePlayerInfo=${infoName.size}, victim=${victimName.size}, attacker=${attackerName.size}`)

  // ── 4. Stat maps + two-pass team-aware stat counting ─────────────────────
  //
  // PASS 1: Collect team observations from VICTIM-side fields (always
  // reliable, populated via PLAYER_EXTRA) plus any attacker_team_num we get.
  // This gives us complete team assignments before we count any stats.
  //
  // PASS 2: Count kills/damage using getTeamNumAtTick() for accurate team-
  // kill and friendly-fire filtering. attacker_team_num is NOT trusted for
  // filtering — it is often 0 in CS2 demos because it is resolved from the
  // attacker entity at parse time and may be missing.

  const killMap    = new Map<string, number>()
  const hsMap      = new Map<string, number>()
  const assistMap  = new Map<string, number>()
  const damageMap  = new Map<string, number>()
  const mvpMap     = new Map<string, number>()
  const deathCount = new Map<string, number>()
  const playerTeamObs = new Map<string, { tick: number; team_num: number }[]>()

  function recordTeam(sid: string, tick: number, teamNum: number) {
    if (!sid || sid === '0' || teamNum < 2) return
    if (!playerTeamObs.has(sid)) playerTeamObs.set(sid, [])
    playerTeamObs.get(sid)!.push({ tick, team_num: teamNum })
  }

  // ── Pass 1: team observations only ───────────────────────────────────────
  for (const ev of deathEvents) {
    const tick    = n(ev, 'tick')
    const vicSid  = s(ev, 'steamid', 'user_steamid')
    const vicTeam = n(ev, 'team_num', 'user_team_num')
    const atkSid  = s(ev, 'attacker_steamid')
    const atkTeam = n(ev, 'attacker_team_num')
    if (vicSid && vicSid !== '0') recordTeam(vicSid, tick, vicTeam)
    if (atkSid && atkSid !== '0') recordTeam(atkSid, tick, atkTeam)
  }
  for (const ev of hurtEvents) {
    const tick    = n(ev, 'tick')
    const vicSid  = s(ev, 'steamid', 'user_steamid')
    const vicTeam = n(ev, 'team_num')
    const atkSid  = s(ev, 'attacker_steamid')
    const atkTeam = n(ev, 'attacker_team_num')
    if (vicSid && vicSid !== '0') recordTeam(vicSid, tick, vicTeam)
    if (atkSid && atkSid !== '0') recordTeam(atkSid, tick, atkTeam)
  }
  for (const ev of mvpEvents) {
    const sid  = s(ev, 'steamid', 'user_steamid')
    const tick = n(ev, 'tick')
    const team = n(ev, 'team_num', 'user_team_num')
    if (sid && sid !== '0') recordTeam(sid, tick, team)
  }

  // Merge parseTicks team observations — guarantees all 10 players have an
  // entry in playerTeamObs even if they never appear as a victim or attacker
  // in any event (attacker_team_num is frequently 0 in CS2 demo events).
  for (const obs of parsedTickTeamObs) {
    recordTeam(obs.sid, obs.tick, obs.team_num)
  }

  // ── 5. Derive each player's STARTING team_num ─────────────────────────────
  //
  // Prefer pre-halftime observations (tick ≤ halfTick) — these directly give
  // the player's starting side. Post-halftime observations are flipped 2↔3.
  function getStartingTeamNum(sid: string): number {
    const obs = playerTeamObs.get(sid) ?? []
    if (obs.length === 0) return 0

    const preHalf = obs.filter(o => o.tick <= halfTick && o.team_num >= 2)
    if (preHalf.length > 0) {
      const counts = new Map<number, number>()
      for (const o of preHalf) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }

    const postHalf = obs.filter(o => o.tick > halfTick && o.team_num >= 2)
    if (postHalf.length > 0) {
      const counts = new Map<number, number>()
      for (const o of postHalf) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return dominant === 2 ? 3 : 2
    }

    const counts = new Map<number, number>()
    for (const o of obs) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  // ── Helpers for round-aware team assignment ───────────────────────────────
  //
  // Given a round index into competitiveRounds, return whether teams are in
  // their "first-half orientation" (starting positions).
  function isFirstHalfOrientation(roundIdx: number): boolean {
    if (roundIdx < REGULATION_HALF) return true
    if (roundIdx < REGULATION_HALF * 2) return false
    // OT: odd mini-halves flip back to first-half orientation
    const otHalf = Math.floor((roundIdx - REGULATION_HALF * 2) / OT_HALF_SIZE)
    return otHalf % 2 === 1
  }

  // Sorted array of end-ticks for competitive rounds (for binary search).
  const roundEndTickArr = competitiveRounds.map(r => n(r, 'tick'))

  // Binary-search for the competitive round index containing this tick.
  // Returns -1 if tick is after all rounds.
  function findRoundIdx(tick: number): number {
    if (roundEndTickArr.length === 0) return -1
    let lo = 0, hi = roundEndTickArr.length - 1
    if (tick > roundEndTickArr[hi]) return -1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (roundEndTickArr[mid] < tick) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  // Return the actual team_num (2=T, 3=CT) for a player at a given tick,
  // accounting for side swaps at halftime and OT mini-halves.
  function getTeamNumAtTick(sid: string, tick: number): number {
    const starting = getStartingTeamNum(sid)
    if (starting < 2) return 0
    const rIdx = findRoundIdx(tick)
    if (rIdx === -1) return 0
    return isFirstHalfOrientation(rIdx) ? starting : (starting === 2 ? 3 : 2)
  }

  // ── Pass 2a: kills, deaths, assists ──────────────────────────────────────
  for (const ev of deathEvents) {
    const tick   = n(ev, 'tick')
    const vicSid = s(ev, 'steamid', 'user_steamid')
    const atkSid = s(ev, 'attacker_steamid')

    if (vicSid && vicSid !== '0') recordTeam(vicSid, tick, n(ev, 'team_num', 'user_team_num'))
    if (atkSid && atkSid !== '0') recordTeam(atkSid, tick, n(ev, 'attacker_team_num'))

    if (preMatchEndTick >= 0 && tick <= preMatchEndTick) continue

    const atkTeam = atkSid && atkSid !== '0' ? getTeamNumAtTick(atkSid, tick) : 0
    const vicTeam = getTeamNumAtTick(vicSid, tick)
    const isTeamKill = atkSid && atkSid !== '0' && atkSid !== vicSid &&
                       atkTeam >= 2 && vicTeam >= 2 && atkTeam === vicTeam

    // Count death for the victim, excluding team-kill deaths (FACEIT does not
    // count deaths caused by a teammate against the victim's death tally).
    if (vicSid && vicSid !== '0' && !isTeamKill) {
      deathCount.set(vicSid, (deathCount.get(vicSid) ?? 0) + 1)
    }

    if (!atkSid || atkSid === '0' || atkSid === vicSid) continue
    if (isTeamKill) continue

    killMap.set(atkSid, (killMap.get(atkSid) ?? 0) + 1)
    if (ev.headshot) hsMap.set(atkSid, (hsMap.get(atkSid) ?? 0) + 1)

    const astSid = s(ev, 'assister_steamid')
    if (astSid && astSid !== '0') assistMap.set(astSid, (assistMap.get(astSid) ?? 0) + 1)
  }

  // ── Pass 2b: damage — use HP-delta to avoid raw weapon damage inflation ──
  //
  // In CS2 demos, dmg_health can be the raw weapon damage (e.g. 459 for an AWP
  // headshot) rather than actual HP lost. Using the 'health' field (victim HP
  // AFTER the hit) and tracking per-round HP gives the correct value.
  {
    // Sort by tick first. Within the same tick, sort by remaining HP descending
    // so the event where the victim has MORE HP remaining (= earlier hit in the
    // round) is processed first. This gives correct per-attacker attribution
    // regardless of the order demoparser2 emits same-tick events.
    const sortedHurt = [...hurtEvents].sort((a, b) => {
      const tickDiff = n(a, 'tick') - n(b, 'tick')
      if (tickDiff !== 0) return tickDiff
      return n(b, 'health') - n(a, 'health')  // higher remaining HP = earlier hit
    })
    let trackRoundIdx = -2
    const victimRoundHP = new Map<string, number>()

    for (const ev of sortedHurt) {
      const tick   = n(ev, 'tick')
      const atkSid = s(ev, 'attacker_steamid')
      const vicSid = s(ev, 'steamid', 'user_steamid')

      if (preMatchEndTick >= 0 && tick <= preMatchEndTick) continue
      if (!atkSid || atkSid === '0' || !vicSid || vicSid === '0') continue
      if (atkSid === vicSid) continue

      const rIdx = findRoundIdx(tick)
      if (rIdx === -1) continue

      // New round detected — reset HP tracking so everyone starts at 100.
      if (rIdx !== trackRoundIdx) {
        victimRoundHP.clear()
        trackRoundIdx = rIdx
      }

      const atkTeam = getTeamNumAtTick(atkSid, tick)
      const vicTeam = getTeamNumAtTick(vicSid, tick)
      if (atkTeam >= 2 && vicTeam >= 2 && atkTeam === vicTeam) continue  // friendly fire

      // Compute actual HP delta. 'health' = victim HP after hit (0–100).
      // Fall back to min(100, dmg_health) if health field is unavailable.
      const healthAfter = ev['health'] != null ? n(ev, 'health') : -1
      let actualDmg: number
      if (healthAfter >= 0) {
        const prevHP = victimRoundHP.get(vicSid) ?? 100
        actualDmg = Math.max(0, prevHP - healthAfter)
        victimRoundHP.set(vicSid, Math.max(0, healthAfter))
      } else {
        actualDmg = Math.min(100, n(ev, 'dmg_health'))
      }

      if (actualDmg > 0) {
        damageMap.set(atkSid, (damageMap.get(atkSid) ?? 0) + actualDmg)
      }
    }
  }

  for (const ev of mvpEvents) {
    const sid = s(ev, 'steamid', 'user_steamid')
    if (sid && sid !== '0') {
      mvpMap.set(sid, (mvpMap.get(sid) ?? 0) + 1)
    }
  }

  // ── 6. Build player list ──────────────────────────────────────────────────
  const allSids = new Set<string>([
    ...killMap.keys(), ...deathCount.keys(),
    ...assistMap.keys(), ...mvpMap.keys(), ...playerTeamObs.keys(),
  ])

  const players: PlayerStats[] = []

  for (const sid of allSids) {
    if (!sid || sid === '0' || botSids.has(sid) || hltvSids.has(sid)) continue

    const startingNum = getStartingTeamNum(sid)
    if (startingNum < 2) continue

    const team = startingNum === 2 ? 'T-Side' : 'CT-Side'

    const name =
      infoName.get(sid)     ||
      victimName.get(sid)   ||
      attackerName.get(sid) ||
      `Player_${sid.slice(-4)}`

    const kills     = killMap.get(sid)    ?? 0
    const deaths    = deathCount.get(sid) ?? 0
    const assists   = assistMap.get(sid)  ?? 0
    const headshots = hsMap.get(sid)      ?? 0
    const mvps      = mvpMap.get(sid)     ?? 0

    const hsPercent = kills > 0 ? Math.round((headshots / kills) * 100) : 0
    const totalDmg  = damageMap.get(sid) ?? 0
    const adr = totalRounds > 0 ? Math.round(totalDmg / totalRounds) : 0

    const kd = deaths > 0 ? kills / deaths : kills + 1
    const rating = parseFloat(
      Math.max(0.3, Math.min(2.5,
        kd * 0.38 + (adr / 100) * 0.42 + 0.317 + (mvps / Math.max(totalRounds, 1)) * 0.1,
      )).toFixed(2),
    )

    players.push({
      steam_id: sid, name, team, kills, deaths, assists, headshots,
      headshot_percentage: hsPercent, adr,
      kast: 65,  // stub — full KAST requires round-by-round survival tracking
      rating, utility_damage: 0, flash_assists: 0, mvps,
      rounds_played: totalRounds,
    })
  }

  if (players.length === 0) {
    warnings.push(
      `players=0: deaths=${deathEvents.length} roundEnds=${roundEnds.length} ` +
      `hurt=${hurtEvents.length} mvp=${mvpEvents.length} sids=${allSids.size} halfTick=${halfTick}`,
    )
    console.warn('[real-parser] 0 players extracted. Warnings:', warnings)
  } else {
    const fakes = players.filter(p => p.name.startsWith('Player_')).length
    console.log(`[real-parser] ${players.length} players (${fakes} with fallback names):`, players.map(p => p.name))
  }

  // ── 6b. Resolve real team names ───────────────────────────────────────────
  //
  // Priority 1: CCSTeam entity name (populated by FACEIT / competitive servers)
  // Priority 2: Majority clan tag across all players on this side
  // Priority 3: Generic "T-Side" / "CT-Side" fallback

  function deriveName(
    sideLabel: string,
    sidePlayers: typeof players,
    entityName: string,
  ): string {
    if (entityName) return entityName

    const counts = new Map<string, number>()
    for (const p of sidePlayers) {
      const clan = clanNameBySid.get(p.steam_id)
      if (clan) counts.set(clan, (counts.get(clan) ?? 0) + 1)
    }
    if (counts.size === 0) return sideLabel
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const tSidePlayers  = players.filter(p => p.team === 'T-Side')
  const ctSidePlayers = players.filter(p => p.team === 'CT-Side')
  const team1Name = deriveName('T-Side',  tSidePlayers,  tEntityName)
  const team2Name = deriveName('CT-Side', ctSidePlayers, ctEntityName)

  console.log(`[real-parser] team names: "${team1Name}" vs "${team2Name}"`)

  if (team1Name !== 'T-Side' || team2Name !== 'CT-Side') {
    for (const p of players) {
      if (p.team === 'T-Side')  p.team = team1Name
      else if (p.team === 'CT-Side') p.team = team2Name
    }
  }

  // ── 7. Score ──────────────────────────────────────────────────────────────
  //
  // Strategy A (preferred): read cumulative t_score / ct_score from the last
  // competitive round_end event. These are populated in some CS2 demo builds.
  //
  // Strategy B (fallback): count round winners via reason strings with
  // MR12-aware halftime and OT mini-half correction (tWinsGoToTeam1).

  function tSideWonRound(reason: string, winnerNum: number): boolean {
    if (['ct_killed', 'bomb_exploded', 'target_bombed', 'terrorists_win'].includes(reason)) return true
    if (['t_killed', 'bomb_defused', 'hostage_rescued', 'cts_win', 'time_expired'].includes(reason)) return false
    return winnerNum === 2
  }

  let score1 = 0
  let score2 = 0

  // Strategy A (t_score/ct_score) is intentionally avoided: after halftime
  // the teams swap, so the cumulative t_score mixes team1's first-half T-wins
  // with team2's second-half T-wins and doesn't map to either team's total.
  //
  // Always use Strategy B: count round winners via reason strings with
  // MR12-aware halftime and OT mini-half correction.
  for (let i = 0; i < competitiveRounds.length; i++) {
    const re   = competitiveRounds[i]
    const tWon = tSideWonRound(s(re, 'reason'), n(re, 'winner'))
    if (tWinsGoToTeam1(i) ? tWon : !tWon) score1++
    else score2++
  }
  console.log(`[real-parser] scores via reason strings (MR12-aware): ${score1}-${score2}`)

  // ── 8. Assemble ParsedDemoData ────────────────────────────────────────────
  const parsedData: ParsedDemoData = {
    header: {
      map:          mapName,
      team1:        team1Name,
      team2:        team2Name,
      score_team1:  score1,
      score_team2:  score2,
      duration:     totalRounds * 90,
      total_rounds: totalRounds,
    },
    rounds: competitiveRounds.map((re, i) => {
      const tWon       = tSideWonRound(s(re, 'reason'), n(re, 'winner'))
      const winnerTeam = (tWinsGoToTeam1(i) ? tWon : !tWon) ? team1Name : team2Name
      return {
        number:        i + 1,
        winner:        winnerTeam,
        win_reason:    s(re, 'reason') || 'elimination',
        duration:      90,
        team1_economy: 0,
        team2_economy: 0,
        kills:         [],
        bomb_planted:  false,
        bomb_defused:  false,
      }
    }),
    players,
    events:       [],
    heatmap_data: [],
  }

  return { parsedData, warnings }
}
