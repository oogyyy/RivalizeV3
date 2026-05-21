import type { ParsedDemoData } from '@/types/database'

export interface RealParseResult {
  parsedData: ParsedDemoData
  warnings: string[]
}

// 8-minute timeout — generous enough for 500 MB demos while still detecting hangs
const PARSER_TIMEOUT_MS = 8 * 60 * 1000

/**
 * Sends a demo buffer to the Go parser service and returns structured data.
 * PARSER_URL must point to the deployed go-parser service.
 */
export async function parseCS2Demo(buf: Buffer): Promise<RealParseResult> {
  const parserUrl = process.env.PARSER_URL
  if (!parserUrl) {
    throw new Error('PARSER_URL environment variable is not set. Deploy the go-parser service and set PARSER_URL.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), PARSER_TIMEOUT_MS)

  const form = new FormData()
  form.append('demo', new Blob([new Uint8Array(buf)], { type: 'application/octet-stream' }), 'demo.dem')

  let res: Response
  try {
    res = await fetch(`${parserUrl.replace(/\/$/, '')}/parse`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error(`Go parser timed out after ${PARSER_TIMEOUT_MS / 1000}s`)
    }
    throw new Error(`Go parser unreachable (${parserUrl}): ${(e as Error).message}`)
  } finally {
    clearTimeout(timeoutId)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Go parser returned HTTP ${res.status}: ${text}`)
  }

  const raw = await res.json() as {
    header:   GoHeader
    rounds:   GoRound[]
    players:  GoPlayer[]
    warnings: string[]
  }

  if (raw.warnings?.length) {
    console.warn('[go-parser] warnings:', raw.warnings)
  }

  const parsedData: ParsedDemoData = {
    header: {
      map:          raw.header.map,
      team1:        raw.header.team1,
      team2:        raw.header.team2,
      score_team1:  raw.header.score_team1,
      score_team2:  raw.header.score_team2,
      duration:     raw.header.duration,
      total_rounds: raw.header.total_rounds,
    },
    rounds: raw.rounds.map((r, i) => ({
      number:        i + 1,
      winner:        r.winner,
      win_reason:    r.win_reason,
      duration:      r.duration,
      team1_economy: r.team1_economy,
      team2_economy: r.team2_economy,
      bomb_planted:  r.bomb_planted,
      bomb_defused:  r.bomb_defused,
      kills: (r.kills ?? []).map(k => ({
        tick:        k.tick,
        time:        k.time,
        killer_name: k.killer_name,
        victim_name: k.victim_name,
        weapon:      k.weapon,
        headshot:    k.headshot,
        killer_x:    k.killer_x,
        killer_y:    k.killer_y,
        victim_x:    k.victim_x,
        victim_y:    k.victim_y,
      })),
    })),
    players: raw.players.map(p => ({
      steam_id:           p.steam_id,
      name:               p.name,
      team:               p.team,
      kills:              p.kills,
      deaths:             p.deaths,
      assists:            p.assists,
      headshots:          p.headshots,
      headshot_percentage: p.headshot_percentage,
      adr:                p.adr,
      kast:               p.kast,
      rating:             p.rating,
      utility_damage:     p.utility_damage,
      flash_assists:      p.flash_assists,
      mvps:               p.mvps,
      rounds_played:      p.rounds_played,
    })),
    events: [],
    heatmap_data: buildHeatmapData(parsedData.rounds, parsedData.players),
  }

  return {
    parsedData,
    warnings: raw.warnings ?? [],
  }
}

// ── Go service response types ─────────────────────────────────────────────────

interface GoHeader {
  map:          string
  team1:        string
  team2:        string
  score_team1:  number
  score_team2:  number
  duration:     number
  total_rounds: number
}

interface GoKill {
  tick:        number
  time:        number
  killer_name: string
  victim_name: string
  weapon:      string
  headshot:    boolean
  killer_x:    number
  killer_y:    number
  victim_x:    number
  victim_y:    number
}

interface GoRound {
  number:        number
  winner:        string
  win_reason:    string
  duration:      number
  team1_economy: number
  team2_economy: number
  bomb_planted:  boolean
  bomb_defused:  boolean
  kills:         GoKill[]
}

interface GoPlayer {
  steam_id:            string
  name:                string
  team:                string
  kills:               number
  deaths:              number
  assists:             number
  headshots:           number
  headshot_percentage: number
  adr:                 number
  kast:                number
  rating:              number
  utility_damage:      number
  flash_assists:       number
  mvps:                number
  rounds_played:       number
}

// ── Heatmap generation ────────────────────────────────────────────────────────
// CS2 coordinates are in game units (roughly -3500 to +3500 per axis depending
// on the map). We normalise all positions to the 0–1024 range that HeatmapCanvas
// expects by computing min/max from the actual kill data in this match.

function buildHeatmapData(
  rounds: ParsedDemoData['rounds'],
  players: ParsedDemoData['players'],
): ParsedDemoData['heatmap_data'] {
  const allKills = rounds.flatMap(r => r.kills ?? [])
  if (allKills.length === 0) return []

  const teamOf = new Map<string, string>()
  players.forEach(p => teamOf.set(p.name, p.team))

  const xs = allKills.flatMap(k => [k.killer_x, k.victim_x])
  const ys = allKills.flatMap(k => [k.killer_y, k.victim_y])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const PAD = 60, SCALE = 1024 - PAD * 2

  const norm = (v: number, min: number, max: number, flip = false) => {
    const n = max === min ? 0.5 : (v - min) / (max - min)
    return PAD + (flip ? 1 - n : n) * SCALE
  }

  const points: NonNullable<ParsedDemoData['heatmap_data']> = []
  allKills.forEach(k => {
    points.push({
      x: norm(k.killer_x, minX, maxX),
      y: norm(k.killer_y, minY, maxY, true),
      type: 'kill',
      team: teamOf.get(k.killer_name) ?? '',
    })
    points.push({
      x: norm(k.victim_x, minX, maxX),
      y: norm(k.victim_y, minY, maxY, true),
      type: 'death',
      team: teamOf.get(k.victim_name) ?? '',
    })
  })
  return points
}
