import { getCurrentUser } from '@/lib/auth/get-user'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import FaceitImportClient from './FaceitImportClient'

export default async function FaceitImportPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true })

  const teams = (memberships ?? []).map((m) => ({
    id: m.team_id,
    name: (m.teams as unknown as { id: string; name: string } | null)?.name ?? 'Unknown Team',
  }))

  const primaryTeamId = teams[0]?.id ?? null

  return <FaceitImportClient teams={teams} defaultTeamId={primaryTeamId} />
}
