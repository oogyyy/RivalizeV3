export const maxDuration = 300

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { parseCS2Demo } from '@/lib/demo-parser/go-parser-client'
import { maybeDecompress } from '@/lib/demo-parser/decompress'
import { computeTopPlayers } from '@/lib/demo-parser/aggregate-players'
import { downloadObject } from '@/lib/r2'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, label = 'op'): Promise<T> {
  const delays = [2_000, 5_000, 10_000]
  let last: unknown
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (err) {
      last = err
      if (i < attempts - 1) {
        console.warn(`[reparse] ${label} failed (attempt ${i + 1}/${attempts}), retrying:`, err)
        await sleep(delays[i] ?? 10_000)
      }
    }
  }
  throw last
}

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
    .select('id, team_id, raw_file_path, opponent_slug, status, demo_type, parsed_data')
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

  // Prevent duplicate concurrent reparsing
  if (demo.status === 'processing') {
    return NextResponse.json({ error: 'Demo is already being parsed' }, { status: 409 })
  }

  const existingOpponentSide =
    (demo.parsed_data as { opponentSide?: string } | null)?.opponentSide ?? 'team2'

  await admin.from('demos').update({ status: 'processing', error_message: null }).eq('id', demoId)

  try {
    console.log(`[reparse] Downloading ${demoId} from R2: ${r2Key}`)
    const rawBuf = await withRetry(() => downloadObject(r2Key), 3, 'R2 download')
    const buf = maybeDecompress(rawBuf, r2Key)
    console.log(`[reparse] ${rawBuf.length}B raw → ${buf.length}B decompressed`)

    console.log(`[reparse] Sending to Go parser…`)
    const { parsedData: realData, warnings } = await withRetry(
      () => parseCS2Demo(buf),
      3,
      'Go parser',
    )
    if (warnings.length) console.warn('[reparse] parser warnings:', warnings)
    console.log(
      `[reparse] OK — ${realData.players.length} players, map=${realData.header.map},` +
      ` score=${realData.header.score_team1}-${realData.header.score_team2}`,
    )

    if (realData.players.length === 0) {
      await admin.from('demos').update({
        status: 'failed',
        error_message: 'Demo parsed successfully but contained no player data',
      }).eq('id', demoId)
      return NextResponse.json({ error: 'No player data in demo' }, { status: 422 })
    }

    const parsedData = { ...realData, opponentSide: existingOpponentSide }
    const resolvedMap = realData.header.map !== 'unknown' ? realData.header.map : 'unknown'
    await admin.from('demos').update({
      parsed_data: parsedData,
      status: 'completed',
      map: resolvedMap,
      error_message: null,
    }).eq('id', demoId)
    console.log(`[reparse] Saved ${demoId} as completed (${resolvedMap})`)

    // Refresh folder aggregated stats — opponent demos only
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

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[reparse] All attempts failed for ${demoId}:`, msg)
    await admin.from('demos').update({
      status: 'failed',
      error_message: msg,
    }).eq('id', demoId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
