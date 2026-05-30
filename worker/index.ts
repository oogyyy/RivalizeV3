import { createClient } from '@supabase/supabase-js'
import { parseAndSaveDemo } from '../lib/demo-parser/parse-and-save'

const POLL_INTERVAL_MS  = 2_000
const STALE_AFTER_MS    = 15 * 60 * 1000  // reclaim jobs stuck > 15 min
const MAX_RETRIES       = 3               // permanently fail after this many attempts

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
  // Find oldest unclaimed processing demo that hasn't exceeded retry limit
  const { data } = await supabase
    .from('demos')
    .select('id')
    .eq('status', 'processing')
    .is('processing_started_at', null)
    .lt('retry_count', MAX_RETRIES)
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
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    const { data: current } = await supabase
      .from('demos')
      .select('retry_count')
      .eq('id', demoId)
      .single()

    const retryCount = (current?.retry_count ?? 0) + 1
    if (retryCount >= MAX_RETRIES) {
      console.error(`[worker] Failed permanently (${retryCount}/${MAX_RETRIES}) ${demoId}:`, errMsg)
      await supabase
        .from('demos')
        .update({ retry_count: retryCount, status: 'failed', processing_started_at: null, error_message: errMsg })
        .eq('id', demoId)
    } else {
      console.error(`[worker] Failed attempt ${retryCount}/${MAX_RETRIES} ${demoId} — will retry:`, errMsg)
      await supabase
        .from('demos')
        .update({ retry_count: retryCount, status: 'processing', processing_started_at: null, error_message: `Attempt ${retryCount}/${MAX_RETRIES} failed: ${errMsg}` })
        .eq('id', demoId)
    }
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
