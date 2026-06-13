import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Accept both invitee_id (snake_case) and inviteeId (camelCase) so a client
  // field-name mismatch can never silently break invites again.
  const body = await req.json() as { invitee_id?: string; inviteeId?: string }
  const invitee_id = body.invitee_id ?? body.inviteeId
  if (!invitee_id) return NextResponse.json({ error: 'invitee_id required' }, { status: 400 })

  // Must be friends
  const { data: friendship } = await admin
    .from('friendships')
    .select('status')
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${invitee_id}),and(requester_id.eq.${invitee_id},addressee_id.eq.${user.id})`
    )
    .single()

  if (!friendship || friendship.status !== 'accepted') {
    return NextResponse.json({ error: 'You can only invite friends' }, { status: 400 })
  }

  // Not already a member
  const { data: existing } = await admin
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('user_id', invitee_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'User is already a team member' }, { status: 409 })
  }

  const { data: invitation, error } = await admin
    .from('team_invitations')
    .upsert(
      { team_id: teamId, inviter_id: user.id, invitee_id, status: 'pending' },
      { onConflict: 'team_id,invitee_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(invitation, { status: 201 })
}

// GET: list pending invitations for this team (owner/admin only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await admin
    .from('team_invitations')
    .select('id, invitee_id, status, created_at')
    .eq('team_id', teamId)
    .eq('status', 'pending')

  return NextResponse.json(data ?? [])
}
