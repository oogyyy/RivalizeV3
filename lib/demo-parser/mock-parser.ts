import type { ParsedDemoData, PlayerStats, Round, GameEvent } from '@/types/database'

const CS2_WEAPONS = ['ak47', 'rifle_m4a1_s', 'awp', 'pistol_glock', 'sg556', 'aug', 'famas', 'galil']
const MAPS = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_ancient', 'de_anubis']

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generatePlayer(name: string, team: string): PlayerStats {
  const kills = randomBetween(5, 28)
  const deaths = randomBetween(8, 25)
  const assists = randomBetween(1, 8)
  const headshots = Math.floor(kills * (randomBetween(30, 70) / 100))

  return {
    steam_id: `7656119${randomBetween(10000000, 99999999)}`,
    name,
    team,
    kills,
    deaths,
    assists,
    headshots,
    headshot_percentage: headshots / Math.max(kills, 1) * 100,
    adr: randomBetween(55, 115),
    kast: randomBetween(55, 85),
    rating: parseFloat((randomBetween(70, 150) / 100).toFixed(2)),
    utility_damage: randomBetween(10, 80),
    flash_assists: randomBetween(0, 8),
    mvps: randomBetween(0, 6),
    rounds_played: randomBetween(20, 30),
  }
}

function generateRound(roundNum: number, team1: string, team2: string): Round {
  const winner = Math.random() > 0.5 ? team1 : team2
  const winReasons = ['elimination', 'bomb_defused', 'bomb_exploded', 'time_expired']

  return {
    number: roundNum,
    winner,
    win_reason: winReasons[randomBetween(0, winReasons.length - 1)],
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
  const map = mapName || MAPS[randomBetween(0, MAPS.length - 1)]
  const totalRounds = randomBetween(16, 30)
  const score1 = randomBetween(7, Math.min(16, totalRounds))
  const score2 = totalRounds - score1

  const TEAM1_NAMES = ['s1mple', 'NiKo', 'ZywOo', 'device', 'sh1ro']
  const TEAM2_NAMES = ['electronic', 'Magisk', 'broky', 'YEKINDAR', 'Blamef']

  const team1Players = TEAM1_NAMES.map(p => generatePlayer(p, team1Name))
  const team2Players = TEAM2_NAMES.map(p => generatePlayer(p, team2Name))

  const rounds = Array.from({ length: totalRounds }, (_, i) =>
    generateRound(i + 1, team1Name, team2Name)
  )

  return {
    header: {
      map,
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
