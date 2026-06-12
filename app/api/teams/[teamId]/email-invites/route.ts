import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTeamInviteEmail } from '@/lib/email'

// POST /api/teams/[teamId]/email-invites
// Body: { email: string, role?: 'admin' | 'member' }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Must be owner or admin of this team
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as { email?: string; role?: string }
  const email = body.email?.trim().toLowerCase()
  const role = (body.role ?? 'member') as 'admin' | 'member'

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  if (!['admin', 'member'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }

  // Check if a user with this email already exists and is a team member.
  // Email lives in auth.users — use the admin auth API to look it up.
  const { data: authUserData } = await admin.auth.admin.getUserByEmail(email)
  const existingAuthUser = authUserData?.user ?? null

  if (existingAuthUser) {
    const { data: existingMember } = await admin
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('user_id', existingAuthUser.id)
      .maybeSingle()

    if (existingMember) {
      return NextResponse.json({ error: 'This user is already a team member' }, { status: 409 })
    }
  }

  // Fetch team and inviter info for the email
  const [{ data: team }, { data: inviterProfile }] = await Promise.all([
    admin.from('teams').select('name').eq('id', teamId).single(),
    admin.from('profiles').select('display_name, username').eq('id', user.id).single(),
  ])

  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 })

  // Upsert invite — regenerate token + reset expiry on re-invite
  const { data: invite, error: upsertError } = await admin
    .from('team_email_invites')
    .upsert(
      {
        team_id: teamId,
        invited_by: user.id,
        email,
        role,
        token: undefined, // let the default gen_random_bytes generate it fresh on insert
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        accepted_at: null,
      },
      { onConflict: 'team_id,email', ignoreDuplicates: false }
    )
    .select('token')
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rivalize.gg'
  const inviterName =
    inviterProfile?.display_name ?? inviterProfile?.username ?? 'A teammate'

  try {
    await sendTeamInviteEmail({
      to: email,
      inviterName,
      teamName: team.name,
      teamId,
      token: invite.token,
      appUrl,
    })
  } catch (err) {
    console.error('[email-invites] Failed to send invite email:', err)
    // Don't fail the request — invite is saved, user can resend
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

// GET /api/teams/[teamId]/email-invites
// Returns pending (non-expired, non-accepted) invites for owners/admins
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const { data, error } = await admin
    .from('team_email_invites')
    .select('id, email, role, created_at, expires_at, accepted_at')
    .eq('team_id', teamId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

// DELETE /api/teams/[teamId]/email-invites?email=xxx
// Revoke a pending invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'email query param is required' }, { status: 400 })

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

  const { error } = await admin
    .from('team_email_invites')
    .delete()
    .eq('team_id', teamId)
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
