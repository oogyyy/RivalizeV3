import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Parser health monitor.
 *
 * The demo queue silently stalls if the Go parser is unreachable — jobs stay
 * 'queued' with no visible error until reclaimStale eventually fails them 35
 * minutes later. This polls the parser's /health endpoint and raises an alert
 * the moment it is down *while demos are waiting*, then a recovery note when it
 * returns. Alerts go to OPS_DISCORD_WEBHOOK_URL when set; otherwise to stderr.
 *
 * De-duplication: one alert per down-transition, re-reminded at most once per
 * RE_ALERT_MS while it stays down — never a per-tick spam.
 */

const HEALTH_CHECK_INTERVAL_MS = 60_000
const HEALTH_TIMEOUT_MS        = 5_000
const RE_ALERT_MS              = 15 * 60_000 // remind every 15 min while still down
const FAILURES_BEFORE_ALERT    = 2           // require 2 consecutive misses to avoid blips

type HealthState = {
  down: boolean
  consecutiveFailures: number
  lastAlertAt: number
}

const state: HealthState = { down: false, consecutiveFailures: 0, lastAlertAt: 0 }

async function pingParser(baseUrl: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const tid  = setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS)
    const res  = await fetch(`${baseUrl}/health`, { signal: ctrl.signal })
    clearTimeout(tid)
    return res.ok
  } catch {
    return false
  }
}

async function countQueued(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .in('status', ['queued', 'processing'])
  return count ?? 0
}

async function sendAlert(text: string): Promise<void> {
  const webhook = process.env.OPS_DISCORD_WEBHOOK_URL
  console.error(`[parser-health] ${text}`)
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `🚨 **Rivalize parser** — ${text}` }),
    })
  } catch (err) {
    console.error('[parser-health] failed to post alert:', (err as Error).message)
  }
}

async function checkOnce(supabase: SupabaseClient, baseUrl: string): Promise<void> {
  const healthy = await pingParser(baseUrl)

  if (healthy) {
    if (state.down) {
      await sendAlert('parser is back online — queue processing has resumed.')
    }
    state.down = false
    state.consecutiveFailures = 0
    state.lastAlertAt = 0
    return
  }

  state.consecutiveFailures++
  if (state.consecutiveFailures < FAILURES_BEFORE_ALERT) return

  const queued = await countQueued(supabase)
  const now = Date.now()
  const newlyDown = !state.down
  const shouldReAlert = state.down && now - state.lastAlertAt >= RE_ALERT_MS

  if (newlyDown || shouldReAlert) {
    const stallNote = queued > 0
      ? `${queued} demo(s) are waiting and cannot be processed.`
      : 'No demos are queued right now, but uploads will stall until it recovers.'
    await sendAlert(`/health is failing at ${baseUrl}. ${stallNote}`)
    state.lastAlertAt = now
  }
  state.down = true
}

/**
 * Starts the background health loop. Returns a stop function (used in tests; the
 * worker process otherwise runs it for its lifetime).
 */
export function startParserHealthMonitor(supabase: SupabaseClient): () => void {
  const baseUrl = process.env.PARSER_URL?.replace(/\/$/, '')
  if (!baseUrl) {
    console.warn('[parser-health] PARSER_URL not set — health monitor disabled')
    return () => {}
  }

  // First check shortly after boot so a parser that is down at startup is caught.
  const timer = setInterval(() => {
    checkOnce(supabase, baseUrl).catch(err =>
      console.error('[parser-health] check error:', (err as Error).message),
    )
  }, HEALTH_CHECK_INTERVAL_MS)

  setTimeout(() => {
    checkOnce(supabase, baseUrl).catch(() => {})
  }, 10_000)

  console.log(`[parser-health] monitoring ${baseUrl}/health every ${HEALTH_CHECK_INTERVAL_MS / 1000}s`)
  return () => clearInterval(timer)
}
