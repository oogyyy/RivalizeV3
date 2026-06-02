import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getPlayerMatchHistory, getMatchDetail, isFaceitConfigured } from '@/lib/faceit'

/**
 * GET /api/matches/recent-faceit
 * Returns the user's recent FACEIT CS2 match history using their stored
 * faceit_player_id. Also flags which matches have already been imported.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isFaceitConfigured()) {
    return NextResponse.json({ matches: [], configured: false })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('faceit_player_id')
    .eq('id', user.id)
    .single()

  const playerId = profile?.faceit_player_id as string | null | undefined
  if (!playerId) {
    return NextResponse.json({ matches: [], configured: true, linked: false })
  }

  try {
    const history = await getPlayerMatchHistory(playerId, 15)
    const matchIds = history.items.map(m => m.match_id)

    // Check which are already imported as personal demos
    let importedIds = new Set<string>()
    if (matchIds.length > 0) {
      const { data: existing } = await admin
        .from('demos')
        .select('faceit_match_id')
        .eq('created_by', user.id)
        .in('faceit_match_id', matchIds)

      importedIds = new Set(
        (existing ?? [])
          .map((d: { faceit_match_id: string | null }) => d.faceit_match_id)
          .filter(Boolean) as string[]
      )
    }

    // Fetch match details in parallel to get map names
    const details = await Promise.allSettled(
      history.items.map(m => getMatchDetail(m.match_id))
    )

    const matches = history.items.map((m, i) => {
      const detail = details[i].status === 'fulfilled' ? details[i].value : null

      // Use detail roster when available — the history endpoint often omits rosters,
      // causing wrong faction detection and inverted W/L + scores.
      const teams = detail?.teams ?? m.teams
      const inF1 = teams.faction1.roster?.some(p => p.player_id === playerId) ?? false
      const myFaction = inF1 ? 'faction1' : 'faction2'
      const oppFaction = inF1 ? 'faction2' : 'faction1'

      const map = detail?.voting?.map?.pick?.[0] ?? null

      return {
        match_id: m.match_id,
        competition_name: m.competition_name,
        started_at: m.started_at,
        my_team: m.teams[myFaction].name ?? null,
        opponent: m.teams[oppFaction].name ?? null,
        score: m.results?.score ?? null,
        winner: m.results?.winner ?? null,
        my_faction: myFaction,
        match_url: m.match_url,
        map,
        imported: importedIds.has(m.match_id),
      }
    })

    return NextResponse.json({ matches, configured: true, linked: true })
  } catch {
    return NextResponse.json({ matches: [], configured: true, linked: true, error: 'Failed to fetch FACEIT history' })
  }
}
