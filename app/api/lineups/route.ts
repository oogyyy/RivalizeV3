import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const mapFilter  = searchParams.get('map') ?? ''
  const typeFilter = searchParams.get('type') ?? ''

  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('team_members')
    .select('team_id')
    .eq('user_id', user.id)

  const teamIds = (memberships ?? []).map((m: { team_id: string }) => m.team_id)
  if (teamIds.length === 0) return NextResponse.json([])

  let query = admin
    .from('lineups')
    .select('id, team_id, map, name, type, notes, canvas_data, is_public, created_by, created_at, updated_at, media_type, youtube_url, media_urls')
    .in('team_id', teamIds)
    .order('updated_at', { ascending: false })

  if (mapFilter)  query = query.eq('map', mapFilter)
  if (typeFilter) query = query.eq('type', typeFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Reverse links: which playbook strats reference each lineup
  const lineupRows = data ?? []
  if (lineupRows.length > 0) {
    const { data: playbooks } = await admin
      .from('playbooks')
      .select('id, name, strats')
      .in('team_id', teamIds)
    const usedIn: Record<string, Array<{ playbook_id: string; playbook_name: string; strat_name: string }>> = {}
    for (const pb of playbooks ?? []) {
      const strats = Array.isArray(pb.strats) ? pb.strats : []
      for (const st of strats as Array<{ name?: string; assignments?: Array<{ utility?: Array<{ id?: string }> }> }>) {
        const seen = new Set<string>()
        for (const a of st.assignments ?? []) {
          for (const u of a.utility ?? []) {
            if (!u.id || seen.has(u.id)) continue
            seen.add(u.id)
            ;(usedIn[u.id] ??= []).push({ playbook_id: pb.id, playbook_name: pb.name, strat_name: st.name ?? 'Strat' })
          }
        }
      }
    }
    for (const l of lineupRows as Array<{ id: string; used_in?: unknown }>) {
      l.used_in = usedIn[l.id] ?? []
    }
  }
  return NextResponse.json(lineupRows)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    teamId, map, name, type = 'smoke', notes = '', canvasData = [],
    mediaType, youtubeUrl, mediaUrls,
  } = body as {
    teamId: string; map: string; name: string
    type?: string; notes?: string; canvasData?: unknown[]
    mediaType?: string; youtubeUrl?: string; mediaUrls?: string[]
  }

  if (!teamId || !map || !name) {
    return NextResponse.json({ error: 'teamId, map, name required' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('lineups')
    .insert({
      team_id:     teamId,
      created_by:  user.id,
      map,
      name,
      type,
      notes,
      canvas_data: canvasData,
      media_type:  mediaType ?? 'draw',
      youtube_url: youtubeUrl ?? null,
      media_urls:  mediaUrls ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
