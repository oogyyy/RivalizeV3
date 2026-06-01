export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import FaceitImportButton from '@/components/teams/FaceitImportButton'
import MyTeamStatsAndDemos from '@/components/teams/MyTeamStatsAndDemos'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'
import { PageHeader } from '@/components/layout/PageHeader'
import CreateTeamDialog from '@/app/(app)/teams/CreateTeamDialog'
import InviteFriendsDialog from '@/app/(app)/teams/[teamId]/InviteFriendsDialog'
import EditTeamNameDialog from '@/app/(app)/my-team/EditTeamNameDialog'
import DeleteTeamDialog from '@/app/(app)/my-team/DeleteTeamDialog'
import TeamSwitcher from '@/app/(app)/my-team/TeamSwitcher'
import type { TeamOption } from '@/app/(app)/my-team/TeamSwitcher'

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
    .map(m => ({ id: m.team_id, name: teamMap.get(m.team_id)!, role: m.role }))

  // No real teams yet (user might only have a personal /improve team)
  if (allTeams.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">
        <div className="animate-fade-in-up">
          <PageHeader
            label="My Teams"
            title="No team yet"
            description="Create a team to start tracking your performance"
            actions={<CreateTeamDialog />}
          />
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

  const memberIds = (membersRes.data ?? []).map((m: { user_id: string }) => m.user_id).filter(Boolean)
  const myFaceitId = profileRes.data?.faceit_id ?? null
  const demos = (demosRes.data ?? []) as DemoRowData[]

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">

      {/* ── Header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          label="My Teams"
          title={teamName}
          description="Your team's performance overview"
          actions={
            <div className="flex items-center gap-2">
              {/* Team switcher — only shown when user is in multiple teams */}
              {allTeams.length > 1 && (
                <TeamSwitcher teams={allTeams} selectedTeamId={selectedTeamId} />
              )}
              {canEdit && (
                <EditTeamNameDialog teamId={selectedTeamId} currentName={teamName} />
              )}
              {canInvite && (
                <InviteFriendsDialog teamId={selectedTeamId} existingMemberIds={memberIds} />
              )}
              {myFaceitId && (
                <FaceitImportButton teamId={selectedTeamId} faceitNickname={myFaceitId} />
              )}
              <DemoUploadButton teamId={selectedTeamId} demoType="self" />
              <CreateTeamDialog />
              {canDelete && (
                <DeleteTeamDialog teamId={selectedTeamId} teamName={teamName} />
              )}
            </div>
          }
        />
      </div>

      <MyTeamStatsAndDemos
        initialDemos={demos}
        primaryTeamId={selectedTeamId}
        faceitNickname={myFaceitId}
      />
    </div>
  )
}
