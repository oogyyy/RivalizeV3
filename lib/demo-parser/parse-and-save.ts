import { createAdminClient } from '@/lib/supabase/admin'
import { parseCS2Demo } from '@/lib/demo-parser/go-parser-client'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  label = 'operation',
): Promise<T> {
  const delays = [2_000, 5_000, 10_000]
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        const wait = delays[i] ?? 10_000
        console.warn(`[parse] ${label} failed (attempt ${i + 1}/${attempts}), retrying in ${wait / 1000}s:`, err)
        await sleep(wait)
      }
    }
  }
  throw lastErr
}

/**
 * Downloads, parses, and saves a demo. Updates status to 'completed' or 'failed'.
 * Retries the Go parser call up to 3 times with exponential backoff.
 */
export async function parseAndSaveDemo(demoId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: demo, error: fetchErr } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path, opponent_slug, demo_type, parsed_data')
    .eq('id', demoId)
    .single()

  if (fetchErr || !demo) {
    throw new Error(`Demo ${demoId} not found: ${fetchErr?.message}`)
  }

  const r2Key: string = demo.raw_file_path
  if (!r2Key) throw new Error(`Demo ${demoId} has no file path`)

  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  try {
    console.log(`[parse] Downloading ${demoId} from R2: ${r2Key}`)
    const rawBuf = await withRetry(() => downloadObject(r2Key), 3, 'R2 download')
    const buf = maybeDecompress(rawBuf, r2Key)
    console.log(`[parse] ${rawBuf.length}B raw → ${buf.length}B decompressed`)

    console.log(`[parse] Sending to Go parser…`)
    const { parsedData: realData, warnings } = await withRetry(
      () => parseCS2Demo(buf),
      3,
      'Go parser',
    )
    if (warnings.length) console.warn('[parse] parser warnings:', warnings)
    console.log(
      `[parse] OK — ${realData.players.length} players, map=${realData.header.map},` +
      ` score=${realData.header.score_team1}-${realData.header.score_team2}`,
    )

    if (realData.players.length === 0) {
      await admin.from('demos').update({
        status: 'failed',
        error_message: 'Demo parsed successfully but contained no player data',
      }).eq('id', demoId)
      return
    }

    const parsedData = { ...realData, opponentSide: existingOpponentSide }
    const resolvedMap = realData.header.map !== 'unknown' ? realData.header.map : 'unknown'
    await admin.from('demos').update({
      parsed_data: parsedData,
      status: 'completed',
      map: resolvedMap,
      error_message: null,
    }).eq('id', demoId)
    console.log(`[parse] Saved ${demoId} as completed (${resolvedMap})`)

    // Recalculate folder stats for opponent demos only
    if (demo.demo_type === 'opponent' && demo.opponent_slug) {
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
          return pd?.opponentSide === 'team1' ? s2 > s1 : s1 > s2
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
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[parse] All attempts failed for ${demoId}:`, msg)
    await admin.from('demos').update({
      status: 'failed',
      error_message: msg,
    }).eq('id', demoId)
    throw err
  }
}
