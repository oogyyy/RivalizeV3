export const maxDuration = 60

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { getPublicUrl } from '@/lib/r2'
import { slugify } from '@/lib/utils'
import { z } from 'zod'

const schema = z.object({
  teamId: z.string().uuid(),
  r2Key: z.string().min(1),
  opponentName: z.string().min(1).max(100),
  map: z.string().default('unknown'),
  fileSize: z.number().positive().optional(),
  matchDate: z.string().optional(),
  league: z.string().optional(),
  opponentSide: z.enum(['team1', 'team2']).default('team2'),
  demoType: z.enum(['opponent', 'self']).default('opponent'),
})

/**
 * Creates the demo DB record and returns immediately.
 * The client is responsible for calling POST /api/demos/[id]/parse next.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { teamId, r2Key, opponentName, map, fileSize, matchDate, league, opponentSide, demoType } = parsed.data

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
  }

  const opponentSlug = slugify(opponentName)
  const fileUrl = getPublicUrl(r2Key)

  const { data: demo, error: demoError } = await admin
    .from('demos')
    .insert({
      team_id: teamId,
      opponent_name: opponentName,
      opponent_slug: opponentSlug,
      map: map !== 'unknown' ? map : 'unknown',
      match_date: matchDate ?? null,
      league: league ?? null,
      raw_file_path: r2Key,
      file_url: fileUrl,
      status: 'processing',
      file_size_bytes: fileSize ?? null,
      created_by: user.id,
      demo_type: demoType,
      // Preserve the caller's opponentSide default; the client adjusts it via the card selector.
      parsed_data: { opponentSide },
    })
    .select()
    .single()

  if (demoError) {
    console.error('[register] Demo insert error:', demoError)
    return NextResponse.json({ error: demoError.message }, { status: 500 })
  }

  if (demoType === 'opponent') {
    await admin.from('team_folders').upsert(
      {
        user_team_id: teamId,
        opponent_slug: opponentSlug,
        opponent_display_name: opponentName,
      },
      { onConflict: 'user_team_id,opponent_slug' },
    )
  }

  return NextResponse.json(demo, { status: 201 })
}
