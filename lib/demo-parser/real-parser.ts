/**
 * Real CS2 demo parser using @laihoe/demoparser2.
 *
 * Team assignment uses team_num (2=T, 3=CT) rather than team_name, which is
 * a team-entity field not reliably available as a player entity prop. Players
 * switch sides at halftime, so we derive each player's starting side from
 * observations before the halftime tick and flip post-halftime observations.
 *
 * NOTE: `event_name` is auto-included by demoparser2 and must NOT be passed
 * as an otherExtra prop — doing so causes rm_user_friendly_names() to throw,
 * silently zeroing all events. We call parseEvent() per event type to avoid
 * having to partition on event_name entirely.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dp = require('@laihoe/demoparser2') as {
  parseHeader: (b: Buffer) => Record<string, unknown>
  parseEvent: (
    b: Buffer,
    event: string,
    playerExtra: string[],
    otherExtra: string[],
  ) => Record<string, unknown>[]
  parseEvents: (
    b: Buffer,
    events: string[],
    playerExtra: string[],
    otherExtra: string[],
  ) => Record<string, unknown>[]
  parsePlayerInfo: (b: Buffer) => Record<string, unknown>[]
}

import type { ParsedDemoData, PlayerStats } from '@/types/database'

// ─── tiny helpers ────────────────────────────────────────────────────────────

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
  }
  return ''
}

// ─── public result type ───────────────────────────────────────────────────────

export interface RealParseResult {
  parsedData: ParsedDemoData
  warnings: string[]
}

// ─── main entry point ─────────────────────────────────────────────────────────

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
  // requesting it via PLAYER_EXTRA returns empty strings and broke all team
  // assignment, causing the 0-player fallback to mock data.
  const PLAYER_EXTRA = ['team_num']

  let deathEvents: Row[] = []
  try {
    deathEvents = dp.parseEvent(
      buf,
      'player_death',
      PLAYER_EXTRA,
      ['tick', 'headshot', 'weapon',
       'attacker_steamid', 'attacker_name', 'attacker_team_num',
       'assister_steamid', 'assister_name'],
    ) ?? []
  } catch (e) {
    warnings.push(`parseEvent(player_death): ${e}`)
  }

  let roundEnds: Row[] = []
  try {
    roundEnds = dp.parseEvent(
      buf,
      'round_end',
      [],
      ['tick', 'winner', 'reason'],
    ) ?? []
  } catch (e) {
    warnings.push(`parseEvent(round_end): ${e}`)
  }

  let hurtEvents: Row[] = []
  try {
    hurtEvents = dp.parseEvent(
      buf,
      'player_hurt',
      PLAYER_EXTRA,
      ['tick', 'attacker_steamid', 'attacker_team_num', 'dmg_health'],
    ) ?? []
  } catch (e) {
    warnings.push(`parseEvent(player_hurt): ${e}`)
  }

  let mvpEvents: Row[] = []
  try {
    mvpEvents = dp.parseEvent(
      buf,
      'round_mvp',
      PLAYER_EXTRA,
      ['tick'],
    ) ?? []
  } catch (e) {
    warnings.push(`parseEvent(round_mvp): ${e}`)
  }

  const totalRounds = roundEnds.length

  // Sort round_end events chronologically — used for halftime boundary and score
  const sortedRounds = [...roundEnds].sort((a, b) => n(a, 'tick') - n(b, 'tick'))

  // Halftime tick: tick of the last round in the first half
  const halfRoundIdx = Math.ceil(totalRounds / 2) - 1
  const halfTick = halfRoundIdx >= 0 && halfRoundIdx < sortedRounds.length
    ? n(sortedRounds[halfRoundIdx], 'tick')
    : Infinity

  // ── 3. Player info (display names, bot/HLTV flags) ────────────────────────
  let playerInfoRaw: Row[] = []
  try {
    playerInfoRaw = dp.parsePlayerInfo(buf) ?? []
  } catch (e) {
    warnings.push(`playerInfo: ${e}`)
  }

  const botSids  = new Set(
    playerInfoRaw.filter(p => p.is_bot).map(p => s(p, 'xuid', 'steamid'))
  )
  const hltvSids = new Set(
    playerInfoRaw.filter(p => p.is_hltv).map(p => s(p, 'xuid', 'steamid'))
  )
  const infoName = new Map(
    playerInfoRaw.map(p => [s(p, 'xuid', 'steamid'), s(p, 'name')])
  )

  // ── 4. Stat maps + team_num observations per player ───────────────────────
  const killMap    = new Map<string, number>()
  const hsMap      = new Map<string, number>()
  const assistMap  = new Map<string, number>()
  const damageMap  = new Map<string, number>()
  const mvpMap     = new Map<string, number>()
  const deathCount = new Map<string, number>()

  // playerTeamObs: steamid → array of {tick, team_num} seen across all events
  const playerTeamObs = new Map<string, { tick: number; team_num: number }[]>()

  function recordTeam(sid: string, tick: number, teamNum: number) {
    if (!sid || sid === '0' || teamNum < 2) return
    if (!playerTeamObs.has(sid)) playerTeamObs.set(sid, [])
    playerTeamObs.get(sid)!.push({ tick, team_num: teamNum })
  }

  for (const ev of deathEvents) {
    const atkSid = s(ev, 'attacker_steamid')
    const vicSid = s(ev, 'steamid', 'user_steamid')
    const tick   = n(ev, 'tick')

    if (atkSid && atkSid !== '0') {
      killMap.set(atkSid, (killMap.get(atkSid) ?? 0) + 1)
      if (ev.headshot) hsMap.set(atkSid, (hsMap.get(atkSid) ?? 0) + 1)
      recordTeam(atkSid, tick, n(ev, 'attacker_team_num'))
    }
    const astSid = s(ev, 'assister_steamid')
    if (astSid && astSid !== '0') {
      assistMap.set(astSid, (assistMap.get(astSid) ?? 0) + 1)
    }
    if (vicSid && vicSid !== '0') {
      deathCount.set(vicSid, (deathCount.get(vicSid) ?? 0) + 1)
      recordTeam(vicSid, tick, n(ev, 'team_num', 'user_team_num'))
    }
  }

  for (const ev of hurtEvents) {
    const tick   = n(ev, 'tick')
    const atkSid = s(ev, 'attacker_steamid')
    if (atkSid && atkSid !== '0') {
      const dmg = Math.min(100, n(ev, 'dmg_health'))
      damageMap.set(atkSid, (damageMap.get(atkSid) ?? 0) + dmg)
      recordTeam(atkSid, tick, n(ev, 'attacker_team_num'))
    }
    const vicSid = s(ev, 'steamid', 'user_steamid')
    if (vicSid && vicSid !== '0') {
      recordTeam(vicSid, tick, n(ev, 'team_num', 'user_team_num'))
    }
  }

  for (const ev of mvpEvents) {
    const sid = s(ev, 'steamid', 'user_steamid')
    if (sid && sid !== '0') {
      mvpMap.set(sid, (mvpMap.get(sid) ?? 0) + 1)
      recordTeam(sid, n(ev, 'tick'), n(ev, 'team_num', 'user_team_num'))
    }
  }

  // ── 5. Derive each player's STARTING team_num (before halftime switch) ────
  //
  // In CS2, teams switch sides at halftime. A player with team_num=2 (T) in
  // round 1–12 becomes team_num=3 (CT) in rounds 13–24. We normalise each
  // observation to its starting-side equivalent so we can group players into
  // two stable teams regardless of the match length.
  function getStartingTeamNum(sid: string): number {
    const obs = playerTeamObs.get(sid) ?? []
    if (obs.length === 0) return 0

    // Use observations from the first half (≤ halfTick) as-is
    const preHalf = obs.filter(o => o.tick <= halfTick && o.team_num >= 2)
    if (preHalf.length > 0) {
      const counts = new Map<number, number>()
      for (const o of preHalf) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
      return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }

    // Only post-halftime data available: flip 2↔3 to recover starting side
    const postHalf = obs.filter(o => o.tick > halfTick && o.team_num >= 2)
    if (postHalf.length > 0) {
      const counts = new Map<number, number>()
      for (const o of postHalf) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
      const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      return dominant === 2 ? 3 : 2
    }

    // Absolute fallback: use all obs, take majority
    const counts = new Map<number, number>()
    for (const o of obs) counts.set(o.team_num, (counts.get(o.team_num) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  // ── 6. Build player list ──────────────────────────────────────────────────
  const allSids = new Set<string>([
    ...killMap.keys(),
    ...deathCount.keys(),
    ...assistMap.keys(),
    ...mvpMap.keys(),
    ...playerTeamObs.keys(),
  ])

  const players: PlayerStats[] = []

  for (const sid of allSids) {
    if (!sid || sid === '0' || botSids.has(sid) || hltvSids.has(sid)) continue

    const startingNum = getStartingTeamNum(sid)
    if (startingNum < 2) continue  // spectator or unknown

    // Team label is stable regardless of halftime switch
    const team = startingNum === 2 ? 'T-Side' : 'CT-Side'

    const name =
      infoName.get(sid) ||
      s(
        deathEvents.find(e => s(e, 'attacker_steamid') === sid) ?? {},
        'attacker_name',
      ) ||
      `Player_${sid.slice(-4)}`

    const kills    = killMap.get(sid)    ?? 0
    const deaths   = deathCount.get(sid) ?? 0
    const assists  = assistMap.get(sid)  ?? 0
    const headshots = hsMap.get(sid)     ?? 0
    const mvps     = mvpMap.get(sid)     ?? 0

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
      steam_id:            sid,
      name,
      team,
      kills,
      deaths,
      assists,
      headshots,
      headshot_percentage: hsPercent,
      adr,
      kast:                65,
      rating,
      utility_damage:      0,
      flash_assists:       0,
      mvps,
      rounds_played:       totalRounds,
    })
  }

  if (players.length === 0) {
    warnings.push(
      `players=0 diagnostics: deaths=${deathEvents.length} roundEnds=${roundEnds.length} ` +
      `hurt=${hurtEvents.length} mvp=${mvpEvents.length} allSids=${allSids.size} ` +
      `teamObsSids=${playerTeamObs.size} halfTick=${halfTick}`,
    )
    console.warn('[real-parser] 0 players extracted. Warnings:', warnings)
  }

  // ── 7. Score: halftime-aware round winner → team score ────────────────────
  //
  // First half  (i < halfRoundCount): winner=2 → T-Side wins; winner=3 → CT-Side wins
  // Second half (i ≥ halfRoundCount): sides switched, so winner=2 → CT-Side originally,
  //                                   winner=3 → T-Side originally
  const halfRoundCount = Math.ceil(totalRounds / 2)
  let score1 = 0  // T-Side (started T)
  let score2 = 0  // CT-Side (started CT)

  for (let i = 0; i < sortedRounds.length; i++) {
    const winnerSide = n(sortedRounds[i], 'winner')
    const isSecondHalf = i >= halfRoundCount
    if (!isSecondHalf) {
      if (winnerSide === 2) score1++
      else if (winnerSide === 3) score2++
    } else {
      if (winnerSide === 2) score2++  // T at this tick started as CT-Side
      else if (winnerSide === 3) score1++  // CT at this tick started as T-Side
    }
  }

  // ── 8. Assemble ParsedDemoData ────────────────────────────────────────────
  const parsedData: ParsedDemoData = {
    header: {
      map:          mapName,
      team1:        'T-Side',
      team2:        'CT-Side',
      score_team1:  score1,
      score_team2:  score2,
      duration:     totalRounds * 90,
      total_rounds: totalRounds,
    },
    rounds: sortedRounds.map((re, i) => ({
      number:         i + 1,
      winner:         n(re, 'winner') === 2 ? 'T' : 'CT',
      win_reason:     s(re, 'reason') || 'elimination',
      duration:       90,
      team1_economy:  0,
      team2_economy:  0,
      kills:          [],
      bomb_planted:   false,
      bomb_defused:   false,
    })),
    players,
    events: [],
    heatmap_data: [],
  }

  return { parsedData, warnings }
}
