import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo } from '../lib/demo-parser/parse-and-save'

const POLL_INTERVAL_MS  = 10_000
const STALE_AFTER_MS    = 15 * 60 * 1000  // reclaim jobs stuck > 15 min

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

async function reclaimStale(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString()
  const { count } = await supabase
    .from('demos')
    .update({ processing_started_at: null })
    .eq('status', 'processing')
    .not('processing_started_at', 'is', null)
    .lt('processing_started_at', cutoff)
    .select('id', { count: 'exact', head: true })
  if (count) console.log(`[worker] Reclaimed ${count} stale job(s)`)
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

  // Claim it — if another worker races us the IS NULL check prevents double-claiming
  const { data: claimed } = await supabase
    .from('demos')
    .update({ processing_started_at: new Date().toISOString() })
    .eq('id', id)
    .is('processing_started_at', null)
    .select('id')
    .single()

  return claimed?.id ?? null
}

async function tick(): Promise<void> {
  await reclaimStale()

  const demoId = await claimNext()
  if (!demoId) return

  console.log(`[worker] Processing ${demoId}`)
  try {
    await parseAndSaveDemo(demoId)
    console.log(`[worker] Done      ${demoId}`)
  } catch {
    // parseAndSaveDemo already wrote status='failed' + error_message to DB
    console.error(`[worker] Failed    ${demoId}`)
  }
}

async function run(): Promise<void> {
  console.log('[worker] Demo parsing worker started')
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
