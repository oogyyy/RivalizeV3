import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTeamMatchHistory, getMatchVeto, isFaceitConfigured } from '@/lib/faceit'

export const maxDuration = 30

interface MapCount { map: string; count: number }

function topCounts(tally: Record<string, number>): MapCount[] {
  return Object.entries(tally)
    .map(([map, count]) => ({ map, count }))
    .sort((a, b) => b.count - a.count)
}

// GET /api/opponents/[folderId]/veto-stats
// Aggregated first/second/third map-ban tendencies for the linked FACEIT team,
// computed from the veto sequence of their recent ESEA matches.
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
    .from('team_folders').select('user_team_id, faceit_team_id').eq('id', folderId).single()
  if (!folder) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members').select('role')
    .eq('team_id', folder.user_team_id).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const faceitTeamId = (folder as { faceit_team_id?: string | null }).faceit_team_id
  if (!faceitTeamId || !isFaceitConfigured()) {
    return NextResponse.json({ analyzed: 0, firstBans: [], secondBans: [], thirdBans: [] })
  }

  try {
    const { matches } = await getTeamMatchHistory(faceitTeamId, 30)
    // Cap the per-match veto fetches to keep the request bounded.
    const sample = matches.slice(0, 20)

    const vetoes = await Promise.all(
      sample.map(async m => ({ ourFaction: m.ourFaction, steps: await getMatchVeto(m.matchId) })),
    )

    const banTallies: Array<Record<string, number>> = [{}, {}, {}] // 1st, 2nd, 3rd ban
    let analyzed = 0

    for (const { ourFaction, steps } of vetoes) {
      if (!steps) continue
      const ourDrops = steps.filter(s => s.status === 'drop' && s.faction === ourFaction)
      if (ourDrops.length === 0) continue
      analyzed++
      ourDrops.slice(0, 3).forEach((d, i) => {
        banTallies[i][d.map] = (banTallies[i][d.map] ?? 0) + 1
      })
    }

    return NextResponse.json({
      analyzed,
      firstBans:  topCounts(banTallies[0]),
      secondBans: topCounts(banTallies[1]),
      thirdBans:  topCounts(banTallies[2]),
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to load veto stats', analyzed: 0, firstBans: [], secondBans: [], thirdBans: [] },
      { status: 502 },
    )
  }
}
