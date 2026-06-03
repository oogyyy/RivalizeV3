export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import DemoUploadButton from '@/components/teams/DemoUploadButton'
import OpponentsPageClient from '@/components/teams/OpponentsPageClient'
import type { AggregatedStats } from '@/types/database'

export default async function OpponentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, role, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  let primaryTeamId: string | null = (memberships ?? [])[0]?.team_id ?? null

  if (!primaryTeamId) {
    const displayName = profile?.display_name || profile?.username || 'Player'
    const teamName = `${displayName}'s Team`
    const slug = teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Math.random().toString(36).slice(2, 6)

    const { data: newTeam } = await admin
      .from('teams')
      .insert({ name: teamName, slug, created_by: user.id })
      .select('id')
      .single()

    if (newTeam) {
      await admin
        .from('team_members')
        .insert({ team_id: newTeam.id, user_id: user.id, role: 'owner' })
      primaryTeamId = newTeam.id
    }
  }

  const { data: folders } = primaryTeamId
    ? await admin
        .from('team_folders')
        .select('*')
        .eq('user_team_id', primaryTeamId)
        .order('updated_at', { ascending: false })
    : { data: [] }

  const { data: allDemos } = primaryTeamId
    ? await admin
        .from('demos')
        .select('id, opponent_slug, status, created_at, match_date')
        .eq('team_id', primaryTeamId)
        .eq('demo_type', 'opponent')
    : { data: [] }

  type DemoRow = {
    id: string
    opponent_slug: string | null
    status: string
    created_at: string
    match_date: string | null
  }

  const demosBySlug: Record<string, DemoRow[]> = {}
  for (const d of (allDemos ?? []) as DemoRow[]) {
    if (!d.opponent_slug) continue
    if (!demosBySlug[d.opponent_slug]) demosBySlug[d.opponent_slug] = []
    demosBySlug[d.opponent_slug].push(d)
  }

  const opponents = (folders ?? []).map(folder => {
    const demos = demosBySlug[folder.opponent_slug] ?? []
    const lastActivity = demos
      .map(d => d.match_date ?? d.created_at)
      .sort()
      .at(-1)

    return {
      id:                    folder.id,
      opponent_display_name: folder.opponent_display_name,
      opponent_slug:         folder.opponent_slug,
      aggregated_stats:      folder.aggregated_stats as AggregatedStats | null,
      demoCount:             demos.length,
      lastActivity,
    }
  })

  return (
    <OpponentsPageClient
      opponents={opponents}
      uploadButton={primaryTeamId ? <DemoUploadButton teamId={primaryTeamId} /> : undefined}
    />
  )
}
