import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: lineup } = await admin
    .from('lineups')
    .select('*')
    .eq('id', id)
    .single()

  if (!lineup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', lineup.team_id)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(lineup)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = createAdminClient()

  const { data: lineup } = await admin
    .from('lineups')
    .select('team_id, created_by')
    .eq('id', id)
    .single()

  if (!lineup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', lineup.team_id)
    .eq('user_id', user.id)
    .single()

  const canEdit = lineup.created_by === user.id
    || member?.role === 'owner'
    || member?.role === 'admin'

  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const allowed: Record<string, unknown> = {}
  for (const k of ['name', 'type', 'notes', 'canvas_data', 'is_public'] as const) {
    if (body[k] !== undefined) allowed[k as string] = body[k]
  }
  if (body.is_public === true)  allowed['published_at'] = new Date().toISOString()
  if (body.is_public === false) allowed['published_at'] = null
  allowed['updated_at'] = new Date().toISOString()

  const { data, error } = await admin
    .from('lineups')
    .update(allowed)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: lineup } = await admin
    .from('lineups')
    .select('team_id, created_by')
    .eq('id', id)
    .single()

  if (!lineup) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', lineup.team_id)
    .eq('user_id', user.id)
    .single()

  const canDelete = lineup.created_by === user.id
    || member?.role === 'owner'
    || member?.role === 'admin'

  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await admin.from('lineups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
