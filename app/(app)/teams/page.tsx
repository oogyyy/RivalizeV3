import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { Plus, Users, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TeamCard from '@/components/teams/TeamCard'
import CreateTeamDialog from './CreateTeamDialog'

export default async function TeamsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client to bypass RLS recursion; authorization is enforced by filtering on user.id
  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)

  const { data: teamsData } = teamIds.length
    ? await admin
        .from('teams')
        .select('id, name, slug, logo_url')
        .in('id', teamIds)
    : { data: [] }

  const teamById = Object.fromEntries((teamsData ?? []).map((t) => [t.id, t]))

  // Member counts per team
  const { data: allMembers } = teamIds.length
    ? await admin
        .from('team_members')
        .select('team_id')
        .in('team_id', teamIds)
    : { data: [] }

  const memberCountMap: Record<string, number> = {}
  for (const m of allMembers ?? []) {
    memberCountMap[m.team_id] = (memberCountMap[m.team_id] ?? 0) + 1
  }

  // Demo counts per team
  const { data: allDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('team_id, parsed_data')
        .in('team_id', teamIds)
    : { data: [] }

  const demoCountMap: Record<string, number> = {}
  const winMap: Record<string, { wins: number; total: number }> = {}

  for (const d of allDemos ?? []) {
    demoCountMap[d.team_id] = (demoCountMap[d.team_id] ?? 0) + 1
    // Calculate win rate from parsed_data if available
    if (d.parsed_data) {
      const pd = d.parsed_data as { header?: { score_team1?: number; score_team2?: number } }
      if (pd.header) {
        if (!winMap[d.team_id]) winMap[d.team_id] = { wins: 0, total: 0 }
        winMap[d.team_id].total++
        if ((pd.header.score_team1 ?? 0) > (pd.header.score_team2 ?? 0)) {
          winMap[d.team_id].wins++
        }
      }
    }
  }

  type TeamEntry = {
    id: string
    name: string
    slug: string
    logo_url: string | null
    memberCount: number
    demoCount: number
    userRole: string
    winRate?: number
  }

  const teams: TeamEntry[] = (memberships ?? []).flatMap((m) => {
    const team = teamById[m.team_id]
    if (!team) return []
    const wr = winMap[team.id]
    return [{
      id: team.id,
      name: team.name,
      slug: team.slug,
      logo_url: team.logo_url,
      memberCount: memberCountMap[team.id] ?? 0,
      demoCount: demoCountMap[team.id] ?? 0,
      userRole: m.role,
      winRate: wr ? Math.round((wr.wins / wr.total) * 100) : undefined,
    }]
  })

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Teams</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your teams and scout upcoming opponents
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <CreateTeamDialog />
        </div>
      </div>

      {/* Stats bar */}
      {teams.length > 0 && (
        <div className="flex items-center gap-4 md:gap-6 p-4 rounded-lg bg-card border border-border overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded bg-neon-green/10 flex items-center justify-center">
              <Users size={16} className="text-neon-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teams</p>
              <p className="text-lg font-bold text-foreground">{teams.length}</p>
            </div>
          </div>
          <div className="w-px h-8 bg-border shrink-0" />
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded bg-neon-green/10 flex items-center justify-center">
              <Shield size={16} className="text-neon-green" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Owner of</p>
              <p className="text-lg font-bold text-foreground">
                {teams.filter((t) => t.userRole === 'owner').length}
              </p>
            </div>
          </div>
          <div className="w-px h-8 bg-border shrink-0" />
          <div className="shrink-0">
            <p className="text-xs text-muted-foreground">Opponent Demos</p>
            <p className="text-lg font-bold text-foreground">
              {Object.values(demoCountMap).reduce((a, b) => a + b, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Teams grid */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-neon-green/10 border border-neon-green/20 flex items-center justify-center mb-4">
            <Users size={32} className="text-neon-green" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No teams yet</h2>
          <p className="text-muted-foreground max-w-sm mb-6">
            Create your team and start adding upcoming opponents to prepare for matches.
          </p>
          <CreateTeamDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
          {/* Create team card */}
          <CreateTeamDialog asCard />
        </div>
      )}
    </div>
  )
}
