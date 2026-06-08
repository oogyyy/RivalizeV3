export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import MyTeamDashboard from '@/components/teams/MyTeamDashboard'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

interface TeamOption {
  id: string
  name: string
  role: 'owner' | 'admin' | 'member'
}

export default async function MyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch all memberships + team names in one query
  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const membershipList = memberships ?? []
  const teamIds = membershipList.map(m => m.team_id).filter(Boolean)

  // Fetch all team names — exclude personal teams (those belong to /improve)
  const { data: teamRows } = await admin
    .from('teams')
    .select('id, name, is_personal')
    .in('id', teamIds)

  const teamMap = new Map(
    (teamRows ?? []).filter(t => !t.is_personal).map(t => [t.id, t.name as string])
  )

  const allTeams: TeamOption[] = membershipList
    .filter(m => teamMap.has(m.team_id))
    .map(m => ({ id: m.team_id, name: teamMap.get(m.team_id)!, role: m.role as 'owner' | 'admin' | 'member' }))

  // No real teams yet (user might only have a personal /improve team)
  if (allTeams.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-5 md:p-7">
        <div style={{ marginTop: '60px', textAlign: 'center', opacity: 0.7 }}>
          <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>No teams yet</p>
          <p style={{ fontSize: '14px', marginBottom: '24px' }}>Create a team to start tracking your performance</p>
        </div>
      </div>
    )
  }

  // Resolve selected team from URL param (fall back to first real team)
  const { team: teamParam } = await searchParams
  const allTeamIds = allTeams.map(t => t.id)
  const selectedTeamId =
    (teamParam && allTeamIds.includes(teamParam) ? teamParam : null) ?? allTeamIds[0]

  const myRole = membershipList.find(m => m.team_id === selectedTeamId)?.role ?? null
  const canInvite = myRole === 'owner' || myRole === 'admin'
  const canEdit   = myRole === 'owner' || myRole === 'admin'
  const canDelete = myRole === 'owner'

  const teamName = teamMap.get(selectedTeamId) ?? 'My Team'

  const [membersRes, profileRes, demosRes] = await Promise.all([
    admin.from('team_members').select('user_id').eq('team_id', selectedTeamId),
    admin.from('profiles').select('faceit_id').eq('id', user.id).single(),
    admin
      .from('demos')
      .select('id, status, map, match_date, created_at, opponent_slug, parsed_data, error_message, processing_started_at')
      .eq('team_id', selectedTeamId)
      .eq('demo_type', 'self')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const _memberIds = (membersRes.data ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean)
  const myFaceitId = profileRes.data?.faceit_id ?? null
  const demos = (demosRes.data ?? []) as DemoRowData[]

  return (
    <MyTeamDashboard
      selectedTeamId={selectedTeamId}
      allTeams={allTeams}
      demos={demos}
      teamName={teamName}
      canEdit={canEdit}
      canInvite={canInvite}
      canDelete={canDelete}
      myFaceitId={myFaceitId}
    />
  )
}
