import type { SupabaseClient } from '@supabase/supabase-js'
import { isSteamApiConfigured, getNextMatchSharingCode } from '@/lib/steam'
import { isSteamBotConfigured, fetchRecentCS2Matches, findDemoUrl } from '@/lib/steam-bot'
import { decodeMatchShareCode } from '@/lib/cs2-sharecode'

// Matches the admin client shape (see lib/supabase/admin.ts); avoids
// SupabaseClient<never> collapsing .from() result types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = SupabaseClient<any>

export interface DiscoverInput {
  userId: string
  steamId: string | null
  authToken: string | null
  lastSharecode: string | null
}

export interface DiscoverResult {
  newMatches: number
  configured: boolean
  linked: boolean
  source?: 'gc' | 'sharecode'
  error?: string
}

/**
 * Discovers new CS2 matches for a user and upserts them into cs2_matches.
 *
 * Shared by the manual /api/cs2/sync route and the worker's background
 * auto-sync loop so both behave identically. Tries the Steam bot Game
 * Coordinator first (full data), then falls back to sharecode-chain traversal.
 *
 * Only writes to cs2_matches (and advances profiles.cs2_last_sharecode); it
 * never touches the demos table.
 */
export async function discoverMatchesForUser(
  admin: AdminClient,
  input: DiscoverInput,
): Promise<DiscoverResult> {
  const { userId, steamId, authToken, lastSharecode } = input

  // ── Path 1: Steam bot (full GC access) ──────────────────────────────────────
  let botError: string | null = null
  if (isSteamBotConfigured() && steamId) {
    try {
      const gcMatches = await fetchRecentCS2Matches(steamId)
      let newMatches = 0

      for (const m of gcMatches) {
        if (!m.matchId) continue

        const { data: existing } = await admin
          .from('cs2_matches')
          .select('id, demo_url')
          .eq('user_id', userId)
          .eq('match_id', m.matchId)
          .maybeSingle()

        const matchDate = m.matchTime
          ? new Date(m.matchTime * 1000).toISOString()
          : new Date().toISOString()

        if (!existing) {
          await admin.from('cs2_matches').insert({
            user_id:        userId,
            sharecode:      `gc-${m.matchId}`,
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

          if (m.matchTime) {
            findDemoUrl(m.matchId, m.matchTime).then(async (url) => {
              if (url) {
                await admin.from('cs2_matches')
                  .update({ demo_url: url })
                  .eq('user_id', userId)
                  .eq('match_id', m.matchId)
              }
            }).catch(() => { /* silent */ })
          }
        } else if (!existing.demo_url && m.matchTime) {
          findDemoUrl(m.matchId, m.matchTime).then(async (url) => {
            if (url) {
              await admin.from('cs2_matches').update({ demo_url: url }).eq('id', existing.id)
            }
          }).catch(() => { /* silent */ })
        }
      }

      return { newMatches, configured: true, linked: true, source: 'gc' }
    } catch (err) {
      botError = err instanceof Error ? err.message : 'GC sync failed'
      console.error('[cs2-sync] Steam bot failed, trying sharecode fallback:', botError)
      // fall through
    }
  }

  // ── Path 2: Sharecode chain traversal ────────────────────────────────────────
  if (!isSteamApiConfigured()) {
    return { newMatches: 0, configured: false, linked: false, ...(botError ? { error: botError } : {}) }
  }

  if (!steamId || !authToken || !lastSharecode) {
    if (botError) {
      return {
        newMatches: 0, configured: true, linked: true, source: 'gc',
        error: `Steam GC unavailable (${botError}). Set up sharecode sync as an alternative.`,
      }
    }
    return { newMatches: 0, configured: true, linked: false }
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
        user_id:        userId,
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
      await admin.from('profiles').update({ cs2_last_sharecode: currentCode }).eq('id', userId)
    }

    return { newMatches, configured: true, linked: true, source: 'sharecode' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    return { newMatches, configured: true, linked: true, error: msg }
  }
}
