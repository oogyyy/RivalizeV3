import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo } from '../lib/demo-parser/parse-and-save'

const POLL_INTERVAL_MS  = 2_000
// parseAndSaveDemo retries the Go parser up to 3× with an 8-min timeout each
// (~24 min worst case). Set stale threshold above that so reclaimStale doesn't
// fire mid-parse and kick off a second concurrent parse for the same demo.
const STALE_AFTER_MS    = 30 * 60 * 1000  // reclaim jobs stuck > 30 min
const CONCURRENCY       = 3               // parse up to 3 demos simultaneously

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
  // Find oldest unclaimed processing demo
  const { data } = await supabase
    .from('demos')
    .select('id')
    .eq('status', 'processing')
    .is('processing_started_at', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!data || data.length === 0) return null
  const id = data[0].id

  // Claim it — if another slot races us the IS NULL check prevents double-claiming
  const { data: claimed } = await supabase
    .from('demos')
    .update({ processing_started_at: new Date().toISOString() })
    .eq('id', id)
    .is('processing_started_at', null)
    .select('id')
    .single()

  return claimed?.id ?? null
}

// Each slot runs independently: poll → claim → parse → repeat.
// Running CONCURRENCY slots in parallel means multiple demos parse at once
// so a batch of uploads doesn't queue behind each other.
async function runSlot(slotId: number): Promise<void> {
  while (true) {
    try {
      await reclaimStale()

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
      }
    } catch (err) {
      console.error(`[worker:${slotId}] Unexpected poll error:`, err)
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}

async function run(): Promise<void> {
  console.log(`[worker] Demo parsing worker started (concurrency=${CONCURRENCY})`)
  await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, i) => runSlot(i + 1)),
  )
}

run()
