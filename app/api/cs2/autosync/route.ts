import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// GET /api/cs2/autosync — current auto-sync preference
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('cs2_autosync_enabled, cs2_autosync_team_id, cs2_last_autosync_at')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    enabled:      data?.cs2_autosync_enabled ?? false,
    teamId:       data?.cs2_autosync_team_id ?? null,
    lastSyncedAt: data?.cs2_last_autosync_at ?? null,
  })
}

const patchSchema = z.object({
  enabled: z.boolean(),
  teamId:  z.string().uuid().nullable().optional(),
})

// PATCH /api/cs2/autosync — enable/disable + choose the team to sync into
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let raw: unknown
  try { raw = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { enabled, teamId } = parsed.data
  const admin = createAdminClient()

  // If a team is specified, confirm the user belongs to it before storing.
  if (enabled && teamId) {
    const { data: membership } = await admin
      .from('team_members')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Not a member of that team' }, { status: 403 })
  }

  const update: Record<string, unknown> = { cs2_autosync_enabled: enabled }
  if (teamId !== undefined) update.cs2_autosync_team_id = teamId

  const { error } = await admin.from('profiles').update(update).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enabled, teamId: teamId ?? null })
}
