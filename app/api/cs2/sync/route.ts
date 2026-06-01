import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isSteamApiConfigured, getNextMatchSharingCode } from '@/lib/steam'
import { decodeMatchShareCode } from '@/lib/cs2-sharecode'

/**
 * POST /api/cs2/sync
 * Walks the sharecode chain from the user's last known code and stores
 * any newly discovered matches. Returns the count of new matches found.
 *
 * Requires STEAM_API_KEY env var + user to have set up steam_auth_token.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isSteamApiConfigured()) {
    return NextResponse.json({ newMatches: 0, configured: false })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('steam_id, steam_auth_token, cs2_last_sharecode')
    .eq('id', user.id)
    .single()

  const steamId       = profile?.steam_id as string | null
  const authToken     = profile?.steam_auth_token as string | null
  const lastSharecode = profile?.cs2_last_sharecode as string | null

  if (!steamId || !authToken || !lastSharecode) {
    return NextResponse.json({ newMatches: 0, configured: true, linked: false })
  }

  let currentCode = lastSharecode
  let newMatches  = 0
  const MAX_CHAIN = 30 // safety cap per sync

  try {
    for (let i = 0; i < MAX_CHAIN; i++) {
      const nextCode = await getNextMatchSharingCode(steamId, authToken, currentCode)
      if (!nextCode) break

      let decoded
      try { decoded = decodeMatchShareCode(nextCode) } catch { break }

      const { error } = await admin.from('cs2_matches').upsert({
        user_id:        user.id,
        sharecode:      nextCode,
        match_id:       decoded.matchId.toString(),
        reservation_id: decoded.reservationId.toString(),
        tv_port:        decoded.tvPort,
      }, { onConflict: 'user_id,sharecode' })

      if (!error) {
        newMatches++
        currentCode = nextCode
      } else {
        break
      }
    }

    // Update the last known sharecode
    if (currentCode !== lastSharecode) {
      await admin.from('profiles').update({
        cs2_last_sharecode: currentCode,
      }).eq('id', user.id)
    }

    return NextResponse.json({ newMatches, configured: true, linked: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ newMatches, configured: true, linked: true, error: msg })
  }
}
