export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { Users, Shield, FileVideo } from 'lucide-react'
import TeamCard from '@/components/teams/TeamCard'
import CreateTeamDialog from './CreateTeamDialog'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

export default async function TeamsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)

  const { data: teamsData } = teamIds.length
    ? await admin.from('teams').select('id, name, slug, logo_url').in('id', teamIds)
    : { data: [] }

  const teamById = Object.fromEntries((teamsData ?? []).map((t) => [t.id, t]))

  const { data: allMembers } = teamIds.length
    ? await admin.from('team_members').select('team_id').in('team_id', teamIds)
    : { data: [] }

  const memberCountMap: Record<string, number> = {}
  for (const m of allMembers ?? []) {
    memberCountMap[m.team_id] = (memberCountMap[m.team_id] ?? 0) + 1
  }

  const { data: allDemos } = teamIds.length
    ? await admin.from('demos').select(`team_id, ${PARSED_SUMMARY_SELECT}`).in('team_id', teamIds)
    : { data: [] }

  const demoCountMap: Record<string, number> = {}
  const winMap: Record<string, { wins: number; total: number }> = {}

  for (const r of (allDemos ?? []) as Array<{ team_id: string } & ParsedSummaryRow>) {
    const d = { team_id: r.team_id, parsed_data: summaryToParsedData(r) }
    demoCountMap[d.team_id] = (demoCountMap[d.team_id] ?? 0) + 1
    if (d.parsed_data) {
      const pd = d.parsed_data as { header?: { score_team1?: number; score_team2?: number } }
      if (pd.header) {
        if (!winMap[d.team_id]) winMap[d.team_id] = { wins: 0, total: 0 }
        winMap[d.team_id].total++
        if ((pd.header.score_team1 ?? 0) > (pd.header.score_team2 ?? 0)) winMap[d.team_id].wins++
      }
    }
  }

  type TeamEntry = {
    id: string; name: string; slug: string; logo_url: string | null
    memberCount: number; demoCount: number; userRole: string; winRate?: number
  }

  const teams: TeamEntry[] = (memberships ?? []).flatMap((m) => {
    const team = teamById[m.team_id]
    if (!team) return []
    const wr = winMap[team.id]
    return [{ id: team.id, name: team.name, slug: team.slug, logo_url: team.logo_url,
      memberCount: memberCountMap[team.id] ?? 0, demoCount: demoCountMap[team.id] ?? 0,
      userRole: m.role, winRate: wr ? Math.round((wr.wins / wr.total) * 100) : undefined }]
  })

  const totalDemos = Object.values(demoCountMap).reduce((a, b) => a + b, 0)
  const ownedCount = teams.filter((t) => t.userRole === 'owner').length

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">

      {/* Compact header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl font-bold text-foreground shrink-0">My Teams</h1>
          {teams.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users size={12} style={{ color: 'var(--accent)' }} />
                <span className="font-semibold text-foreground">{teams.length}</span> team{teams.length !== 1 ? 's' : ''}
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Shield size={12} style={{ color: 'var(--accent)' }} />
                <span className="font-semibold text-foreground">{ownedCount}</span> owned
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <FileVideo size={12} style={{ color: 'var(--accent)' }} />
                <span className="font-semibold text-foreground">{totalDemos}</span> demos
              </span>
            </div>
          )}
        </div>
        <CreateTeamDialog />
      </div>

      {/* Teams list */}
      {teams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
            <Users size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-1">No teams yet</h2>
          <p className="text-sm text-muted-foreground max-w-xs mb-5">
            Create your team and start scouting upcoming opponents.
          </p>
          <CreateTeamDialog />
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
          <CreateTeamDialog asCard />
        </div>
      )}
    </div>
  )
}
