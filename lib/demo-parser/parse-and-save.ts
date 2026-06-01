import { createAdminClient } from '@/lib/supabase/admin'
import { triggerParseJob } from '@/lib/demo-parser/go-parser-client'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import {
  downloadObject,
  createPresignedGetUrl,
  createPresignedPutUrl,
  getPublicUrl,
} from '@/lib/r2'

type ParsedDataRow = {
  header?: { map?: string; score_team1?: number; score_team2?: number }
  opponentSide?: string
}

export type ParseJobResult =
  | { success: true; parsedJsonUrl: string; warnings: string[] }
  | { success: false; error: string; isPermanent: boolean }

// Errors that warrant a retry (service hiccups, cold starts, network blips)
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('Go parser demo error')) return false
  return (
    msg.includes('Go parser unreachable')    ||
    msg.includes('Go parser timed out')      ||
    msg.includes('Go parser returned HTTP')  ||
    msg.includes('R2 download')              ||
    msg.includes('R2 upload')                ||
    msg.includes('truncated')                ||
    msg.includes('ECONNRESET')               ||
    msg.includes('ETIMEDOUT')                ||
    msg.includes('fetch failed')
  )
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const delays = [8_000, 20_000]
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1 && isRetryable(err)) {
        const wait = delays[i] ?? 20_000
        console.warn(`[parse] attempt ${i + 1} failed (retryable), waiting ${wait / 1000}s — ${(err as Error).message}`)
        await new Promise(resolve => setTimeout(resolve, wait))
      } else if (!isRetryable(err)) {
        throw err
      }
    }
  }
  throw lastErr
}

/**
 * Sends the parse job to the Go parser service.
 *
 * New flow (no large payload over HTTP):
 * 1. Generate presigned R2 URLs for the demo download and result upload.
 * 2. If the demo is .zst, decompress first and upload decompressed bytes to a
 *    temp key so the Go parser never needs a zstd library.
 * 3. Call Go parser with the presigned URLs.
 * 4. Go parser streams the demo, parses it, uploads result JSON to R2,
 *    and updates demos.status='parsed' in Supabase.
 * 5. Return the parsed_json_url — no parsed data crosses this boundary.
 */
export async function parseAndSaveDemo(demoId: string): Promise<ParseJobResult> {
  const admin = createAdminClient()

  const { data: demo, error: fetchErr } = await admin
    .from('demos')
    .select('id, raw_file_path, parsed_data')
    .eq('id', demoId)
    .single()

  if (fetchErr || !demo) {
    return { success: false, error: `Demo ${demoId} not found: ${fetchErr?.message}`, isPermanent: true }
  }

  const r2Key: string = demo.raw_file_path
  if (!r2Key) {
    return { success: false, error: `Demo ${demoId} has no file path`, isPermanent: true }
  }

  // Preserve opponentSide from any existing parsed_data
  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  try {
    // Generate presigned URLs (6-hour expiry — generous for large demos + retries)
    const EXPIRY = 6 * 3600
    const parsedJsonKey = `parsed-demos/${demoId}.json`

    const [demoDownloadUrl, parsedJsonUploadUrl] = await Promise.all([
      createPresignedGetUrl(r2Key, EXPIRY),
      createPresignedPutUrl(parsedJsonKey, EXPIRY),
    ])
    const parsedJsonPublicUrl = getPublicUrl(parsedJsonKey)

    // Trigger parse job — Go parser streams, decompresses (if .zst), and parses.
    const { parsedJsonUrl, warnings } = await withRetry(() =>
      triggerParseJob(demoId, r2Key, demoDownloadUrl, parsedJsonUploadUrl, parsedJsonPublicUrl)
    )

    // Tag opponentSide onto the result key so applyParsedDemo can find it.
    // We store it as a worker-side parameter, not in the JSON itself.
    return {
      success: true,
      parsedJsonUrl: `${parsedJsonUrl}?opponentSide=${encodeURIComponent(existingOpponentSide)}`,
      warnings,
    }
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    console.error(`[parse] All attempts failed for ${demoId}:`, raw)

    const isTransient =
      raw.includes('truncated')          ||
      raw.includes('R2 download')        ||
      raw.includes('R2 upload')          ||
      raw.includes('Go parser')          ||
      raw.includes('timed out')          ||
      raw.includes('ECONNRESET')         ||
      raw.includes('ETIMEDOUT')

    return { success: false, error: raw, isPermanent: !isTransient }
  }
}

/**
 * Detects which side (team1 / team2) is the user's own team by matching
 * team members' Steam IDs against the player list in the parsed demo JSON.
 * Returns the side that belongs to our team, or null if detection fails
 * (no Steam IDs linked, no matches, or missing data).
 */
async function detectOurTeamSide(
  parsedData: Record<string, unknown>,
  teamId: string,
  admin: ReturnType<typeof createAdminClient>,
): Promise<'team1' | 'team2' | null> {
  const header  = parsedData.header as { team1?: string; team2?: string } | undefined
  const players = parsedData.players as Array<{ steam_id?: string; team?: string }> | undefined

  if (!header || !players || players.length === 0) return null

  // Fetch Steam IDs for all team members who have Steam linked
  const { data: members } = await admin
    .from('team_members')
    .select('user_id')
    .eq('team_id', teamId)
  if (!members || members.length === 0) return null

  const { data: profiles } = await admin
    .from('profiles')
    .select('steam_id')
    .in('id', members.map(m => m.user_id))
    .not('steam_id', 'is', null)
  if (!profiles || profiles.length === 0) return null

  const memberSteamIds = new Set(profiles.map(p => p.steam_id).filter(Boolean))

  // Count how many team members appear on each side
  let team1Matches = 0
  let team2Matches = 0
  for (const p of players) {
    if (!p.steam_id || !memberSteamIds.has(p.steam_id)) continue
    if (p.team === header.team1)      team1Matches++
    else if (p.team === header.team2) team2Matches++
  }

  if (team1Matches === 0 && team2Matches === 0) return null

  return team1Matches >= team2Matches ? 'team1' : 'team2'
}

/**
 * Downloads the parsed JSON from R2 and writes it to the demos table.
 *
 * Supabase timeout fix:
 *   Position frames are stripped before writing parsed_data — they are the
 *   largest part of the JSON (~90%) but are only needed for the position replay
 *   feature, which can load them on demand via parsed_json_url.
 *   The remaining data (header, players, kills, grenades, heatmap) is typically
 *   <200 KB, well within Supabase's statement timeout.
 */
export async function applyParsedDemo(
  demoId: string,
  parsedJsonUrlWithParams: string,
  warnings: string[] = [],
): Promise<void> {
  const admin = createAdminClient()

  // Extract opponentSide param we embedded in the URL (avoids an extra DB fetch).
  let parsedJsonUrl = parsedJsonUrlWithParams
  let opponentSide = 'team2'
  try {
    const u = new URL(parsedJsonUrlWithParams)
    opponentSide = u.searchParams.get('opponentSide') ?? 'team2'
    u.searchParams.delete('opponentSide')
    parsedJsonUrl = u.toString()
  } catch {
    // URL parsing failed; keep defaults and proceed
  }

  const { data: demo } = await admin
    .from('demos')
    .select('team_id, opponent_slug, demo_type')
    .eq('id', demoId)
    .single()

  if (!demo) {
    throw new Error(`applyParsedDemo: demo ${demoId} not found`)
  }

  // Download parsed JSON from R2.
  const parsedJsonKey = `parsed-demos/${demoId}.json`
  const rawBuf = await downloadObject(parsedJsonKey)
  const parsedData = JSON.parse(rawBuf.toString('utf-8'))

  // For self demos, attempt to auto-detect which side is the user's team
  // using linked Steam IDs. opponentSide is stored as the OTHER team's side.
  if (demo.demo_type === 'self') {
    const ourSide = await detectOurTeamSide(parsedData, demo.team_id, admin)
    if (ourSide !== null) {
      opponentSide = ourSide === 'team1' ? 'team2' : 'team1'
      console.log(`[apply] [${demoId}] Auto-detected our side: ${ourSide} → opponentSide=${opponentSide}`)
    }
  }

  // Strip position frames before writing to Supabase.
  // Frames are ~90% of the JSON size. Keep kills, grenades, header, players.
  const parsedDataNoFrames = {
    ...parsedData,
    opponentSide,
    rounds: (parsedData.rounds ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      frames: [], // Stripped — load from parsed_json_url for position replay
    })),
  }

  console.log(`[apply] Updating demo ${demoId} status -> completed (map=${parsedData.header?.map ?? 'unknown'})`)

  const { data: updated, error: updateErr } = await admin
    .from('demos')
    .update({
      parsed_data:     parsedDataNoFrames,
      parsed_json_url: parsedJsonUrl,
      status:          'completed',
      map:             parsedData.header?.map ?? 'unknown',
      parsed_at:       new Date().toISOString(),
      error_message:   null,
    })
    .eq('id', demoId)
    .select('id')

  if (updateErr) {
    throw new Error(`Failed to mark demo ${demoId} completed: ${updateErr.message}`)
  }
  if (!updated || updated.length === 0) {
    throw new Error(`Failed to mark demo ${demoId} completed: 0 rows updated`)
  }

  console.log(`[apply] Demo ${demoId} successfully marked completed`)

  if (warnings.length) {
    console.warn(`[parse] warnings for ${demoId}:`, warnings)
  }

  // Recalculate folder aggregates for opponent demos only (non-fatal).
  if (demo.demo_type === 'opponent' && demo.opponent_slug) {
    try {
      const { data: allDemos } = await admin
        .from('demos')
        .select('parsed_data')
        .eq('team_id', demo.team_id)
        .eq('opponent_slug', demo.opponent_slug)
        .eq('status', 'completed')
        .eq('demo_type', 'opponent')

      if (allDemos && allDemos.length > 0) {
        const wins = allDemos.filter((d: { parsed_data: unknown }) => {
          const pd = d.parsed_data as ParsedDataRow | null
          const h  = pd?.header
          if (!h) return false
          const s1 = h.score_team1 ?? 0
          const s2 = h.score_team2 ?? 0
          return pd?.opponentSide === 'team1' ? s2 > s1 : s1 > s2
        }).length

        const draws = allDemos.filter((d: { parsed_data: unknown }) => {
          const h = (d.parsed_data as ParsedDataRow | null)?.header
          return h && (h.score_team1 ?? 0) === (h.score_team2 ?? 0)
        }).length

        const mapsPlayed: Record<string, number> = {}
        for (const d of allDemos) {
          const m = (d.parsed_data as ParsedDataRow | null)?.header?.map
          if (m) mapsPlayed[m] = (mapsPlayed[m] ?? 0) + 1
        }

        const topPlayers = computeTopPlayers(allDemos)
        const { error: folderErr } = await admin.from('team_folders').update({
          aggregated_stats: {
            total_matches: allDemos.length,
            wins,
            losses:    allDemos.length - wins - draws,
            draws,
            win_rate:  wins / allDemos.length,
            avg_rating: topPlayers.length > 0
              ? topPlayers.reduce((s, p) => s + p.rating, 0) / topPlayers.length
              : 1.0,
            maps_played: mapsPlayed,
            top_players: topPlayers,
          },
        })
          .eq('user_team_id', demo.team_id)
          .eq('opponent_slug', demo.opponent_slug)

        if (folderErr) {
          console.error(`[apply] Non-fatal: failed to update team_folders for ${demoId}: ${folderErr.message}`)
        }
      }
    } catch (aggErr) {
      console.error(`[apply] Non-fatal error updating team_folders for ${demoId}:`, aggErr)
    }
  }
}
