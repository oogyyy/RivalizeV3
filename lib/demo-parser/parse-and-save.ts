import { createAdminClient } from '@/lib/supabase/admin'
import { parseCS2Demo } from '@/lib/demo-parser/go-parser-client'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

/**
 * Downloads, parses, and saves a demo. Updates status to 'completed' or 'failed'.
 * Safe to call from both route handlers and after() callbacks.
 */
export async function parseAndSaveDemo(demoId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path, opponent_slug, demo_type, parsed_data')
    .eq('id', demoId)
    .single()

  if (!demo) throw new Error(`Demo ${demoId} not found`)

  const r2Key: string = demo.raw_file_path
  if (!r2Key) throw new Error(`Demo ${demoId} has no file path`)

  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  try {
    console.log(`[parse] Downloading ${demoId} from R2: ${r2Key}`)
    const rawBuf = await downloadObject(r2Key)
    const buf = maybeDecompress(rawBuf, r2Key)
    console.log(`[parse] ${rawBuf.length}B → ${buf.length}B, parsing…`)

    const { parsedData: realData, warnings } = await parseCS2Demo(buf)
    if (warnings.length) console.warn('[parse] warnings:', warnings)
    console.log(`[parse] ${realData.players.length} players, map=${realData.header.map}`)

    if (realData.players.length === 0) {
      await admin.from('demos').update({
        status: 'failed',
        error_message: 'Demo parsed but no player data could be extracted',
      }).eq('id', demoId)
      return
    }

    const parsedData = { ...realData, opponentSide: existingOpponentSide }
    const resolvedMap = realData.header.map !== 'unknown' ? realData.header.map : 'unknown'
    await admin.from('demos').update({
      parsed_data: parsedData,
      status: 'completed',
      map: resolvedMap,
    }).eq('id', demoId)

    // Recalculate folder aggregated stats for opponent demos only
    if (demo.demo_type === 'opponent') {
      const { data: allDemos } = await admin
        .from('demos')
        .select('parsed_data')
        .eq('team_id', demo.team_id)
        .eq('opponent_slug', demo.opponent_slug)
        .eq('status', 'completed')
        .eq('demo_type', 'opponent')

      if (allDemos && allDemos.length > 0) {
        type DemoRow = { header?: { score_team1?: number; score_team2?: number }; opponentSide?: string }
        const wins = allDemos.filter(d => {
          const pd = d.parsed_data as DemoRow | null
          const h = pd?.header
          if (!h) return false
          const s1 = h.score_team1 ?? 0, s2 = h.score_team2 ?? 0
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
        await admin.from('team_folders').update({
          aggregated_stats: {
            total_matches: allDemos.length,
            wins,
            losses: allDemos.length - wins - draws,
            draws,
            win_rate: wins / allDemos.length,
            avg_rating: topPlayers.length > 0
              ? topPlayers.reduce((s, p) => s + p.rating, 0) / topPlayers.length
              : 1.0,
            maps_played: mapsPlayed,
            top_players: topPlayers,
          },
        })
          .eq('user_team_id', demo.team_id)
          .eq('opponent_slug', demo.opponent_slug)
      }
    }
  } catch (err) {
    console.error(`[parse] Failed for ${demoId}:`, err)
    await admin.from('demos').update({
      status: 'failed',
      error_message: String(err),
    }).eq('id', demoId)
    throw err
  }
}
