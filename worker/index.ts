import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo, applyParsedDemo, type ParseJobResult } from '../lib/demo-parser/parse-and-save'

/**
 * Rivalize Demo Processing Worker v2
 *
 * This is the main background worker for parsing CS2 demos.
 *
 * Primary flow:
 * - New demos are created with status='queued' by the API layer.
 * - This worker claims 'queued' jobs, parses them, and marks them completed/failed.
 *
 * Legacy support (temporary):
 * - During the transition period, this worker also supports older demos that were
 *   created directly in 'processing' state (the old synchronous model).
 * - This fallback will be removed once the transition is complete.
 */

const POLL_INTERVAL_MS = 2_000
const MAX_RETRIES = 3

// Base reclaim windows (used for stale job detection in legacy + queued paths)
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
}

/**
 * Reclaim jobs that have been claimed too long.
 * Handles both the new 'queued' path and legacy 'processing' rows (temporary).
 */
async function reclaimStale(): Promise<void> {
  const now = new Date()

  // Legacy 'processing' rows (from the old synchronous upload flow).
  // TODO: Remove this block once the transition to the 'queued' model is complete.
  const legacyCutoff = new Date(now.getTime() - BASE_RECLAIM_MINUTES * 60 * 1000).toISOString()

  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'processing')
    .not('processing_started_at', 'is', null)
    .lt('processing_started_at', legacyCutoff)

  // Defensive reclaim for any 'queued' rows that somehow got stuck with a claim.
  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'queued')
    .not('processing_started_at', 'is', null)
}

/**
 * Atomically claim the next available job.
 *
 * Priority:
 * 1. 'queued' jobs (the new, preferred path)
 * 2. Legacy 'processing' rows (temporary fallback during transition)
 */
async function claimNext(): Promise<DemoClaim | null> {
  // Prefer the new 'queued' path
  const { data: queued } = await supabase
    .from('demos')
    .select('id, file_size_bytes, status')
    .eq('status', 'queued')
    .is('processing_started_at', null)
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(1)

  if (queued && queued.length > 0) {
    const row = queued[0]
    const { data: claimed } = await supabase
      .from('demos')
      .update({ status: 'processing', processing_started_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'queued')
      .is('processing_started_at', null)
      .select('id, file_size_bytes, status')
      .single()

    if (claimed) return claimed as DemoClaim
  }

  // Temporary fallback for legacy demos still using the old 'processing' flow.
  // TODO: Remove this fallback once all clients use the 'queued' enqueue path.
  const { data: legacy } = await supabase
    .from('demos')
    .select('id, file_size_bytes, status')
    .eq('status', 'processing')
    .is('processing_started_at', null)
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(1)

  if (legacy && legacy.length > 0) {
    const row = legacy[0]
    const { data: claimed } = await supabase
      .from('demos')
      .update({ processing_started_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'processing')
      .is('processing_started_at', null)
      .select('id, file_size_bytes, status')
      .single()

    if (claimed) return claimed as DemoClaim
  }

  return null
}

async function tick(): Promise<void> {
  await reclaimStale()

  const claim = await claimNext()
  if (!claim) return

  const demoId = claim.id
  const sizeMb = claim.file_size_bytes ? Math.round(claim.file_size_bytes / 1024 / 1024) : 0

  const start = Date.now()
  console.log(`[worker][demoId=${demoId}][size=${sizeMb}MB] Claimed (status was ${claim.status})`)

  try {
    const result: ParseJobResult = await parseAndSaveDemo(demoId)

    if (result.success) {
      console.log(`[worker][demoId=${demoId}] Applying parsed data (will set status=completed)...`)
      await applyParsedDemo(demoId, result.parsedData, result.warnings)
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[worker][demoId=${demoId}] SUCCESS (DB status=completed) in ${duration}s`)
    } else {
      throw new Error(result.error)
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const duration = ((Date.now() - start) / 1000).toFixed(1)

    const { data: current } = await supabase
      .from('demos')
      .select('retry_count, file_size_bytes')
      .eq('id', demoId)
      .single()

    const retryCount = (current?.retry_count ?? 0) + 1
    const isPermanent = retryCount >= MAX_RETRIES

    console.error(`[worker][demoId=${demoId}] FAILED attempt ${retryCount}/${MAX_RETRIES} after ${duration}s: ${errMsg}`)

    await supabase
      .from('demos')
      .update({
        retry_count: retryCount,
        status: isPermanent ? 'failed' : 'processing',
        processing_started_at: null,
        error_message: isPermanent
          ? `Permanent failure after ${MAX_RETRIES} attempts: ${errMsg}`
          : `Attempt ${retryCount}/${MAX_RETRIES} failed: ${errMsg}`,
      })
      .eq('id', demoId)

    if (isPermanent) {
      console.error(`[worker][demoId=${demoId}] Marked as permanently failed`)
    }
  }
}

async function run(): Promise<void> {
  console.log('[worker] Demo processing worker v2 started')
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
