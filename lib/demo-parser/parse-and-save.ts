import { createAdminClient } from '@/lib/supabase/admin'
import { parseCS2Demo } from '@/lib/demo-parser/go-parser-client'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

type ParsedDataRow = {
  header?: { map?: string; score_team1?: number; score_team2?: number }
  opponentSide?: string
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const delays = [2_000, 5_000, 10_000]
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[i] ?? 10_000))
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
    const buf = await withRetry(async () => {
      const rawBuf = await downloadObject(r2Key)
      return maybeDecompress(rawBuf, r2Key)
    })

    const { parsedData: realData, warnings } = await withRetry(() => parseCS2Demo(buf))
    if (warnings.length) console.warn(`[parse] warnings for ${demoId}:`, warnings)

    if (realData.players.length === 0) {
      await admin.from('demos').update({
        status: 'failed',
        error_message: 'Demo parsed successfully but contained no player data',
      }).eq('id', demoId)
      return
    }

    await admin.from('demos').update({
      parsed_data: { ...realData, opponentSide: existingOpponentSide },
      status: 'completed',
      map: realData.header?.map ?? 'unknown',
      error_message: null,
    }).eq('id', demoId)

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
        const wins = allDemos.filter(d => {
          const pd = d.parsed_data as ParsedDataRow | null
          const h = pd?.header
          if (!h) return false
          const s1 = h.score_team1 ?? 0
          const s2 = h.score_team2 ?? 0
          return pd?.opponentSide === 'team1' ? s2 > s1 : s1 > s2
        }).length

        const draws = allDemos.filter(d => {
          const h = (d.parsed_data as ParsedDataRow | null)?.header
          return h && (h.score_team1 ?? 0) === (h.score_team2 ?? 0)
        }).length

        const mapsPlayed: Record<string, number> = {}
        for (const d of allDemos) {
          const m = (d.parsed_data as ParsedDataRow | null)?.header?.map
          if (m) mapsPlayed[m] = (mapsPlayed[m] ?? 0) + 1
        }

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
    const raw = err instanceof Error ? err.message : String(err)
    console.error(`[parse] All attempts failed for ${demoId}:`, raw)

    // Surface a user-readable message; server-side transient errors should say
    // "try again" rather than blaming the uploaded file.
    const isTransient =
      raw.includes('truncated') ||
      raw.includes('R2 download') ||
      raw.includes('zstd decompression produced no output') ||
      raw.includes('Go parser') ||
      raw.includes('timed out') ||
      raw.includes('ECONNRESET') ||
      raw.includes('ETIMEDOUT')

    const userMsg = isTransient
      ? `Parsing failed due to a temporary server error — please use "Retry parsing". (${raw})`
      : raw

    await admin.from('demos').update({
      status: 'failed',
      error_message: userMsg,
    }).eq('id', demoId)
    throw err
  }
}
