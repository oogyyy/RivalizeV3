import type { PlayerStats } from '@/types/database'

interface DemoRecord {
  parsed_data: unknown
}

/**
 * Aggregates opponent player stats across multiple completed demos.
 * Uses opponentSide stored in each demo's parsed_data to identify which
 * team is the opponent ('T-Side' or 'CT-Side') rather than a hardcoded name.
 */
export function computeTopPlayers(demos: DemoRecord[]): PlayerStats[] {
  const playerMap: Record<string, PlayerStats & { count: number }> = {}

  for (const demo of demos) {
    const pd = demo.parsed_data as {
      players?: PlayerStats[]
      opponentSide?: string
      header?: { team1?: string; team2?: string }
    } | null

    const players = pd?.players ?? []
    if (players.length === 0) continue

    // Determine which team label belongs to the opponent.
    // The parser sets team1='T-Side', team2='CT-Side' in the header.
    // opponentSide='team2' → opponent is CT-Side; 'team1' → opponent is T-Side.
    const opponentSide = pd?.opponentSide ?? 'team2'
    const opponentTeamLabel = opponentSide === 'team1'
      ? (pd?.header?.team1 ?? 'T-Side')
      : (pd?.header?.team2 ?? 'CT-Side')

    for (const p of players) {
      if (p.team !== opponentTeamLabel) continue

      if (!playerMap[p.steam_id]) {
        playerMap[p.steam_id] = { ...p, count: 1 }
      } else {
        const e = playerMap[p.steam_id]
        e.kills    += p.kills
        e.deaths   += p.deaths
        e.assists  += p.assists
        e.headshots += p.headshots
        e.adr    = (e.adr    * e.count + p.adr)    / (e.count + 1)
        e.rating = (e.rating * e.count + p.rating) / (e.count + 1)
        e.kast   = (e.kast   * e.count + p.kast)   / (e.count + 1)
        e.rounds_played += p.rounds_played
        e.count++
      }
    }
  }

  return Object.values(playerMap)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 5)
    .map(({ count: _count, ...p }) => p)
}
