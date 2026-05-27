export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import MyTeamStatsAndDemos from '@/components/teams/MyTeamStatsAndDemos'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

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
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-[0.14em] mb-1">
            My Team
          </p>
          <h1 className="text-[22px] md:text-2xl font-bold text-foreground tracking-tight">{teamName}</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Your team&apos;s performance overview</p>
        </div>
        {primaryTeamId && (
          <DemoUploadButton teamId={primaryTeamId} demoType="self" />
        )}
      </div>

      <MyTeamStatsAndDemos initialDemos={demos} primaryTeamId={primaryTeamId} />
    </div>
  )
}
