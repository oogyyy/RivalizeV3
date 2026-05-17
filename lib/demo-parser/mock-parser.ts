import type { ParsedDemoData, PlayerStats, Round } from '@/types/database'

// ─── Map pool ────────────────────────────────────────────────────────────────
const MAPS = [
  'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke',
  'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis',
  'de_cache', 'de_train', 'de_cobblestone',
]

// ─── Large name pool (60+ real CS2 pro handles) ──────────────────────────────
const NAME_POOL = [
  's1mple', 'NiKo', 'ZywOo', 'device', 'sh1ro', 'electronic', 'Magisk',
  'broky', 'YEKINDAR', 'Blamef', 'ropz', 'Twistzz', 'NAF', 'EliGE', 'Stewie2K',
  'Perfecto', 'b1t', 'Jame', 'Axile', 'Hobbit', 'xantares', 'woxic', 'Calyx',
  'tabseN', 'syrsoN', 'frozen', 'STYKO', 'cerq', 'Brehze', 'Ethan', 'autimatic',
  'dephh', 'CeRq', 'ShahZaM', 'FugLy', 'RUSH', 'Xyp9x', 'dupreeh', 'gla1ve',
  'karrigan', 'rain', 'GuardiaN', 'KjaerBye', 'nexa', 'JaCkz', 'apEX',
  'kennyS', 'AmaNEk', 'shox', 'RpK', 'misutaaa', 'KRIMZ', 'JW', 'flusha',
  'olofmeister', 'twist', 'Lekr0', 'REZ', 'f0rest', 'GeT_RiGhT', 'flamie',
  'Boombl4', 'k0nfig', 'snappi', 'Bubzkji', 'es3tag', 'stavn', 'TeSeS', 'refrezh',
]

// ─── Simple deterministic hash ────────────────────────────────────────────────
function hashStr(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** Pick `count` unique names from the pool seeded by `seed`. */
function pickNames(seed: string, count: number): string[] {
  const result: string[] = []
  const used = new Set<number>()
  let idx = hashStr(seed) % NAME_POOL.length
  while (result.length < count) {
    if (!used.has(idx)) {
      used.add(idx)
      result.push(NAME_POOL[idx])
    }
    idx = (idx + 7) % NAME_POOL.length // step by prime for spread
  }
  return result
}

function rng(seed: number, min: number, max: number): number {
  const v = ((seed * 1664525 + 1013904223) >>> 0) % (max - min + 1)
  return min + v
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generatePlayer(name: string, team: string, totalRounds: number): PlayerStats {
  const seed = hashStr(name + team)
  // Scale kills/deaths to the actual number of rounds (MR12 max ~30 rounds in regulation)
  const killsPerRound  = rng(seed,     35, 90) / 100  // 0.35–0.90 K/R
  const deathsPerRound = rng(seed + 1, 35, 85) / 100
  const kills   = Math.round(killsPerRound * totalRounds)
  const deaths  = Math.round(deathsPerRound * totalRounds)
  const assists = rng(seed + 2, 1, Math.max(2, Math.round(totalRounds * 0.15)))
  const headshots = Math.floor(kills * (rng(seed + 3, 25, 65) / 100))

  return {
    steam_id: `7656119${((hashStr(name) >>> 0) % 90000000 + 10000000)}`,
    name,
    team,
    kills,
    deaths,
    assists,
    headshots,
    headshot_percentage: headshots / Math.max(kills, 1) * 100,
    adr:            rng(seed + 4, 52, 115),
    kast:           rng(seed + 5, 54, 84),
    rating:         parseFloat((rng(seed + 6, 70, 148) / 100).toFixed(2)),
    utility_damage: rng(seed + 7, 8,  80),
    flash_assists:  rng(seed + 8, 0,  8),
    mvps:           rng(seed + 9, 0,  Math.max(1, Math.round(totalRounds * 0.2))),
    rounds_played:  totalRounds,
  }
}

// ─── CS2 MR12 score generation ────────────────────────────────────────────────
// Valid overtime winner/loser score pairs (cumulative from 0).
// In MR12: first to 13 in regulation; 12-12 → OT MR3 (first to 4 OT rounds).
// Cumulative OT totals: 1 OT → 16 wins, 2 OT → 19, 3 OT → 22.
const OT_OUTCOMES: Array<[number, number]> = [
  [16, 14], [16, 13], [16, 12],  // 1 OT period
  [19, 17], [19, 16], [19, 15],  // 2 OT periods
  [22, 20], [22, 18],            // 3 OT periods
]

interface MatchScore { score1: number; score2: number; totalRounds: number }

function generateMR12Score(seed: number): MatchScore {
  // ~12% of CS2 matches go to overtime (12-12 regulation)
  if (rng(seed, 0, 99) < 12) {
    const [w, l] = OT_OUTCOMES[rng(seed + 5, 0, OT_OUTCOMES.length - 1)]
    const team1Wins = rng(seed + 6, 0, 1) === 0
    const score1 = team1Wins ? w : l
    const score2 = team1Wins ? l : w
    return { score1, score2, totalRounds: score1 + score2 }
  }
  // Regulation: one team reaches 13
  const loserScore = rng(seed + 1, 0, 12)
  const team1Wins = rng(seed + 2, 0, 1) === 0
  const score1 = team1Wins ? 13 : loserScore
  const score2 = team1Wins ? loserScore : 13
  return { score1, score2, totalRounds: score1 + score2 }
}

function generateRound(roundNum: number, team1: string, team2: string): Round {
  const winner = Math.random() > 0.5 ? team1 : team2
  const reasons = ['elimination', 'bomb_defused', 'bomb_exploded', 'time_expired'] as const
  return {
    number: roundNum,
    winner,
    win_reason: reasons[randomBetween(0, reasons.length - 1)],
    duration: randomBetween(30, 115),
    team1_economy: randomBetween(1000, 20000),
    team2_economy: randomBetween(1000, 20000),
    kills: [],
    bomb_planted: Math.random() > 0.5,
    bomb_defused: Math.random() > 0.7,
  }
}

export function generateMockDemoData(
  team1Name: string,
  team2Name: string,
  mapName?: string
): ParsedDemoData {
  // Never use 'unknown' — pick a real CS2 map deterministically from the opponent name
  const resolvedMap = (mapName && mapName !== 'unknown')
    ? mapName
    : MAPS[hashStr(team2Name) % MAPS.length]

  const scoreSeed = hashStr(team1Name + team2Name + resolvedMap)
  const { score1, score2, totalRounds } = generateMR12Score(scoreSeed)

  // Deterministic player names: same opponent always gets the same 5 players
  const team1Names = pickNames(`${team1Name}:t1:${resolvedMap}`, 5)
  const team2Names = pickNames(`${team2Name}:t2:${resolvedMap}`, 5)

  const team1Players = team1Names.map(n => generatePlayer(n, team1Name, totalRounds))
  const team2Players = team2Names.map(n => generatePlayer(n, team2Name, totalRounds))

  const rounds = Array.from({ length: totalRounds }, (_, i) =>
    generateRound(i + 1, team1Name, team2Name)
  )

  return {
    header: {
      map: resolvedMap,
      team1: team1Name,
      team2: team2Name,
      score_team1: score1,
      score_team2: score2,
      duration: totalRounds * randomBetween(60, 100),
      total_rounds: totalRounds,
    },
    rounds,
    players: [...team1Players, ...team2Players],
    events: [],
    heatmap_data: Array.from({ length: 50 }, () => ({
      x: randomBetween(0, 1024),
      y: randomBetween(0, 1024),
      type: (['kill', 'death', 'bomb', 'grenade'] as const)[randomBetween(0, 3)],
      team: Math.random() > 0.5 ? team1Name : team2Name,
    })),
  }
}
