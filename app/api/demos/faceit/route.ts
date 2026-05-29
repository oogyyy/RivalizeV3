export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  isFaceitConfigured,
  getPlayerByNickname,
  getPlayerMatchHistory,
  getMatchDetail,
} from '@/lib/faceit'
import { uploadStream, getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'

const lookupSchema = z.object({
  action: z.literal('lookup'),
  nickname: z.string().min(1).max(64),
})

const importSchema = z.object({
  action: z.literal('import'),
  teamId: z.string().uuid(),
  matchId: z.string().min(1),
  opponentName: z.string().min(1).max(100),
  playerFaction: z.enum(['faction1', 'faction2']).default('faction2'),
})

const bodySchema = z.discriminatedUnion('action', [lookupSchema, importSchema])

/** GET — check if FaceIt is configured */
export async function GET() {
  return NextResponse.json({ configured: isFaceitConfigured() })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isFaceitConfigured()) {
    return NextResponse.json(
      { error: 'FaceIt API key not configured. Add FACEIT_API_KEY to your environment.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // ── Lookup: search player and return recent matches ──
  if (parsed.data.action === 'lookup') {
    try {
      const player = await getPlayerByNickname(parsed.data.nickname)
      if (!player.games?.cs2) {
        return NextResponse.json({ error: 'Player has no CS2 stats on FaceIt' }, { status: 404 })
      }
      const history = await getPlayerMatchHistory(player.player_id, 20)
      return NextResponse.json({
        player: {
          id: player.player_id,
          nickname: player.nickname,
          avatar: player.avatar,
          elo: player.games.cs2.faceit_elo,
          level: player.games.cs2.skill_level,
        },
        matches: history.items.map(m => ({
          match_id: m.match_id,
          competition_name: m.competition_name,
          started_at: m.started_at,
          teams: {
            faction1: {
              name: m.teams.faction1.name || '',
              roster: m.teams.faction1.roster?.map(p => p.nickname) ?? [],
            },
            faction2: {
              name: m.teams.faction2.name || '',
              roster: m.teams.faction2.roster?.map(p => p.nickname) ?? [],
            },
          },
          score: m.results?.score ?? null,
          winner: m.results?.winner ?? null,
          match_url: m.match_url,
        })),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FaceIt lookup failed'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  // ── Import: download demo and register it ──
  const { teamId, matchId, opponentName, playerFaction } = parsed.data

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const match = await getMatchDetail(matchId)
    const demoUrls = match.demo_url ?? []
    if (demoUrls.length === 0) {
      return NextResponse.json({ error: 'No demo URL available for this match yet' }, { status: 404 })
    }

    const demoUrl = demoUrls[0]
    const map = match.voting?.map?.pick?.[0] ?? 'unknown'

    // Stream demo from FaceIt → R2
    let demoRes: Response
    try {
      demoRes = await fetch(demoUrl)
    } catch {
      return NextResponse.json(
        { error: 'Demo not available yet — FACEIT may still be processing it. Try again in a few minutes.' },
        { status: 502 }
      )
    }
    if (!demoRes.ok || !demoRes.body) {
      const hint = demoRes.status === 403 || demoRes.status === 404
        ? 'Demo not available yet — try again in a few minutes.'
        : `Demo download failed (HTTP ${demoRes.status})`
      return NextResponse.json({ error: hint }, { status: 502 })
    }

    const filename = `faceit-${matchId}.dem.gz`
    const r2Key = `${teamId}/faceit-${Date.now()}-${filename}`

    // Determine opponent: the faction that is NOT the player's faction
    const opponentFaction = playerFaction === 'faction1' ? 'faction2' : 'faction1'
    const opponentSlug = slugify(opponentName)
    const matchDate = new Date(match.started_at * 1000).toISOString()

    await uploadStream(r2Key, demoRes.body)

    const fileUrl = getPublicUrl(r2Key)

    // Register demo in DB
    const { data: demo, error: demoError } = await admin
      .from('demos')
      .insert({
        team_id: teamId,
        opponent_name: opponentName,
        opponent_slug: opponentSlug,
        map,
        match_date: matchDate,
        league: `FaceIt — ${match.competition_name}`,
        raw_file_path: fileUrl,
        status: 'processing',
        demo_type: 'opponent',
        created_by: user.id,
      })
      .select('id')
      .single()

    if (demoError || !demo) {
      return NextResponse.json({ error: demoError?.message ?? 'Failed to register demo' }, { status: 500 })
    }

    // Upsert team folder
    await admin.from('team_folders').upsert(
      { user_team_id: teamId, opponent_slug: opponentSlug, opponent_display_name: opponentName },
      { onConflict: 'user_team_id,opponent_slug' }
    )

    return NextResponse.json({ demoId: demo.id, map, matchDate, opponentName }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Import failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
