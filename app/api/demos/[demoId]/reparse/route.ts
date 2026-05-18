import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseCS2Demo } from '@/lib/demo-parser/real-parser'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ demoId: string }> }
) {
  const { demoId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path, opponent_slug, parsed_data')
    .eq('id', demoId)
    .single()

  if (!demo) return NextResponse.json({ error: 'Demo not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', demo.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const r2Key: string = demo.raw_file_path
  if (!r2Key) return NextResponse.json({ error: 'No file path on record' }, { status: 400 })

  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  await admin.from('demos').update({ status: 'processing' }).eq('id', demoId)

  void (async () => {
    try {
      console.log(`[reparse] Downloading ${demoId} from R2 key: ${r2Key}`)
      const rawBuf = await downloadObject(r2Key)
      const buf = maybeDecompress(rawBuf, r2Key)
      console.log(`[reparse] Downloaded ${rawBuf.length} bytes → ${buf.length} bytes after decompression, parsing...`)
      const { parsedData: realData, warnings } = parseCS2Demo(buf)
      if (warnings.length > 0) console.warn('[reparse] warnings:', warnings)
      console.log(`[reparse] Result: ${realData.players.length} players, map=${realData.header.map}, score=${realData.header.score_team1}-${realData.header.score_team2}`)

      if (realData.players.length === 0) {
        await admin
          .from('demos')
          .update({ status: 'failed', error_message: 'Demo parsed but no player data could be extracted' })
          .eq('id', demoId)
        return
      }

      const parsedData = { ...realData, opponentSide: existingOpponentSide }
      const resolvedMap = realData.header.map !== 'unknown' ? realData.header.map : 'unknown'
      await admin
        .from('demos')
        .update({ parsed_data: parsedData, status: 'completed', map: resolvedMap })
        .eq('id', demoId)

      // Refresh folder aggregated stats
      const { data: allDemos } = await admin
        .from('demos')
        .select('parsed_data')
        .eq('team_id', demo.team_id)
        .eq('opponent_slug', demo.opponent_slug)
        .eq('status', 'completed')

      if (allDemos && allDemos.length > 0) {
        type DemoRow = { header?: { score_team1?: number; score_team2?: number }; opponentSide?: string }
        const wins = allDemos.filter(d => {
          const pd = d.parsed_data as DemoRow | null
          const h = pd?.header
          if (!h) return false
          const s1 = h.score_team1 ?? 0
          const s2 = h.score_team2 ?? 0
          return (pd?.opponentSide === 'team1') ? s2 > s1 : s1 > s2
        }).length
        const draws = allDemos.filter(d => {
          const h = (d.parsed_data as DemoRow | null)?.header
          return h && (h.score_team1 ?? 0) === (h.score_team2 ?? 0)
        }).length
        const mapsPlayed: Record<string, number> = {}
        allDemos.forEach(d => {
          const m = (d.parsed_data as { header?: { map?: string } } | null)?.header?.map
          if (m) mapsPlayed[m] = (mapsPlayed[m] ?? 0) + 1
        })
        const topPlayers = computeTopPlayers(allDemos)
        await admin
          .from('team_folders')
          .update({
            aggregated_stats: {
              total_matches: allDemos.length,
              wins,
              losses: allDemos.length - wins - draws,
              draws,
              win_rate: wins / allDemos.length,
              avg_rating: topPlayers.length > 0 ? topPlayers.reduce((s, p) => s + p.rating, 0) / topPlayers.length : 1.0,
              maps_played: mapsPlayed,
              top_players: topPlayers,
            },
          })
          .eq('user_team_id', demo.team_id)
          .eq('opponent_slug', demo.opponent_slug)
      }
    } catch (err) {
      console.error('[reparse] failed:', err)
      await admin
        .from('demos')
        .update({ status: 'failed', error_message: String(err) })
        .eq('id', demoId)
    }
  })()

  return NextResponse.json({ success: true, message: 'Re-parsing started' })
}
