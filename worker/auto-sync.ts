import type { SupabaseClient } from '@supabase/supabase-js'
import { discoverMatchesForUser } from '../lib/cs2-sync'
import { isSteamBotConfigured } from '../lib/steam-bot'
import { isSteamApiConfigured } from '../lib/steam'
import { importValveDemo, type ValveMatch } from '../lib/demo-parser/import-valve-demo'

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
    .select('id, steam_id, steam_auth_token, cs2_last_sharecode, cs2_last_autosync_at, cs2_autosync_team_id')
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
      // Import any matches that now have a demo URL but no demo yet.
      if (profile.cs2_autosync_team_id) {
        await importReadyMatches(supabase, profile.id, profile.cs2_autosync_team_id)
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

const IMPORT_PER_USER = 3 // cap demo downloads per user per sweep

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function importReadyMatches(supabase: SupabaseClient<any>, userId: string, teamId: string): Promise<void> {
  const { data: matches } = await supabase
    .from('cs2_matches')
    .select('id, match_id, demo_url, map, match_time')
    .eq('user_id', userId)
    .is('demo_id', null)
    .not('demo_url', 'is', null)
    .order('match_time', { ascending: false })
    .limit(IMPORT_PER_USER)

  for (const match of (matches ?? []) as ValveMatch[]) {
    const res = await importValveDemo(supabase, match, teamId, userId)
    if (res.error) console.error(`[auto-sync] import match=${match.match_id} failed: ${res.error}`)
    else console.log(`[auto-sync] imported match=${match.match_id} -> demo=${res.demoId}`)
  }
}

/**
 * Processes explicit single-match import requests (the "Download & Parse Demo"
 * button), regardless of whether auto-sync is enabled. Resolves the target team
 * from the user's auto-sync team or their first team membership.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processImportRequests(supabase: SupabaseClient<any>): Promise<void> {
  const { data: requested } = await supabase
    .from('cs2_matches')
    .select('id, user_id, match_id, demo_url, map, match_time')
    .not('import_requested_at', 'is', null)
    .is('demo_id', null)
    .not('demo_url', 'is', null)
    .order('import_requested_at', { ascending: true })
    .limit(BATCH_PER_SWEEP)

  if (!requested || requested.length === 0) return

  for (const match of requested) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('cs2_autosync_team_id')
        .eq('id', match.user_id)
        .single()

      let teamId: string | null = profile?.cs2_autosync_team_id ?? null
      if (!teamId) {
        const { data: membership } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', match.user_id)
          .limit(1)
          .maybeSingle()
        teamId = membership?.team_id ?? null
      }

      if (!teamId) {
        console.error(`[auto-sync] import request match=${match.match_id}: no team for user`)
        // Clear the request so we don't retry forever.
        await supabase.from('cs2_matches').update({ import_requested_at: null }).eq('id', match.id)
        continue
      }

      const res = await importValveDemo(supabase, match as ValveMatch, teamId, match.user_id)
      // Clear the request flag whether it succeeded or hard-failed (user can retry).
      await supabase.from('cs2_matches').update({ import_requested_at: null }).eq('id', match.id)
      if (res.error) console.error(`[auto-sync] requested import match=${match.match_id} failed: ${res.error}`)
      else console.log(`[auto-sync] requested import match=${match.match_id} -> demo=${res.demoId}`)
    } catch (err) {
      console.error(`[auto-sync] import request match=${match.match_id} error:`, (err as Error).message)
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
    processImportRequests(supabase).catch(err => console.error('[auto-sync] import error:', (err as Error).message))
  }, SWEEP_INTERVAL_MS)

  // First pass shortly after boot.
  setTimeout(() => {
    sweep(supabase).catch(() => {})
    processImportRequests(supabase).catch(() => {})
  }, 30_000)

  console.log(`[auto-sync] background match discovery + import active (every ${SWEEP_INTERVAL_MS / 60_000} min)`)
  return () => clearInterval(timer)
}
