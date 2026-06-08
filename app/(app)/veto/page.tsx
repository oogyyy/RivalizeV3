export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import VetoClient from './VetoClient'
import type { AggregatedStats } from '@/types/database'

const ACTIVE_DUTY = [
  'de_dust2', 'de_mirage', 'de_inferno', 'de_nuke',
  'de_overpass', 'de_ancient', 'de_anubis',
]

export default async function VetoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // 1. Fetch all team memberships
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const allTeamIds = (memberships ?? []).map(m => m.team_id).filter(Boolean)

  // 2. Fetch teams, filtering out personal teams
  const teams: Array<{ id: string; name: string }> = []

  if (allTeamIds.length > 0) {
    const { data: teamsData } = await admin
      .from('teams')
      .select('id, name')
      .in('id', allTeamIds)
      .eq('is_personal', false)

    for (const t of teamsData ?? []) {
      teams.push({ id: t.id, name: t.name })
    }
  }

  // 3. Compute selfMapStats for each team
  type MapStat = { wins: number; losses: number; winRate: number }
  const selfMapStatsByTeam: Record<string, Record<string, MapStat>> = {}

  for (const team of teams) {
    const teamStats: Record<string, MapStat> = {}

    const { data: selfDemos } = await admin
      .from('demos')
      .select('parsed_data, map')
      .eq('team_id', team.id)
      .eq('status', 'completed')
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(30)

    for (const demo of selfDemos ?? []) {
      if (!demo.map || !ACTIVE_DUTY.includes(demo.map)) continue
      const pd = demo.parsed_data as {
        header?: { score_team1?: number; score_team2?: number; team1?: string; team2?: string }
        opponentSide?: string
      } | null
      if (!pd?.header) continue

      const { score_team1 = 0, score_team2 = 0 } = pd.header
      const ourSide = pd.opponentSide === 'team1' ? 'team2' : 'team1'
      const ourScore = ourSide === 'team1' ? score_team1 : score_team2
      const theirScore = ourSide === 'team1' ? score_team2 : score_team1

      if (!teamStats[demo.map]) teamStats[demo.map] = { wins: 0, losses: 0, winRate: 0 }
      if (ourScore > theirScore) teamStats[demo.map].wins++
      else teamStats[demo.map].losses++
    }

    for (const [map, s] of Object.entries(teamStats)) {
      const total = s.wins + s.losses
      teamStats[map].winRate = total > 0 ? s.wins / total : 0
    }

    selfMapStatsByTeam[team.id] = teamStats
  }

  // 4. Opponent folders — use first non-personal team's folders
  type OpponentEntry = {
    id: string
    name: string
    mapPicks: Record<string, number>
  }

  const opponents: OpponentEntry[] = []
  const firstTeamId = teams[0]?.id ?? null

  if (firstTeamId) {
    const { data: folders } = await admin
      .from('team_folders')
      .select('id, opponent_display_name, aggregated_stats')
      .eq('user_team_id', firstTeamId)
      .order('created_at', { ascending: false })

    for (const f of folders ?? []) {
      const stats = f.aggregated_stats as AggregatedStats | null
      const mapPicks = stats?.maps_played ?? {}
      const activePicks = Object.fromEntries(
        Object.entries(mapPicks).filter(([m]) => ACTIVE_DUTY.includes(m))
      )
      opponents.push({ id: f.id, name: f.opponent_display_name, mapPicks: activePicks })
    }
  }

  return (
    <VetoClient
      teams={teams}
      selfMapStatsByTeam={selfMapStatsByTeam}
      opponents={opponents}
      activeDutyMaps={ACTIVE_DUTY}
    />
  )
}
