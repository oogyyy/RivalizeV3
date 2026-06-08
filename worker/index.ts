import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo, applyParsedDemo } from '../lib/demo-parser/parse-and-save'

/**
 * Rivalize Demo Processing Worker v3
 *
 * Two-phase processing pipeline:
 *
 * Phase A — Queued → Parsed (Go parser):
 *   Claims a 'queued' job, generates presigned R2 URLs, and calls the Go parser.
 *   The Go parser streams the demo, parses it, uploads the result JSON to R2,
 *   and atomically sets demos.status = 'parsed'.
 *   No large payloads cross the worker ↔ parser HTTP boundary.
 *
 * Phase B — Parsed → Completed (worker):
 *   Claims a 'parsed' job, downloads the compact parsed JSON from R2,
 *   writes it to demos.parsed_data (frames stripped to avoid Supabase timeout),
 *   and sets status = 'completed'.
 *
 * Crash recovery:
 *   If the worker dies after Go parser sets 'parsed' but before the apply step,
 *   the demo stays 'parsed'. On the next tick, Phase B picks it up automatically.
 *   If the worker dies mid-parse, reclaimStale() resets it to 'queued' after
 *   BASE_RECLAIM_MINUTES, triggering a retry via Phase A.
 */

const POLL_INTERVAL_MS    = 2_000
const MAX_RETRIES         = 3
const BASE_RECLAIM_MINUTES = 35

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

interface DemoClaim {
  id: string
  file_size_bytes: number | null
  status: string
  parsed_json_url?: string | null
}

/**
 * Reclaim stale in-progress jobs.
 *
 * Increments retry_count on every reclaim so demos that get stuck repeatedly
 * (e.g. worker OOM-crashing mid-parse before the catch block runs) eventually
 * reach MAX_RETRIES and are marked 'failed' rather than looping forever.
 */
async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - BASE_RECLAIM_MINUTES * 60 * 1000).toISOString()

  // Find stale processing demos so we can handle retry exhaustion per-row.
  // Use last_heartbeat_at when present (updated every 30s during active parsing);
  // fall back to processing_started_at for demos claimed before the heartbeat fix.
  const { data: stale } = await supabase
    .from('demos')
    .select('id, retry_count')
    .eq('status', 'processing')
    .not('processing_started_at', 'is', null)
    .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${cutoff}`)
    .lt('processing_started_at', cutoff)

  if (stale && stale.length > 0) {
    for (const demo of stale) {
      const newRetryCount = (demo.retry_count ?? 0) + 1
      const isPermanent   = newRetryCount >= MAX_RETRIES

      await supabase
        .from('demos')
        .update({
          status:                isPermanent ? 'failed' : 'queued',
          processing_started_at: null,
          queued_at:             new Date().toISOString(),
          retry_count:           newRetryCount,
          error_message: isPermanent
            ? `Timed out ${MAX_RETRIES} times — check the Go parser logs or delete and re-upload.`
            : `Timed out in processing (attempt ${newRetryCount}/${MAX_RETRIES}) — re-queued automatically.`,
        })
        .eq('id', demo.id)
        .eq('status', 'processing') // guard against concurrent reclaim

      if (isPermanent) {
        console.error(`[worker][demoId=${demo.id}] Permanently failed after ${MAX_RETRIES} stale reclaims`)
      } else {
        console.warn(`[worker][demoId=${demo.id}] Stale reclaim — re-queued (attempt ${newRetryCount}/${MAX_RETRIES})`)
      }
    }
  }

  // Defensive reset for 'queued' rows that somehow have a stale claim marker.
  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'queued')
    .not('processing_started_at', 'is', null)
}

/**
 * Priority 1: Claim a 'parsed' demo to apply to the database.
 * The Go parser already processed these — we just need to write to Supabase.
 */
async function claimParsed(): Promise<DemoClaim | null> {
  const { data: rows } = await supabase
    .from('demos')
    .select('id, file_size_bytes, status, parsed_json_url')
    .eq('status', 'parsed')
    .order('parsed_at', { ascending: true })
    .limit(1)

  if (!rows || rows.length === 0) return null

  const row = rows[0]

  // Mark as 'processing' so a concurrent worker won't double-apply.
  const { data: claimed } = await supabase
    .from('demos')
    .update({ status: 'processing', processing_started_at: new Date().toISOString() })
    .eq('id', row.id)
    .eq('status', 'parsed') // guard against race
    .select('id, file_size_bytes, status, parsed_json_url')
    .single()

  return claimed as DemoClaim | null
}

/**
 * Priority 2: Claim the next 'queued' demo for Phase A (Go parser).
 */
async function claimQueued(): Promise<DemoClaim | null> {
  const { data: rows } = await supabase
    .from('demos')
    .select('id, file_size_bytes, status')
    .eq('status', 'queued')
    .is('processing_started_at', null)
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!rows || rows.length === 0) return null

  const row = rows[0]
  const { data: claimed } = await supabase
    .from('demos')
    .update({
      status:                'processing',
      processing_started_at: new Date().toISOString(),
      last_heartbeat_at:     new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('status', 'queued')
    .is('processing_started_at', null)
    .select('id, file_size_bytes, status')
    .single()

  return claimed as DemoClaim | null
}

/**
 * Phase B: Apply a 'parsed' demo to the database.
 * Downloads the compact JSON from R2 and writes it to Supabase.
 */
async function applyParsedJob(claim: DemoClaim): Promise<void> {
  const demoId = claim.id
  const parsedJsonUrl = claim.parsed_json_url

  if (!parsedJsonUrl) {
    console.error(`[worker][demoId=${demoId}] 'parsed' demo has no parsed_json_url — resetting to queued`)
    await supabase
      .from('demos')
      .update({ status: 'queued', processing_started_at: null, retry_count: 0 })
      .eq('id', demoId)
    return
  }

  const start = Date.now()
  console.log(`[worker][demoId=${demoId}] Applying parsed data from R2...`)

  try {
    await applyParsedDemo(demoId, parsedJsonUrl, [])
    await supabase
      .from('demos')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', demoId)

    const duration = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[worker][demoId=${demoId}] APPLIED (status=completed) in ${duration}s`)
  } catch (err) {
    const errMsg  = err instanceof Error ? err.message : String(err)
    const duration = ((Date.now() - start) / 1000).toFixed(1)

    const { data: current } = await supabase
      .from('demos').select('retry_count').eq('id', demoId).single()
    const retryCount  = (current?.retry_count ?? 0) + 1
    const isPermanent = retryCount >= MAX_RETRIES

    console.error(`[worker][demoId=${demoId}] Apply FAILED attempt ${retryCount}/${MAX_RETRIES} after ${duration}s: ${errMsg}`)

    await supabase.from('demos').update({
      retry_count:           retryCount,
      status:                isPermanent ? 'failed' : 'queued',
      queued_at:             new Date().toISOString(),
      processing_started_at: null,
      error_message: isPermanent
        ? `Permanent apply failure after ${MAX_RETRIES} attempts: ${errMsg}`
        : `Apply attempt ${retryCount}/${MAX_RETRIES} failed: ${errMsg}`,
    }).eq('id', demoId)
  }
}

/**
 * Phase A: Send a 'queued' demo to the Go parser.
 * parseAndSaveDemo handles decompression, presigned URLs, and Go parser call.
 */
async function processQueuedJob(claim: DemoClaim): Promise<void> {
  const demoId = claim.id
  const sizeMb = claim.file_size_bytes
    ? Math.round(claim.file_size_bytes / 1024 / 1024)
    : 0

  const start = Date.now()
  console.log(`[worker][demoId=${demoId}][size=${sizeMb}MB] Claimed for parsing`)

  // Heartbeat: update last_heartbeat_at every 30s so reclaimStale() won't
  // reclaim a demo that's actively being parsed by the Go service.
  const heartbeatInterval = setInterval(async () => {
    await supabase
      .from('demos')
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq('id', demoId)
      .eq('status', 'processing')
  }, 30_000)

  try {
    const result = await parseAndSaveDemo(demoId)

    if (result.success) {
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[worker][demoId=${demoId}] Go parser completed in ${duration}s — applying to DB...`)

      // Apply immediately in the same tick (optimistic path).
      // If this fails, the 'parsed' status in Supabase ensures the next
      // tick will pick it up via claimParsed() without re-parsing.
      await applyParsedDemo(demoId, result.parsedJsonUrl, result.warnings)

      await supabase
        .from('demos')
        .update({ last_heartbeat_at: new Date().toISOString() })
        .eq('id', demoId)

      console.log(`[worker][demoId=${demoId}] SUCCESS (status=completed) in ${((Date.now() - start) / 1000).toFixed(1)}s`)
    } else {
      throw new Error(result.error)
    }
  } catch (err) {
    const errMsg  = err instanceof Error ? err.message : String(err)
    const duration = ((Date.now() - start) / 1000).toFixed(1)

    const { data: current } = await supabase
      .from('demos').select('retry_count, status').eq('id', demoId).single()

    const retryCount  = (current?.retry_count ?? 0) + 1
    const isPermanent = retryCount >= MAX_RETRIES

    console.error(`[worker][demoId=${demoId}] FAILED attempt ${retryCount}/${MAX_RETRIES} after ${duration}s: ${errMsg}`)

    // If Go parser already set status='parsed', don't overwrite it — let
    // claimParsed() handle the apply step on the next tick.
    if (current?.status === 'parsed') {
      console.log(`[worker][demoId=${demoId}] Apply failed but Go parser had set status=parsed — will retry apply on next tick`)
      return
    }

    await supabase.from('demos').update({
      retry_count:           retryCount,
      status:                isPermanent ? 'failed' : 'queued',
      queued_at:             new Date().toISOString(),
      processing_started_at: null,
      error_message: isPermanent
        ? `Permanent failure after ${MAX_RETRIES} attempts: ${errMsg}`
        : `Attempt ${retryCount}/${MAX_RETRIES} failed: ${errMsg}`,
    }).eq('id', demoId)

    if (isPermanent) {
      console.error(`[worker][demoId=${demoId}] Permanently failed`)
    }
  } finally {
    clearInterval(heartbeatInterval)
  }
}

async function tick(): Promise<void> {
  await reclaimStale()

  // Phase B first: apply already-parsed demos (cheaper, no Go parser needed).
  const parsedClaim = await claimParsed()
  if (parsedClaim) {
    await applyParsedJob(parsedClaim)
    return
  }

  // Phase A: send queued demos to Go parser.
  const queuedClaim = await claimQueued()
  if (queuedClaim) {
    await processQueuedJob(queuedClaim)
  }
}

async function run(): Promise<void> {
  console.log('[worker] Demo processing worker v3 started')
  while (true) {
    try {
      await tick()
    } catch (err) {
      console.error('[worker] Unexpected poll error:', err)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

run()
