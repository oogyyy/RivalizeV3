import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTeamMatchHistory, isFaceitConfigured } from '@/lib/faceit'

// GET /api/teams/[teamId]/faceit-matches
// Recent ESEA/league matches for the team's linked FACEIT team.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { teamId } = await params
  const admin = createAdminClient()

  // Caller must be a member of the team.
  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', teamId).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: team } = await admin
    .from('teams').select('faceit_team_id').eq('id', teamId).single()
  const faceitTeamId = (team as { faceit_team_id?: string | null } | null)?.faceit_team_id
  if (!faceitTeamId) return NextResponse.json({ matches: [] })

  if (!isFaceitConfigured()) {
    return NextResponse.json({ error: 'FACEIT integration is not configured.', matches: [] }, { status: 503 })
  }

  try {
    const { matches } = await getTeamMatchHistory(faceitTeamId, 30)
    const res = NextResponse.json({ matches })
    res.headers.set('Cache-Control', 'private, max-age=300')
    return res
  } catch {
    return NextResponse.json({ error: 'Failed to load FACEIT matches', matches: [] }, { status: 502 })
  }
}
