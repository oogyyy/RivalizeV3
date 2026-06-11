import type { SupabaseClient } from '@supabase/supabase-js'
import { discoverMatchesForUser } from '../lib/cs2-sync'
import { isSteamBotConfigured } from '../lib/steam-bot'
import { isSteamApiConfigured } from '../lib/steam'

/**
 * Background CS2 match auto-sync.
 *
 * Periodically runs match discovery for users who opted in
 * (profiles.cs2_autosync_enabled) and have a linked Steam account, so their
 * recent matches appear without manually clicking Sync. Discovery only writes
 * to cs2_matches — turning a discovered match into a parsed demo is still
 * user-initiated.
 *
 * Conservative cadence: each user is re-synced at most once per
 * USER_RESYNC_INTERVAL_MS, and we process a small batch per pass to avoid
 * hammering Steam.
 */

const SWEEP_INTERVAL_MS      = 5 * 60_000        // check for due users every 5 min
const USER_RESYNC_INTERVAL_MS = 30 * 60_000      // re-sync each user at most every 30 min
const BATCH_PER_SWEEP        = 5                  // users processed per sweep

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sweep(supabase: SupabaseClient<any>): Promise<void> {
  const cutoff = new Date(Date.now() - USER_RESYNC_INTERVAL_MS).toISOString()

  // Opted-in users whose last auto-sync is null or older than the cutoff.
  const { data: due, error } = await supabase
    .from('profiles')
    .select('id, steam_id, steam_auth_token, cs2_last_sharecode, cs2_last_autosync_at')
    .eq('cs2_autosync_enabled', true)
    .not('steam_id', 'is', null)
    .or(`cs2_last_autosync_at.is.null,cs2_last_autosync_at.lt.${cutoff}`)
    .order('cs2_last_autosync_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_PER_SWEEP)

  if (error) {
    console.error('[auto-sync] failed to query due users:', error.message)
    return
  }
  if (!due || due.length === 0) return

  for (const profile of due) {
    try {
      const result = await discoverMatchesForUser(supabase, {
        userId:        profile.id,
        steamId:       profile.steam_id,
        authToken:     profile.steam_auth_token,
        lastSharecode: profile.cs2_last_sharecode,
      })
      if (result.newMatches > 0) {
        console.log(`[auto-sync] user=${profile.id} +${result.newMatches} matches (${result.source})`)
      }
    } catch (err) {
      console.error(`[auto-sync] user=${profile.id} failed:`, (err as Error).message)
    } finally {
      // Always stamp the attempt so one failing user can't monopolise the batch.
      await supabase
        .from('profiles')
        .update({ cs2_last_autosync_at: new Date().toISOString() })
        .eq('id', profile.id)
    }
  }
}

/**
 * Starts the background auto-sync loop. Returns a stop function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startAutoSync(supabase: SupabaseClient<any>): () => void {
  if (!isSteamBotConfigured() && !isSteamApiConfigured()) {
    console.warn('[auto-sync] no Steam credentials configured — auto-sync disabled')
    return () => {}
  }

  const timer = setInterval(() => {
    sweep(supabase).catch(err => console.error('[auto-sync] sweep error:', (err as Error).message))
  }, SWEEP_INTERVAL_MS)

  // First sweep shortly after boot.
  setTimeout(() => { sweep(supabase).catch(() => {}) }, 30_000)

  console.log(`[auto-sync] background match discovery active (every ${SWEEP_INTERVAL_MS / 60_000} min)`)
  return () => clearInterval(timer)
}
