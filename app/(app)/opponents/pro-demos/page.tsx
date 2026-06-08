export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import ProDemosClient from './ProDemosClient'

export default async function ProDemosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Fetch all teams the user belongs to (for the import team selector)
  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, teams(id, name)')
    .eq('user_id', user.id)

  const teams: { id: string; name: string }[] = []
  for (const m of memberships ?? []) {
    const t = m.teams as unknown as { id: string; name: string } | null
    if (t?.id && t?.name) teams.push({ id: t.id, name: t.name })
  }

  const defaultTeamId = teams[0]?.id ?? null

  return (
    <ProDemosClient
      teams={teams}
      defaultTeamId={defaultTeamId}
    />
  )
}
