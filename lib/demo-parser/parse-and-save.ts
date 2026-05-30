import { createAdminClient } from '@/lib/supabase/admin'
import { parseCS2Demo } from '@/lib/demo-parser/go-parser-client'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

type ParsedDataRow = {
  header?: { map?: string; score_team1?: number; score_team2?: number }
  opponentSide?: string
}

/**
 * Result type returned by the parser.
 * The worker is responsible for all status / retry_count / error_message writes.
 */
export type ParseJobResult =
  | { success: true; parsedData: any; warnings: string[] }
  | { success: false; error: string; isPermanent: boolean }

// Errors that are worth retrying (service hiccups, cold starts, network blips)
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  // Non-retryable: bad demo file (422), no player data, explicit demo errors
  if (msg.includes('Go parser demo error')) return false
  // Retryable: network issues, timeouts, service restarts
  return (
    msg.includes('Go parser unreachable') ||
    msg.includes('Go parser timed out')   ||
    msg.includes('Go parser returned HTTP') ||
    msg.includes('truncated')             ||
    msg.includes('R2 download')           ||
    msg.includes('ECONNRESET')            ||
    msg.includes('ETIMEDOUT')             ||
    msg.includes('fetch failed')
  )
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  // Longer delays: the parser may need 20–60 s to cold-start on Railway
  const delays = [8_000, 20_000, 40_000]
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1 && isRetryable(err)) {
        const wait = delays[i] ?? 40_000
        console.warn(`[parse] attempt ${i + 1} failed (retryable), waiting ${wait / 1000}s — ${(err as Error).message}`)
        await new Promise(resolve => setTimeout(resolve, wait))
      } else if (!isRetryable(err)) {
        // Non-retryable — fail fast
        throw err
      }
    }
  }
  throw lastErr
}

/**
 * Downloads, parses, and prepares the data.
 *
 * IMPORTANT: This function NO LONGER mutates the demos table status.
 * It only performs the heavy work and returns a result.
 * The worker (or legacy transition code) is responsible for all status transitions.
 */
export async function parseAndSaveDemo(demoId: string): Promise<ParseJobResult> {
  const admin = createAdminClient()

  const { data: demo, error: fetchErr } = await admin
    .from('demos')
    .select('id, team_id, raw_file_path, opponent_slug, demo_type, parsed_data')
    .eq('id', demoId)
    .single()

  if (fetchErr || !demo) {
    return { success: false, error: `Demo ${demoId} not found: ${fetchErr?.message}`, isPermanent: true }
  }

  const r2Key: string = demo.raw_file_path
  if (!r2Key) {
    return { success: false, error: `Demo ${demoId} has no file path`, isPermanent: true }
  }

  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  try {
    const buf = await withRetry(async () => {
      const rawBuf = await downloadObject(r2Key)
      return maybeDecompress(rawBuf, r2Key)
    })

    const { parsedData: realData, warnings } = await withRetry(() => parseCS2Demo(buf))

    if (realData.players.length === 0) {
      return {
        success: false,
        error: 'Demo parsed successfully but contained no player data',
        isPermanent: true,
      }
    }

    // Success — return the data. The caller (worker) will write status + aggregates.
    return {
      success: true,
      parsedData: { ...realData, opponentSide: existingOpponentSide },
      warnings,
    }

  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error(`[parse] All attempts failed for ${demoId}:`, raw)

    const isTransient =
      raw.includes('truncated') ||
      raw.includes('R2 download') ||
      raw.includes('zstd decompression produced no output') ||
      raw.includes('Go parser') ||
      raw.includes('timed out') ||
      raw.includes('ECONNRESET') ||
      raw.includes('ETIMEDOUT')

    return {
      success: false,
      error: raw,
      isPermanent: !isTransient,
    }
  }
}

/**
 * Applies the parsed data to the database and updates team folder aggregates.
 * This is now called by the worker after a successful parse.
 */
export async function applyParsedDemo(
  demoId: string,
  parsedData: any,
  warnings: string[] = []
): Promise<void> {
  const admin = createAdminClient()

  const { data: demo } = await admin
    .from('demos')
    .select('team_id, opponent_slug, demo_type')
    .eq('id', demoId)
    .single()

  if (!demo) return

  await admin.from('demos').update({
    parsed_data: parsedData,
    status: 'completed',
    map: parsedData.header?.map ?? 'unknown',
    error_message: null,
  }).eq('id', demoId)

  if (warnings.length) {
    console.warn(`[parse] warnings for ${demoId}:`, warnings)
  }

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
}
