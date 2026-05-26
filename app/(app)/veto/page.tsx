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

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamId = (memberships ?? [])[0]?.team_id ?? null

  // Self demo map stats
  const selfMapStats: Record<string, { wins: number; losses: number; winRate: number }> = {}

  if (teamId) {
    const { data: selfDemos } = await admin
      .from('demos')
      .select('parsed_data, map')
      .eq('team_id', teamId)
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

      if (!selfMapStats[demo.map]) selfMapStats[demo.map] = { wins: 0, losses: 0, winRate: 0 }
      if (ourScore > theirScore) selfMapStats[demo.map].wins++
      else selfMapStats[demo.map].losses++
    }

    for (const [map, s] of Object.entries(selfMapStats)) {
      const total = s.wins + s.losses
      selfMapStats[map].winRate = total > 0 ? s.wins / total : 0
    }
  }

  // Opponent folders with map picks
  type OpponentEntry = {
    id: string
    name: string
    mapPicks: Record<string, number>
  }

  const opponents: OpponentEntry[] = []

  if (teamId) {
    const { data: folders } = await admin
      .from('team_folders')
      .select('id, opponent_display_name, aggregated_stats')
      .eq('user_team_id', teamId)
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
      selfMapStats={selfMapStats}
      opponents={opponents}
      activeDutyMaps={ACTIVE_DUTY}
      hasData={teamId !== null}
    />
  )
}
