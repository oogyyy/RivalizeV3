/**
 * Real CS2 demo parser using @laihoe/demoparser2.
 *
 * Strategy:
 *  - parseHeader       → map name
 *  - parseEvents (one scan) → player_death, round_end, player_hurt, round_mvp
 *    • player_death    → K/D/HS per player (attacker-centric), team assignment
 *    • round_end       → total rounds, T/CT winner per round
 *    • player_hurt     → real ADR (damage dealt per round)
 *    • round_mvp       → MVP counts
 *  - parsePlayerInfo   → display names, bot/HLTV filter
 *  - Score computation: per-round winner mapped to team name via cross-referencing
 *    team_num of victims within each round's tick window
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dp = require('@laihoe/demoparser2') as {
  parseHeader: (b: Buffer) => Record<string, unknown>
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

  // ── 2. All events in a single scan ───────────────────────────────────────
  let allEvents: Row[] = []
  try {
    allEvents = dp.parseEvents(
      buf,
      ['player_death', 'round_end', 'player_hurt', 'round_mvp'],
      // player props (attached to the event's associated player = victim for deaths, etc.)
      ['team_name', 'team_num', 'name', 'steamid'],
      // event-level props
      [
        'event_name',         // so we can split by type
        'tick',
        // round_end
        'winner', 'reason',
        // player_death
        'headshot', 'weapon',
        'attacker_steamid', 'attacker_name',
        'assister_steamid',  'assister_name',
        // player_hurt
        'dmg_health',
        // round_mvp — no extra fields needed
      ],
    ) ?? []
  } catch (e) {
    warnings.push(`parseEvents: ${e}`)
  }

  // Partition events (event_name may be top-level or inside the row)
  const getEvName = (row: Row) =>
    s(row, 'event_name') || s(row, 'event')

  const deathEvents  = allEvents.filter(r => getEvName(r) === 'player_death')
  const roundEnds    = allEvents.filter(r => getEvName(r) === 'round_end')
  const hurtEvents   = allEvents.filter(r => getEvName(r) === 'player_hurt')
  const mvpEvents    = allEvents.filter(r => getEvName(r) === 'round_mvp')

  const totalRounds = roundEnds.length

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
  // Build name lookup from playerInfo (more reliable than event data)
  const infoName = new Map(
    playerInfoRaw.map(p => [s(p, 'xuid', 'steamid'), s(p, 'name')])
  )

  // ── 4. Attacker-centric kill / HS / assist / damage / mvp maps ───────────
  const killMap   = new Map<string, number>()
  const hsMap     = new Map<string, number>()
  const assistMap = new Map<string, number>()
  const damageMap = new Map<string, number>()
  const mvpMap    = new Map<string, number>()
  const deathCount = new Map<string, number>()
  // team assignment: last known team_name per steamid
  const teamName  = new Map<string, string>()
  const teamNum   = new Map<string, number>()

  for (const ev of deathEvents) {
    const atkSid = s(ev, 'attacker_steamid')
    const vicSid = s(ev, 'user_steamid', 'steamid')   // victim steamid
    const vicTeam = s(ev, 'team_name')                 // victim's team (player prop)
    const vicNum  = n(ev, 'team_num')

    if (atkSid && atkSid !== '0') {
      killMap.set(atkSid, (killMap.get(atkSid) ?? 0) + 1)
      if (ev.headshot) hsMap.set(atkSid, (hsMap.get(atkSid) ?? 0) + 1)
    }
    const astSid = s(ev, 'assister_steamid')
    if (astSid && astSid !== '0') {
      assistMap.set(astSid, (assistMap.get(astSid) ?? 0) + 1)
    }
    if (vicSid && vicSid !== '0') {
      deathCount.set(vicSid, (deathCount.get(vicSid) ?? 0) + 1)
      if (vicTeam) teamName.set(vicSid, vicTeam)
      if (vicNum)  teamNum.set(vicSid, vicNum)
    }

    // Attacker team from attacker_name + victim's opposite side (rough — overwritten by proper data)
    // Best effort: also try to get attacker's team from a later event where they appear as victim
  }

  for (const ev of hurtEvents) {
    const atkSid = s(ev, 'attacker_steamid')
    if (atkSid && atkSid !== '0') {
      // Damage capped at 100 per hit (CS2 HP floor is 0, not negative)
      const dmg = Math.min(100, n(ev, 'dmg_health'))
      damageMap.set(atkSid, (damageMap.get(atkSid) ?? 0) + dmg)
    }
  }

  for (const ev of mvpEvents) {
    // round_mvp victim player prop carries the MVP player's steamid
    const sid = s(ev, 'user_steamid', 'steamid')
    if (sid && sid !== '0') mvpMap.set(sid, (mvpMap.get(sid) ?? 0) + 1)
  }

  // ── 5. Collect all real players ───────────────────────────────────────────
  const allSids = new Set<string>([
    ...killMap.keys(),
    ...deathCount.keys(),
    ...assistMap.keys(),
    ...mvpMap.keys(),
  ])

  const players: PlayerStats[] = []

  for (const sid of allSids) {
    if (!sid || sid === '0' || botSids.has(sid) || hltvSids.has(sid)) continue

    const tNum = teamNum.get(sid) ?? 0
    if (tNum === 0 || tNum === 1) continue   // spectators

    const tName = teamName.get(sid) ?? ''
    if (!tName) continue                      // no team assignment, skip

    const name =
      infoName.get(sid)         ||
      s(
        deathEvents.find(e => s(e, 'attacker_steamid') === sid) ?? {},
        'attacker_name',
      ) ||
      `Player_${sid.slice(-4)}`

    const kills    = killMap.get(sid) ?? 0
    const deaths   = deathCount.get(sid) ?? 0
    const assists  = assistMap.get(sid) ?? 0
    const headshots = hsMap.get(sid) ?? 0
    const mvps     = mvpMap.get(sid) ?? 0

    const hsPercent = kills > 0 ? Math.round((headshots / kills) * 100) : 0
    const totalDmg  = damageMap.get(sid) ?? 0
    const adr = totalRounds > 0
      ? Math.round(totalDmg / totalRounds)
      : Math.round((kills * 75 + assists * 15) / Math.max(totalRounds, 1))

    // Rating 2.0 approximation from K/D and ADR
    const kd = deaths > 0 ? kills / deaths : kills + 1
    const rating = parseFloat(
      Math.max(0.3, Math.min(2.5,
        kd * 0.38 + (adr / 100) * 0.42 + 0.317 + (mvps / Math.max(totalRounds, 1)) * 0.1,
      )).toFixed(2),
    )

    players.push({
      steam_id:            sid,
      name,
      team:                tName,
      kills,
      deaths,
      assists,
      headshots,
      headshot_percentage: hsPercent,
      adr,
      kast:                65,   // requires per-round tracking; approximated
      rating,
      utility_damage:      0,
      flash_assists:       0,
      mvps,
      rounds_played:       totalRounds,
    })
  }

  // ── 6. Determine team1 / team2 names (keep teams with ≥ 3 players) ────────
  const teamGroups = new Map<string, PlayerStats[]>()
  for (const p of players) {
    if (!teamGroups.has(p.team)) teamGroups.set(p.team, [])
    teamGroups.get(p.team)!.push(p)
  }
  const realTeams = [...teamGroups.entries()]
    .filter(([, ps]) => ps.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([tn]) => tn)

  const team1Name = realTeams[0] ?? 'Team 1'
  const team2Name = realTeams[1] ?? 'Team 2'
  const team1Sids = new Set(
    players.filter(p => p.team === team1Name).map(p => p.steam_id),
  )

  // ── 7. Score computation — per-round winner via death-event team matching ──
  // Sort round_end events chronologically
  const sortedRounds = [...roundEnds].sort((a, b) => n(a, 'tick') - n(b, 'tick'))

  let score1 = 0
  let score2 = 0
  let undetermined = 0

  for (let i = 0; i < sortedRounds.length; i++) {
    const re = sortedRounds[i]
    const prevTick = i > 0 ? n(sortedRounds[i - 1], 'tick') : 0
    const thisTick = n(re, 'tick')
    const winnerSide = n(re, 'winner') // 2 = T, 3 = CT

    // Deaths that occurred in this round's tick window
    const roundDeaths = deathEvents.filter(e => {
      const t = n(e, 'tick')
      return t > prevTick && t <= thisTick
    })

    let winnerTeam: string | null = null

    // Pass 1: find victim on winner's side → they're from the winning team
    for (const d of roundDeaths) {
      if (n(d, 'team_num') === winnerSide) {
        const tn = s(d, 'team_name')
        if (tn === team1Name || tn === team2Name) { winnerTeam = tn; break }
      }
    }

    // Pass 2: find victim on loser's side → their team lost → other team won
    if (!winnerTeam) {
      for (const d of roundDeaths) {
        const tn = s(d, 'team_name')
        if ((tn === team1Name || tn === team2Name) && n(d, 'team_num') !== winnerSide) {
          winnerTeam = tn === team1Name ? team2Name : team1Name
          break
        }
      }
    }

    // Pass 3: a kill by team1 player → they were active this round, probably on winner's side
    if (!winnerTeam) {
      for (const d of roundDeaths) {
        const atkSid = s(d, 'attacker_steamid')
        if (atkSid && team1Sids.has(atkSid)) {
          // Attacker is on team1 — if team1's known side matches winner's side, team1 won
          const t1Num = teamNum.get(atkSid) ?? 0
          if (t1Num === winnerSide) { winnerTeam = team1Name; break }
        }
      }
    }

    if (winnerTeam === team1Name) score1++
    else if (winnerTeam === team2Name) score2++
    else undetermined++
  }

  // Distribute undetermined rounds proportionally (rare edge case)
  if (undetermined > 0 && (score1 + score2) > 0) {
    const total = score1 + score2
    score1 += Math.round((score1 / total) * undetermined)
    score2 = totalRounds - score1
  } else if (undetermined > 0) {
    // Complete fallback — can't determine sides at all
    warnings.push(`Could not determine winner for ${undetermined}/${totalRounds} rounds`)
    score1 = Math.floor(totalRounds / 2)
    score2 = totalRounds - score1
  }

  // ── 8. Assemble ParsedDemoData ────────────────────────────────────────────
  const parsedData: ParsedDemoData = {
    header: {
      map:          mapName,
      team1:        team1Name,
      team2:        team2Name,
      score_team1:  score1,
      score_team2:  score2,
      duration:     totalRounds * 90,  // rough: ~90s per round on average
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
