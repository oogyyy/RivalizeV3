import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getPlayerByNickname, getPlayerMatchHistory, isFaceitConfigured } from '@/lib/faceit'

/**
 * GET /api/demos/faceit/pending?nickname=xxx&teamId=yyy
 * Returns how many recent FACEIT matches haven't been imported yet,
 * plus the player's current ELO/level.
 * Called on mount by FaceitImportButton for the auto-badge.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isFaceitConfigured()) {
    return NextResponse.json({ pending: 0, elo: null, level: null })
  }

  const { searchParams } = new URL(request.url)
  const nickname = searchParams.get('nickname')
  const teamId   = searchParams.get('teamId')

  if (!nickname) return NextResponse.json({ pending: 0, elo: null, level: null })

  const admin = createAdminClient()

  try {
    const player  = await getPlayerByNickname(nickname)
    const cs2     = player.games?.cs2
    const elo     = cs2?.faceit_elo ?? null
    const level   = cs2?.skill_level ?? null

    const history = await getPlayerMatchHistory(player.player_id, 20)
    const matchIds = history.items.map(m => m.match_id)

    // Check which of these match_ids are already in our demos table
    let importedIds: Set<string> = new Set()
    if (teamId && matchIds.length > 0) {
      const { data: existing } = await admin
        .from('demos')
        .select('faceit_match_id')
        .eq('team_id', teamId)
        .in('faceit_match_id', matchIds)

      importedIds = new Set((existing ?? []).map((d: { faceit_match_id: string | null }) => d.faceit_match_id).filter(Boolean) as string[])
    }

    const pending = matchIds.filter(id => !importedIds.has(id)).length

    return NextResponse.json({ pending, elo, level, total: matchIds.length })
  } catch {
    return NextResponse.json({ pending: 0, elo: null, level: null })
  }
}
