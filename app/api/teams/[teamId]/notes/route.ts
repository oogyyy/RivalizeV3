import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  folder_id: z.string().uuid().optional(),
  demo_id: z.string().uuid().optional(),
  round_number: z.number().int().min(1).max(40).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  pinned: z.boolean().optional(),
})

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const folderId = searchParams.get('folder_id')
  const demoId = searchParams.get('demo_id')

  const admin = createAdminClient()

  // Verify membership
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let query = admin
    .from('team_notes')
    .select(`
      id, content, tags, pinned, round_number,
      folder_id, demo_id,
      created_at, updated_at,
      created_by,
      author:profiles!team_notes_created_by_fkey(username, display_name, avatar_url)
    `)
    .eq('team_id', teamId)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })

  if (folderId) query = query.eq('folder_id', folderId)
  if (demoId) query = query.eq('demo_id', demoId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notes: data })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify membership
  const { data: membership } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('team_notes')
    .insert({
      team_id: teamId,
      created_by: user.id,
      ...parsed.data,
    })
    .select('id, content, tags, pinned, round_number, folder_id, demo_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data }, { status: 201 })
}
