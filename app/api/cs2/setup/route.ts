import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSharecode, decodeMatchShareCode } from '@/lib/cs2-sharecode'

const schema = z.object({
  steamAuthToken: z.string().min(1).max(128),
  seedSharecode:  z.string().refine(validateSharecode, { message: 'Invalid CS2 sharecode format' }),
})

/**
 * POST /api/cs2/setup
 * Saves the user's Steam auth token + seed sharecode, and inserts the seed
 * match as the first entry in cs2_matches.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { steamAuthToken, seedSharecode } = parsed.data

  let decoded
  try {
    decoded = decodeMatchShareCode(seedSharecode)
  } catch {
    return NextResponse.json({ error: 'Could not decode sharecode' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Save auth token + seed code to profile
  await admin.from('profiles').update({
    steam_auth_token:   steamAuthToken,
    cs2_last_sharecode: seedSharecode,
  }).eq('id', user.id)

  // Insert the seed match (ignore conflict — user may re-submit same seed)
  await admin.from('cs2_matches').upsert({
    user_id:        user.id,
    sharecode:      seedSharecode,
    match_id:       decoded.matchId.toString(),
    reservation_id: decoded.reservationId.toString(),
    tv_port:        decoded.tvPort,
  }, { onConflict: 'user_id,sharecode' })

  return NextResponse.json({ ok: true })
}

/**
 * DELETE /api/cs2/setup
 * Clears the user's Steam auth token and sharecode config.
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('profiles').update({
    steam_auth_token:   null,
    cs2_last_sharecode: null,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
