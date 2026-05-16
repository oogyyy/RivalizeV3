import type { PlayerStats } from '@/types/database'

interface DemoRecord {
  parsed_data: unknown
}

/**
 * Aggregates opponent player stats across multiple completed demos.
 * Filters out players whose team matches the user team name (team1 = 'My Team'),
 * keeping only the opponent side players.
 */
export function computeTopPlayers(demos: DemoRecord[], userTeamName = 'My Team'): PlayerStats[] {
  const playerMap: Record<string, PlayerStats & { count: number }> = {}

  for (const demo of demos) {
    const pd = demo.parsed_data as { players?: PlayerStats[] } | null
    for (const p of pd?.players ?? []) {
      // Only aggregate opponent players
      if (p.team === userTeamName) continue

      if (!playerMap[p.steam_id]) {
        playerMap[p.steam_id] = { ...p, count: 1 }
      } else {
        const existing = playerMap[p.steam_id]
        existing.kills += p.kills
        existing.deaths += p.deaths
        existing.assists += p.assists
        existing.headshots += p.headshots
        existing.adr = (existing.adr * existing.count + p.adr) / (existing.count + 1)
        existing.rating = (existing.rating * existing.count + p.rating) / (existing.count + 1)
        existing.kast = (existing.kast * existing.count + p.kast) / (existing.count + 1)
        existing.rounds_played += p.rounds_played
        existing.count++
      }
    }
  }

  return Object.values(playerMap)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map(({ count: _count, ...p }) => p)
}
