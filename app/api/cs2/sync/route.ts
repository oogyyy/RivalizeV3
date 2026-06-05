export const maxDuration = 60
export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isSteamApiConfigured, getNextMatchSharingCode } from '@/lib/steam'
import { isSteamBotConfigured, fetchRecentCS2Matches, findDemoUrl } from '@/lib/steam-bot'
import { decodeMatchShareCode } from '@/lib/cs2-sharecode'

/**
 * POST /api/cs2/sync
 *
 * When STEAM_BOT_USERNAME/PASSWORD are set: connects to CS2 GC to fetch
 * the user's recent matches (up to 8) including map, scores, and timestamps.
 * Also probes Valve's CDN to find demo download URLs.
 *
 * Falls back to sharecode-chain traversal (requires STEAM_API_KEY +
 * user's steam_auth_token) when the bot is not configured.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('steam_id, steam_auth_token, cs2_last_sharecode')
    .eq('id', user.id)
    .single()

  const steamId       = profile?.steam_id as string | null
  const authToken     = profile?.steam_auth_token as string | null
  const lastSharecode = profile?.cs2_last_sharecode as string | null

  // ── Path 1: Steam bot (full GC access) ──────────────────────────────────────
  if (isSteamBotConfigured() && steamId) {
    try {
      const gcMatches = await fetchRecentCS2Matches(steamId)
      let newMatches = 0

      for (const m of gcMatches) {
        if (!m.matchId) continue

        // Synthesise a stable unique key: we don't always have a sharecode,
        // so use matchId as the canonical identifier.
        const { data: existing } = await admin
          .from('cs2_matches')
          .select('id, demo_url')
          .eq('user_id', user.id)
          .eq('match_id', m.matchId)
          .maybeSingle()

        const matchDate = m.matchTime
          ? new Date(m.matchTime * 1000).toISOString()
          : new Date().toISOString()

        if (!existing) {
          // New match — insert it
          await admin.from('cs2_matches').insert({
            user_id:        user.id,
            sharecode:      `gc-${m.matchId}`, // placeholder; real sharecode not from GC
            match_id:       m.matchId,
            reservation_id: m.reservationId,
            tv_port:        m.tvPort,
            map:            m.map,
            score_ct:       m.scoreTeam1,
            score_t:        m.scoreTeam2,
            match_result:   m.matchResult,
            match_time:     matchDate,
          })
          newMatches++

          // Async demo URL probe — fire and don't wait (best effort)
          if (m.matchTime) {
            findDemoUrl(m.matchId, m.matchTime).then(async (url) => {
              if (url) {
                await admin.from('cs2_matches')
                  .update({ demo_url: url })
                  .eq('user_id', user.id)
                  .eq('match_id', m.matchId)
              }
            }).catch(() => { /* silent */ })
          }
        } else if (!existing.demo_url && m.matchTime) {
          // Match exists but no demo URL yet — probe in background
          findDemoUrl(m.matchId, m.matchTime).then(async (url) => {
            if (url) {
              await admin.from('cs2_matches')
                .update({ demo_url: url })
                .eq('id', existing.id)
            }
          }).catch(() => { /* silent */ })
        }
      }

      return NextResponse.json({ newMatches, configured: true, linked: true, source: 'gc' })
    } catch (err) {
      botError = err instanceof Error ? err.message : 'GC sync failed'
      console.error('Steam bot sync failed:', botError)
      // Return the error directly — don't silently fall through
      return NextResponse.json({
        newMatches: 0, configured: true, linked: true, source: 'gc',
        error: botError,
      })
    }
  }

  // ── Path 2: Sharecode chain traversal (fallback) ─────────────────────────────
  if (!isSteamApiConfigured()) {
    return NextResponse.json({ newMatches: 0, configured: false })
  }

  if (!steamId || !authToken || !lastSharecode) {
    return NextResponse.json({ newMatches: 0, configured: true, linked: false })
  }

  let currentCode = lastSharecode
  let newMatches  = 0
  const MAX_CHAIN = 30

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

    if (currentCode !== lastSharecode) {
      await admin.from('profiles').update({
        cs2_last_sharecode: currentCode,
      }).eq('id', user.id)
    }

    return NextResponse.json({ newMatches, configured: true, linked: true, source: 'sharecode' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ newMatches, configured: true, linked: true, error: msg })
  }
}
