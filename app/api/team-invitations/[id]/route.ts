import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await req.json() as { action?: 'accept' | 'decline' }
  if (!action || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: invitation } = await admin
    .from('team_invitations')
    .select('*')
    .eq('id', id)
    .eq('invitee_id', user.id)
    .eq('status', 'pending')
    .single()

  if (!invitation) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })

  if (action === 'accept') {
    const { error: memberError } = await admin
      .from('team_members')
      .insert({ team_id: invitation.team_id, user_id: user.id, role: 'member' })

    if (memberError && memberError.code !== '23505') {
      return NextResponse.json({ error: memberError.message }, { status: 500 })
    }

    await admin
      .from('team_invitations')
      .update({ status: 'accepted' })
      .eq('id', id)

    return NextResponse.json({ message: 'Invitation accepted', team_id: invitation.team_id })
  } else {
    await admin
      .from('team_invitations')
      .update({ status: 'declined' })
      .eq('id', id)

    return NextResponse.json({ message: 'Invitation declined' })
  }
}
