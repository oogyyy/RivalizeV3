import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Lists the user's recent coach sessions (RLS scopes rows to the user).
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('coach_sessions')
    .select('id, mode, focus_area, team_id, folder_id, title, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const createSchema = z.object({
  mode:      z.enum(['opponent', 'myteam']).default('opponent'),
  teamId:    z.string().uuid().optional(),
  folderId:  z.string().uuid().optional(),
  focusArea: z.string().max(32).optional(),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { mode, teamId, folderId, focusArea } = parsed.data
  const { data, error } = await supabase
    .from('coach_sessions')
    .insert({
      user_id:    user.id,
      mode,
      team_id:    teamId ?? null,
      folder_id:  folderId ?? null,
      focus_area: focusArea ?? null,
    })
    .select('id, mode, focus_area, team_id, folder_id, title, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
