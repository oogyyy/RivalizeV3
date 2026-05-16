import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateMockDemoData } from '@/lib/demo-parser/mock-parser'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { demoId } = await params

  // Fetch the demo
  const { data: demo, error: fetchError } = await supabase
    .from('demos')
    .select('*')
    .eq('id', demoId)
    .single()

  if (fetchError || !demo) {
    return NextResponse.json({ error: 'Demo not found' }, { status: 404 })
  }

  // Verify user has access (belongs to team)
  const { data: membership } = await supabase
    .from('team_members')
    .select('user_id')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Mark as processing
  await supabase.from('demos').update({ status: 'processing' }).eq('id', demoId)

  try {
    // Generate parsed data using mock parser
    // In production, this would invoke a real CS2 demo parser (demoparser2, etc.)
    const parsedData = generateMockDemoData(
      'My Team',
      demo.opponent_name,
      demo.map !== 'unknown' ? demo.map : undefined
    )

    const { error: updateError } = await supabase
      .from('demos')
      .update({
        parsed_data: parsedData,
        status: 'completed',
        map: parsedData.header.map,
      })
      .eq('id', demoId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Update folder aggregated stats if folder exists
    if (demo.opponent_slug) {
      const { data: allDemos } = await supabase
        .from('demos')
        .select('parsed_data, status')
        .eq('team_id', demo.team_id)
        .eq('opponent_slug', demo.opponent_slug)
        .eq('status', 'completed')

      if (allDemos && allDemos.length > 0) {
        const wins = allDemos.filter(d => {
          const h = (d.parsed_data as { header?: { score_team1?: number; score_team2?: number } } | null)?.header
          return h && (h.score_team1 ?? 0) > (h.score_team2 ?? 0)
        }).length

        // Aggregate map stats
        const mapsPlayed: Record<string, number> = {}
        for (const d of allDemos) {
          const map = (d.parsed_data as { header?: { map?: string } } | null)?.header?.map
          if (map) mapsPlayed[map] = (mapsPlayed[map] || 0) + 1
        }

        const topPlayers = computeTopPlayers(allDemos)

        await supabase
          .from('team_folders')
          .update({
            aggregated_stats: {
              total_matches: allDemos.length,
              wins,
              losses: allDemos.length - wins,
              draws: 0,
              win_rate: allDemos.length > 0 ? wins / allDemos.length : 0,
              avg_rating: topPlayers.length > 0 ? topPlayers.reduce((s, p) => s + p.rating, 0) / topPlayers.length : 1.0,
              maps_played: mapsPlayed,
              top_players: topPlayers,
            },
          })
          .eq('user_team_id', demo.team_id)
          .eq('opponent_slug', demo.opponent_slug)
      }
    }

    return NextResponse.json({ success: true, parsedData })
  } catch (err) {
    await supabase
      .from('demos')
      .update({ status: 'failed', error_message: String(err) })
      .eq('id', demoId)

    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
