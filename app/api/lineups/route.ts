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
    .select('id, team_id, map, name, type, notes, created_by, created_at, updated_at')
    .in('team_id', teamIds)
    .order('updated_at', { ascending: false })

  if (mapFilter)  query = query.eq('map', mapFilter)
  if (typeFilter) query = query.eq('type', typeFilter)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { teamId, map, name, type = 'smoke', notes = '', canvasData = [] } = body as {
    teamId: string; map: string; name: string
    type?: string; notes?: string; canvasData?: unknown[]
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
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
