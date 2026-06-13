import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseFaceitTeamId, getTeam, isFaceitConfigured } from '@/lib/faceit'

/** Verify the caller is an owner/admin of the folder's team. Returns the folder or an error response. */
async function authorize(req: NextRequest, folderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: folder } = await admin
    .from('team_folders').select('user_team_id').eq('id', folderId).single()
  if (!folder) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }

  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', folder.user_team_id).eq('user_id', user.id).single()
  if (!member || !['owner', 'admin'].includes(member.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { admin }
}

// PATCH /api/opponents/[folderId]/faceit-team  body: { input: string }
// Accepts a FACEIT team URL or a bare team UUID, validates it against FACEIT,
// and stores the id + resolved team name on the folder.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const { folderId } = await params
  const auth = await authorize(req, folderId)
  if (auth.error) return auth.error
  const { admin } = auth

  const { input } = await req.json() as { input?: string }
  const teamId = input ? parseFaceitTeamId(input) : null
  if (!teamId) {
    return NextResponse.json(
      { error: 'Could not find a FACEIT team id. Paste the team URL or its id.' },
      { status: 400 },
    )
  }

  if (!isFaceitConfigured()) {
    return NextResponse.json({ error: 'FACEIT integration is not configured.' }, { status: 503 })
  }

  let teamName: string
  try {
    const team = await getTeam(teamId)
    teamName = team.name || team.nickname
  } catch {
    return NextResponse.json(
      { error: 'No FACEIT team found for that id. Double-check the link.' },
      { status: 404 },
    )
  }

  await admin.from('team_folders')
    .update({ faceit_team_id: teamId, faceit_team_name: teamName } as Record<string, unknown>)
    .eq('id', folderId)

  return NextResponse.json({ faceitTeamId: teamId, faceitTeamName: teamName })
}

// DELETE /api/opponents/[folderId]/faceit-team  — unlink the FACEIT team
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const { folderId } = await params
  const auth = await authorize(req, folderId)
  if (auth.error) return auth.error
  const { admin } = auth

  await admin.from('team_folders')
    .update({ faceit_team_id: null, faceit_team_name: null } as Record<string, unknown>)
    .eq('id', folderId)

  return NextResponse.json({ ok: true })
}
