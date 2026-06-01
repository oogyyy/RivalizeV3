import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSharecode, decodeMatchShareCode } from '@/lib/cs2-sharecode'
import { isSteamBotConfigured } from '@/lib/steam-bot'

const chainSchema = z.object({
  mode:           z.literal('chain'),
  steamAuthToken: z.string().min(1).max(128),
  seedSharecode:  z.string().refine(validateSharecode, { message: 'Invalid CS2 sharecode format' }),
})

const botSchema = z.object({
  mode: z.literal('bot'),
  // Bot mode only requires a steam_id, which is already stored in profiles.
  // This endpoint is a no-op but we keep it for symmetry.
})

const schema = z.discriminatedUnion('mode', [chainSchema, botSchema])

/**
 * POST /api/cs2/setup
 * Chain mode: saves the user's Steam auth token + seed sharecode.
 * Bot mode:   no-op (steam_id is already in profiles from Steam link).
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

  // In bot mode, nothing to persist — steam_id is already stored.
  if (parsed.data.mode === 'bot') {
    return NextResponse.json({ ok: true })
  }

  const { steamAuthToken, seedSharecode } = parsed.data

  let decoded
  try {
    decoded = decodeMatchShareCode(seedSharecode)
  } catch {
    return NextResponse.json({ error: 'Could not decode sharecode' }, { status: 400 })
  }

  const admin = createAdminClient()

  await admin.from('profiles').update({
    steam_auth_token:   steamAuthToken,
    cs2_last_sharecode: seedSharecode,
  }).eq('id', user.id)

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
 * DELETE /api/cs2/setup — clear config (chain mode only; bot mode uses steam_id).
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (isSteamBotConfigured()) {
    // Bot mode — nothing to clear (we don't store per-user bot credentials)
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  await admin.from('profiles').update({
    steam_auth_token:   null,
    cs2_last_sharecode: null,
  }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
