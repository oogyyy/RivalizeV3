export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import MyMatchesDashboard from '@/app/(app)/improve/MyMatchesDashboard'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'
import { PARSED_SUMMARY_SELECT, summaryToParsedData, type ParsedSummaryRow } from '@/lib/demo-parser/parsed-summary'

async function getOrCreatePersonalTeam(
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data: existing } = await admin
    .from('teams')
    .select('id')
    .eq('created_by', userId)
    .eq('is_personal', true)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const slug = `personal-${userId.slice(0, 8)}`
  const { data: team, error } = await admin
    .from('teams')
    .insert({ name: 'Personal', slug, created_by: userId, is_personal: true })
    .select('id')
    .single()

  if (error || !team) throw new Error(`Failed to create personal team: ${error?.message}`)

  await admin
    .from('team_members')
    .insert({ team_id: team.id, user_id: userId, role: 'owner' })

  return team.id
}

export default async function ImprovePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [personalTeamId, profileRes] = await Promise.all([
    getOrCreatePersonalTeam(user.id, admin),
    admin.from('profiles').select('steam_id, faceit_player_id').eq('id', user.id).single(),
  ])

  const steamId = profileRes.data?.steam_id ?? null
  const faceitPlayerId = (profileRes.data as Record<string, unknown> | null)?.faceit_player_id as string | null ?? null

  const { data: demosData } = await admin
    .from('demos')
    .select(`id, status, map, match_date, created_at, opponent_slug, league, faceit_match_id, error_message, processing_started_at, ${PARSED_SUMMARY_SELECT}`)
    .eq('team_id', personalTeamId)
    .eq('demo_type', 'self')
    .order('created_at', { ascending: false })
    .limit(100)

  const demos = ((demosData ?? []) as Array<Record<string, unknown> & ParsedSummaryRow>)
    .map(r => ({ ...r, parsed_data: summaryToParsedData(r) })) as unknown as DemoRowData[]

  return (
    <MyMatchesDashboard
      initialDemos={demos}
      personalTeamId={personalTeamId}
      steamId={steamId}
      faceitPlayerId={faceitPlayerId}
    />
  )
}
