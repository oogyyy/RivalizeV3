export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import PersonalStatsAndDemos from '@/app/(app)/improve/PersonalStatsAndDemos'
import type { DemoRowData } from '@/components/teams/DemoListMultiSelect'

/**
 * Auto-provisions a hidden personal team for the user if one doesn't exist yet.
 * Personal teams are excluded from the My Teams page (is_personal=true).
 */
async function getOrCreatePersonalTeam(
  userId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string> {
  // Look for existing personal team
  const { data: existing } = await admin
    .from('teams')
    .select('id')
    .eq('created_by', userId)
    .eq('is_personal', true)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  // Create one — slug must be unique; use user id prefix to guarantee it
  const slug = `personal-${userId.slice(0, 8)}`
  const { data: team, error } = await admin
    .from('teams')
    .insert({ name: 'Personal', slug, created_by: userId, is_personal: true })
    .select('id')
    .single()

  if (error || !team) throw new Error(`Failed to create personal team: ${error?.message}`)

  // Add the user as owner
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
    .select('id, status, map, match_date, created_at, opponent_slug, league, faceit_match_id, parsed_data, error_message, processing_started_at')
    .eq('team_id', personalTeamId)
    .eq('demo_type', 'self')
    .order('created_at', { ascending: false })
    .limit(100)

  const demos = (demosData ?? []) as DemoRowData[]

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6">

      {/* ── Header ── */}
      <div className="animate-fade-in-up">
        <PageHeader
          label="04 Improve"
          title="My Matches"
          description="Track your personal performance across pugs, matchmaking, and scrims"
          actions={
            <div className="flex items-center gap-2">
              {demos.length > 0 && (
                <DemoUploadButton teamId={personalTeamId} demoType="self" />
              )}
            </div>
          }
        />
      </div>

      <PersonalStatsAndDemos
        initialDemos={demos}
        personalTeamId={personalTeamId}
        steamId={steamId}
        faceitPlayerId={faceitPlayerId}
      />
    </div>
  )
}
