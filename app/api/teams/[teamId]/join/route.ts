import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params

  let body: { inviteCode?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { inviteCode } = body
  if (!inviteCode) {
    return NextResponse.json({ error: 'inviteCode is required' }, { status: 400 })
  }

  // Validate invite code against team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('id', teamId)
    .eq('invite_code', inviteCode)
    .maybeSingle()

  if (!team) {
    return NextResponse.json({ error: 'Invalid invite code' }, { status: 400 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'You are already a member of this team' }, { status: 400 })
  }

  const { error } = await supabase.from('team_members').insert({
    team_id: teamId,
    user_id: user.id,
    role: 'member',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
