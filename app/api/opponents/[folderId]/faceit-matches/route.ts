import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTeamMatchHistory, isFaceitConfigured } from '@/lib/faceit'

// GET /api/opponents/[folderId]/faceit-matches
// Recent ESEA/league matches for the folder's linked FACEIT team.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { folderId } = await params
  const admin = createAdminClient()

  const { data: folder } = await admin
    .from('team_folders')
    .select('user_team_id, faceit_team_id')
    .eq('id', folderId)
    .single()
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', folder.user_team_id).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const faceitTeamId = (folder as { faceit_team_id?: string | null }).faceit_team_id
  if (!faceitTeamId) return NextResponse.json({ matches: [] })

  if (!isFaceitConfigured()) {
    return NextResponse.json({ error: 'FACEIT integration is not configured.', matches: [] }, { status: 503 })
  }

  try {
    const { matches } = await getTeamMatchHistory(faceitTeamId, 30)
    return NextResponse.json({ matches })
  } catch {
    return NextResponse.json({ error: 'Failed to load FACEIT matches', matches: [] }, { status: 502 })
  }
}
