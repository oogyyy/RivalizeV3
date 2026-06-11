import type { SupabaseClient } from '@supabase/supabase-js'
import { embed } from '../lib/knowledge/embed'

/**
 * One-time embedding backfill for the CS2 knowledge base.
 *
 * The knowledge chunks were ingested without embeddings (the column is NULL),
 * so semantic vector search silently falls back to the metadata/file path.
 * This computes the missing embeddings on worker boot using the same model the
 * app uses for query embedding, so retrieval becomes truly semantic.
 *
 * Idempotent: only fills rows where embedding IS NULL, so once complete every
 * subsequent boot is a no-op. Fully non-fatal — never blocks demo processing.
 */

const BATCH = 16
const SAFETY_CAP = 5000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function backfillEmbeddings(supabase: SupabaseClient<any>): Promise<void> {
  try {
    const { count } = await supabase
      .from('cs2_knowledge')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null)

    if (!count || count === 0) return

    console.log(`[embed-backfill] ${count} knowledge rows missing embeddings — computing…`)
    let done = 0

    for (let processed = 0; processed < SAFETY_CAP; processed += BATCH) {
      const { data: rows, error } = await supabase
        .from('cs2_knowledge')
        .select('id, content')
        .is('embedding', null)
        .limit(BATCH)

      if (error) { console.error('[embed-backfill] query failed:', error.message); return }
      if (!rows || rows.length === 0) break

      for (const row of rows) {
        try {
          const vec = await embed(row.content as string)
          const { error: upErr } = await supabase
            .from('cs2_knowledge')
            .update({ embedding: `[${vec.join(',')}]` })
            .eq('id', row.id)
          if (upErr) {
            // Stop rather than risk an infinite re-select loop on a stuck row.
            console.error('[embed-backfill] update failed, aborting:', upErr.message)
            return
          }
          done++
        } catch (err) {
          console.error('[embed-backfill] embed failed, aborting:', (err as Error).message)
          return
        }
      }
      console.log(`[embed-backfill] ${done}/${count}…`)
    }

    console.log(`[embed-backfill] complete — ${done} embeddings written`)
  } catch (err) {
    console.warn('[embed-backfill] skipped:', (err as Error).message)
  }
}
