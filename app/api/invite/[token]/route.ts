import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/invite/[token]
// Public — returns invite metadata so the landing page can render.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: invite, error } = await admin
    .from('team_email_invites')
    .select(
      `id, team_id, email, role, accepted_at, expires_at,
       teams ( name ),
       profiles ( display_name, username )`
    )
    .eq('token', token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const expired = new Date(invite.expires_at) < new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamName = (invite.teams as any)?.name ?? 'Unknown Team'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = invite.profiles as any
  const inviterName = profile?.display_name ?? profile?.username ?? 'A teammate'

  return NextResponse.json({
    teamId: invite.team_id,
    teamName,
    inviterName,
    email: invite.email,
    role: invite.role,
    expired,
    alreadyAccepted: invite.accepted_at !== null,
  })
}

// POST /api/invite/[token]
// Requires auth. Accepts the invite and adds the user to the team.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: invite, error: fetchError } = await admin
    .from('team_email_invites')
    .select('id, team_id, email, role, accepted_at, expires_at')
    .eq('token', token)
    .single()

  if (fetchError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  if (invite.accepted_at !== null) {
    return NextResponse.json({ error: 'Invite has already been accepted' }, { status: 409 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invite has expired' }, { status: 410 })
  }

  // Verify the logged-in user's email matches the invite email
  if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      {
        error: `This invite was sent to ${invite.email}. Please sign in with that email address.`,
      },
      { status: 403 }
    )
  }

  // Check not already a member
  const { data: existingMember } = await admin
    .from('team_members')
    .select('user_id')
    .eq('team_id', invite.team_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    // Mark accepted anyway so the invite doesn't linger
    await admin
      .from('team_email_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
    return NextResponse.json({ teamId: invite.team_id, alreadyMember: true })
  }

  // Add to team
  const { error: insertError } = await admin.from('team_members').insert({
    team_id: invite.team_id,
    user_id: user.id,
    role: invite.role,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Mark invite as accepted
  await admin
    .from('team_email_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return NextResponse.json({ teamId: invite.team_id })
}
