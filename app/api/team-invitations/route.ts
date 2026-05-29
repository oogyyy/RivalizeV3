import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('team_invitations')
    .select(`
      id, status, created_at,
      team:teams!team_invitations_team_id_fkey(id, name, slug, logo_url),
      inviter:profiles!team_invitations_inviter_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  type TeamRow = { id: string; name: string; slug: string; logo_url: string | null }
  type InviterRow = { id: string; username: string; display_name: string | null; avatar_url: string | null }

  const invitations = (rows ?? []).map(row => {
    const r = row as unknown as {
      id: string; status: string; created_at: string
      team: TeamRow[]; inviter: InviterRow[]
    }
    return {
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      team: r.team[0],
      inviter: r.inviter[0],
    }
  })

  return NextResponse.json(invitations)
}
