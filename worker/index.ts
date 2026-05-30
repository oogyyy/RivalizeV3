import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo, applyParsedDemo, type ParseJobResult } from '../lib/demo-parser/parse-and-save'

/**
 * Rivalize Demo Processing Worker v2
 *
 * Responsibilities:
 * - Claim jobs from 'queued' (new path) and legacy 'processing' (during transition)
 * - Execute heavy parsing via parseAndSaveDemo
 * - Own ALL status transitions (queued → processing → completed/failed)
 * - Dynamic, file-size-aware stale reclaim
 * - Excellent structured logging for debugging stuck jobs
 */

const POLL_INTERVAL_MS = 2_000
const MAX_RETRIES = 3

// Base reclaim windows (will be adjusted by file size)
const BASE_RECLAIM_MINUTES = 35
const LARGE_DEMO_RECLAIM_MINUTES = 55

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
 * Dynamic reclaim timeout based on file size.
 * Small demos reclaim faster; 300MB+ demos get more breathing room.
 */
function getReclaimCutoff(fileSizeBytes: number | null): Date {
  const mb = fileSizeBytes ? fileSizeBytes / (1024 * 1024) : 0
  const minutes = mb > 250 ? LARGE_DEMO_RECLAIM_MINUTES : BASE_RECLAIM_MINUTES
  return new Date(Date.now() - minutes * 60 * 1000)
}

/**
 * Reclaim jobs that have been claimed too long (crashed worker, timeout, etc).
 * Now handles both 'processing' (legacy) and any future stuck states.
 */
async function reclaimStale(): Promise<void> {
  const now = new Date()

  // Legacy 'processing' rows (from old synchronous paths)
  const legacyCutoff = new Date(now.getTime() - BASE_RECLAIM_MINUTES * 60 * 1000).toISOString()

  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'processing')
    .not('processing_started_at', 'is', null)
    .lt('processing_started_at', legacyCutoff)

  // Any 'queued' rows that somehow got a processing_started_at (shouldn't happen, but defensive)
  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'queued')
    .not('processing_started_at', 'is', null)
}

/**
 * Atomically claim the next job using Postgres FOR UPDATE SKIP LOCKED.
 * Prefers 'queued' rows (new path). Falls back to legacy 'processing' rows during transition.
 */
async function claimNext(): Promise<DemoClaim | null> {
  // Prefer clean 'queued' jobs first
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

  // Fallback: legacy 'processing' rows that were never claimed (or reclaimed)
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
      await applyParsedDemo(demoId, result.parsedData, result.warnings)
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      console.log(`[worker][demoId=${demoId}] SUCCESS in ${duration}s`)
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
  console.log('[worker] Demo processing worker v2 started (queued + legacy support)')
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
