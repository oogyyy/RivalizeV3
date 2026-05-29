export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import FaceitImportButton from '@/components/teams/FaceitImportButton'
import FaceitEloCard from '@/components/teams/FaceitEloCard'
import MyTeamStatsAndDemos from '@/components/teams/MyTeamStatsAndDemos'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function MyTeamPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('role, team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  const primaryTeamId = teamIds[0] ?? null

  let teamName = 'My Team'
  if (primaryTeamId) {
    const { data: team } = await admin
      .from('teams')
      .select('name')
      .eq('id', primaryTeamId)
      .single()
    if (team?.name) teamName = team.name
  }

  const { data: myProfile } = await admin
    .from('profiles')
    .select('faceit_id')
    .eq('id', user.id)
    .single()
  const myFaceitId = myProfile?.faceit_id ?? null

  const { data: recentDemos } = teamIds.length
    ? await admin
        .from('demos')
        .select('id, status, map, match_date, created_at, opponent_slug, parsed_data, error_message, processing_started_at')
        .in('team_id', teamIds)
        .eq('demo_type', 'self')
        .order('created_at', { ascending: false })
        .limit(50)
    : { data: [] }

  const demos = (recentDemos ?? []) as DemoRowData[]

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">

      {/* ── Header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          label="My Team"
          title={teamName}
          description="Your team's performance overview"
          actions={primaryTeamId ? (
            <div className="flex items-center gap-2">
              {myFaceitId && (
                <FaceitImportButton teamId={primaryTeamId} faceitNickname={myFaceitId} />
              )}
              <DemoUploadButton teamId={primaryTeamId} demoType="self" />
            </div>
          ) : undefined}
        />
      </div>

      <MyTeamStatsAndDemos
        initialDemos={demos}
        primaryTeamId={primaryTeamId}
        faceitNickname={myFaceitId}
      />
    </div>
  )
}
