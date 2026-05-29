import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateNoteSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  pinned: z.boolean().optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; noteId: string }> }
) {
  const { teamId, noteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: note } = await admin
    .from('team_notes')
    .select('created_by, team_id')
    .eq('id', noteId)
    .eq('team_id', teamId)
    .single()
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = membership.role === 'owner' || membership.role === 'admin'
  if (note.created_by !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('team_notes')
    .update(parsed.data)
    .eq('id', noteId)
    .select('id, content, tags, pinned, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string; noteId: string }> }
) {
  const { teamId, noteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: note } = await admin
    .from('team_notes')
    .select('created_by')
    .eq('id', noteId)
    .eq('team_id', teamId)
    .single()
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isAdmin = membership.role === 'owner' || membership.role === 'admin'
  if (note.created_by !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await admin.from('team_notes').delete().eq('id', noteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
