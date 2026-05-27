import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo } from '../lib/demo-parser/parse-and-save'

// Tune via env vars — no code deploy needed to scale up
const CONCURRENCY    = parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10)
const POLL_IDLE_MS   = 2_000    // sleep between polls when queue is empty
// parseAndSaveDemo retries the Go parser up to 3× with an 8-min timeout each
// (~24 min worst case). Set stale threshold above that so reclaim doesn't fire
// mid-parse and kick off a second concurrent parse for the same demo.
const STALE_AFTER_MS = 30 * 60 * 1000  // reclaim jobs stuck > 30 min

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'processing')
    .not('processing_started_at', 'is', null)
    .lt('processing_started_at', cutoff)
}

async function claimNext(): Promise<string | null> {
  const { data } = await supabase
    .from('demos')
    .select('id')
    .eq('status', 'processing')
    .is('processing_started_at', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!data || data.length === 0) return null
  const id = data[0].id

  // Atomic claim — IS NULL guard prevents double-claiming across concurrent slots
  const { data: claimed } = await supabase
    .from('demos')
    .update({ processing_started_at: new Date().toISOString() })
    .eq('id', id)
    .is('processing_started_at', null)
    .select('id')
    .single()

  return claimed?.id ?? null
}

// Dedicated background loop so stale reclaim runs once a minute,
// not once per slot per tick.
async function reclaimLoop(): Promise<void> {
  while (true) {
    try {
      await reclaimStale()
    } catch (err) {
      console.error('[worker] Stale reclaim error:', err)
    }
    await new Promise(resolve => setTimeout(resolve, 60_000))
  }
}

// Each slot claims and processes demos back-to-back with no delay.
// Only sleeps when the queue is empty — immediately re-polls on success.
async function runSlot(slotId: number): Promise<void> {
  while (true) {
    try {
      const demoId = await claimNext()
      if (demoId) {
        console.log(`[worker:${slotId}] Processing ${demoId}`)
        try {
          await parseAndSaveDemo(demoId)
          console.log(`[worker:${slotId}] Done      ${demoId}`)
        } catch {
          // parseAndSaveDemo already wrote status='failed' + error_message to DB
          console.error(`[worker:${slotId}] Failed    ${demoId}`)
        }
        continue  // immediately grab the next queued demo
      }
    } catch (err) {
      console.error(`[worker:${slotId}] Poll error:`, err)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_IDLE_MS))
  }
}

async function run(): Promise<void> {
  console.log(`[worker] Demo parsing worker started (concurrency=${CONCURRENCY})`)
  await Promise.all([
    reclaimLoop(),
    ...Array.from({ length: CONCURRENCY }, (_, i) => runSlot(i + 1)),
  ])
}

run()
