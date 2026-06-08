export const maxDuration = 60

import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getMatchDetail,
  getSignedDemoUrl,
  isFaceitConfigured,
  isDownloadsConfigured,
} from '@/lib/faceit'
import { uploadStream, getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'

// ── CORS helpers ─────────────────────────────────────────────────────────────

function cors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getUser(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  return error ? null : user
}

// ── GET /api/extension — return teams data for the panel UI ──────────────────

export async function GET(request: Request) {
  const user = await getUser(request)
  if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  const admin = createAdminClient()

  const { data: personalTeam } = await admin
    .from('teams')
    .select('id')
    .eq('created_by', user.id)
    .eq('is_personal', true)
    .single()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id, teams!inner(id, name, is_personal)')
    .eq('user_id', user.id)

  type TeamRow = { id: string; name: string; is_personal: boolean }
  const teams = (memberships ?? [])
    .map((m: { teams: TeamRow | TeamRow[] }) => Array.isArray(m.teams) ? m.teams[0] : m.teams)
    .filter((t): t is TeamRow => !!t && !t.is_personal)

  return cors(NextResponse.json({
    personal_team_id: personalTeam?.id ?? null,
    teams,
  }))
}

// ── POST /api/extension — import a FACEIT demo ───────────────────────────────

const importSchema = z.object({
  match_id: z.string().min(1),
  destination: z.enum(['personal', 'team', 'opponent']),
  player_faction: z.enum(['faction1', 'faction2']).default('faction1'),
  team_id: z.string().uuid().optional(),
  opponent_name: z.string().min(1).max(100).optional(),
})

export async function POST(request: Request) {
  const user = await getUser(request)
  if (!user) return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))

  if (!isFaceitConfigured()) {
    return cors(NextResponse.json({ error: 'FACEIT API not configured' }, { status: 503 }))
  }
  if (!isDownloadsConfigured()) {
    return cors(NextResponse.json({ error: 'FACEIT Downloads API not configured' }, { status: 503 }))
  }

  let body: unknown
  try { body = await request.json() } catch {
    return cors(NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }))
  }

  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    return cors(NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }))
  }

  const { match_id, destination, player_faction: _player_faction, team_id, opponent_name } = parsed.data
  const admin = createAdminClient()

  // Resolve the target team ID
  let targetTeamId: string
  if (destination === 'personal') {
    const { data: personalTeam } = await admin
      .from('teams')
      .select('id')
      .eq('created_by', user.id)
      .eq('is_personal', true)
      .single()
    if (!personalTeam) {
      return cors(NextResponse.json({ error: 'Personal team not found' }, { status: 404 }))
    }
    targetTeamId = personalTeam.id
  } else {
    if (!team_id) {
      return cors(NextResponse.json({ error: 'team_id required for this destination' }, { status: 400 }))
    }
    // Verify user is a member of that team
    const { data: member } = await admin
      .from('team_members')
      .select('role')
      .eq('team_id', team_id)
      .eq('user_id', user.id)
      .single()
    if (!member) {
      return cors(NextResponse.json({ error: 'Not a member of that team' }, { status: 403 }))
    }
    targetTeamId = team_id
  }

  const demoType = destination === 'opponent' ? 'opponent' : 'self'
  const oppName  = destination === 'opponent' ? (opponent_name ?? 'Unknown') : 'Self'

  // Fetch match details + download demo
  let match: Awaited<ReturnType<typeof getMatchDetail>>
  try {
    match = await getMatchDetail(match_id)
  } catch {
    return cors(NextResponse.json({ error: 'Failed to fetch match details from FACEIT' }, { status: 502 }))
  }

  if (!match.demo_url?.length) {
    return cors(NextResponse.json({ error: 'No demo URL available for this match yet' }, { status: 404 }))
  }

  let signedUrl: string
  try {
    signedUrl = await getSignedDemoUrl(match.demo_url[0])
  } catch (err) {
    return cors(NextResponse.json({
      error: `Could not get signed demo URL: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 502 }))
  }

  let demoRes: Response
  try {
    demoRes = await fetch(signedUrl, { redirect: 'follow', signal: AbortSignal.timeout(55000) })
  } catch (err) {
    return cors(NextResponse.json({
      error: `Demo download failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 502 }))
  }

  if (!demoRes.ok || !demoRes.body) {
    return cors(NextResponse.json({ error: `Demo download failed (HTTP ${demoRes.status})` }, { status: 502 }))
  }

  const map        = match.voting?.map?.pick?.[0] ?? 'unknown'
  const matchDate  = new Date(match.started_at * 1000).toISOString()
  const oppSlug    = slugify(oppName)
  const r2Key      = `${targetTeamId}/faceit-ext-${Date.now()}-${match_id}.dem.gz`

  await uploadStream(r2Key, demoRes.body)
  const fileUrl = getPublicUrl(r2Key)

  const { data: demo, error: demoErr } = await admin
    .from('demos')
    .insert({
      team_id:        targetTeamId,
      opponent_name:  oppName,
      opponent_slug:  oppSlug,
      map,
      match_date:     matchDate,
      league:         `FACEIT — ${match.competition_name}`,
      raw_file_path:  fileUrl,
      faceit_match_id: match_id,
      status:         'queued',
      queued_at:      new Date().toISOString(),
      demo_type:      demoType,
      created_by:     user.id,
    })
    .select('id')
    .single()

  if (demoErr || !demo) {
    return cors(NextResponse.json({ error: demoErr?.message ?? 'Failed to save demo' }, { status: 500 }))
  }

  if (destination === 'opponent') {
    await admin.from('team_folders').upsert(
      { user_team_id: targetTeamId, opponent_slug: oppSlug, opponent_display_name: oppName },
      { onConflict: 'user_team_id,opponent_slug' }
    )
  }

  return cors(NextResponse.json({ demoId: demo.id, map, matchDate }, { status: 201 }))
}
