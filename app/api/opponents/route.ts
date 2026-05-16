import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/** Returns all opponent folders across all teams the user belongs to. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m) => m.team_id).filter(Boolean)
  if (!teamIds.length) return NextResponse.json([])

  const { data: folders, error } = await admin
    .from('team_folders')
    .select('*')
    .in('user_team_id', teamIds)
    .order('opponent_display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(folders ?? [])
}
