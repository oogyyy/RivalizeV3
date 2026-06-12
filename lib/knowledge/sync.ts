// Boot-time knowledge base sync.
//
// Hashes every markdown file in knowledge_base/cs2 and compares against the
// hashes stored in cs2_knowledge_files. Files that changed (or were never
// ingested) are re-chunked, re-embedded, and re-written to cs2_knowledge —
// so deploying a knowledge base edit automatically refreshes the vector
// store without anyone running the ingest script by hand.
//
// Designed to be safe to fire-and-forget from instrumentation.ts:
// - no-ops in a few ms when nothing changed (hash comparison only)
// - the embedding model (~23 MB) is lazy-loaded only when a file changed
// - rows are built fully (embeddings included) BEFORE the old rows are
//   deleted, so a mid-sync crash never leaves a file with no chunks

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { chunkMarkdownFile } from './chunk'

const KB_DIR = path.join(process.cwd(), 'knowledge_base/cs2')

export async function syncKnowledgeBase(): Promise<void> {
  if (!fs.existsSync(KB_DIR)) {
    console.warn('[kb-sync] knowledge_base/cs2 not found — skipping sync')
    return
  }

  const supabase = createAdminClient()
  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.md'))

  const { data: existing, error: hashErr } = await supabase
    .from('cs2_knowledge_files')
    .select('file_name, content_hash')
  if (hashErr) {
    console.warn('[kb-sync] cannot read file hashes (migration missing?):', hashErr.message)
    return
  }
  const storedHash = new Map((existing ?? []).map(r => [r.file_name as string, r.content_hash as string]))

  const stale: Array<{ fileName: string; content: string; hash: string }> = []
  for (const f of files) {
    const fileName = f.replace(/\.md$/, '')
    const content = fs.readFileSync(path.join(KB_DIR, f), 'utf-8')
    const hash = crypto.createHash('sha256').update(content).digest('hex')
    if (storedHash.get(fileName) !== hash) stale.push({ fileName, content, hash })
  }

  if (stale.length === 0) {
    console.warn(`[kb-sync] knowledge base up to date (${files.length} files)`)
    return
  }

  console.warn(`[kb-sync] ${stale.length}/${files.length} knowledge file(s) changed — re-embedding`)
  const { embed } = await import('./embed')

  for (const { fileName, content, hash } of stale) {
    try {
      const chunks = chunkMarkdownFile(fileName, content)

      // Embed everything for this file before touching existing rows
      const rows = []
      for (const c of chunks) {
        const vector = await embed(c.content)
        rows.push({
          team_id:     null,
          map:         c.map,
          side:        c.side ?? null,
          file_name:   c.fileName,
          heading:     c.heading ?? null,
          chunk_index: c.chunkIndex,
          content:     c.content,
          embedding:   `[${vector.join(',')}]`,
        })
      }

      const { error: delErr } = await supabase
        .from('cs2_knowledge')
        .delete()
        .eq('file_name', fileName)
        .is('team_id', null)
      if (delErr) throw new Error(`delete: ${delErr.message}`)

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('cs2_knowledge').insert(rows)
        if (insErr) throw new Error(`insert: ${insErr.message}`)
      }

      const { error: upErr } = await supabase
        .from('cs2_knowledge_files')
        .upsert({ file_name: fileName, content_hash: hash, updated_at: new Date().toISOString() })
      if (upErr) throw new Error(`hash upsert: ${upErr.message}`)

      console.warn(`[kb-sync] ${fileName}: ${rows.length} chunks refreshed`)
    } catch (err) {
      console.warn(`[kb-sync] ${fileName} failed:`, (err as Error).message)
    }
  }

  console.warn('[kb-sync] done')
}
