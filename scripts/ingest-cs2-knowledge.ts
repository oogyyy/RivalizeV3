/**
 * One-time ingestion script: chunks, embeds, and upserts all CS2 knowledge base
 * markdown files into the cs2_knowledge table.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/ingest-cs2-knowledge.ts
 *
 * Safe to re-run — deletes and re-inserts rows for each file so embeddings stay fresh.
 */

import path from 'path'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { chunkMarkdownFile } from '../lib/knowledge/chunk'
import { embed } from '../lib/knowledge/embed'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Required env vars missing: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const KB_DIR = path.join(process.cwd(), 'knowledge_base/cs2')

async function ingestFile(fileName: string) {
  const filePath = path.join(KB_DIR, `${fileName}.md`)
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠  ${fileName}.md not found, skipping`)
    return { chunks: 0, upserted: 0 }
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const chunks = chunkMarkdownFile(fileName, content)

  if (chunks.length === 0) {
    console.log(`  ${fileName}: no chunks generated`)
    return { chunks: 0, upserted: 0 }
  }

  // Clear existing global rows for this file before re-inserting
  const { error: delError } = await supabase
    .from('cs2_knowledge')
    .delete()
    .eq('file_name', fileName)
    .is('team_id', null)

  if (delError) {
    console.error(`  ✗ delete failed for ${fileName}:`, delError.message)
    return { chunks: chunks.length, upserted: 0 }
  }

  // Embed and insert in batches of 8
  const BATCH = 8
  let upserted = 0

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)

    const rows = await Promise.all(
      batch.map(async (chunk) => {
        const vector = await embed(chunk.content)
        return {
          team_id: null,
          map: chunk.map,
          side: chunk.side ?? null,
          file_name: chunk.fileName,
          heading: chunk.heading ?? null,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          // pgvector expects a bracketed float list as a string or JSON array
          embedding: `[${vector.join(',')}]`,
        }
      }),
    )

    const { error: insError } = await supabase.from('cs2_knowledge').insert(rows)

    if (insError) {
      console.error(`  ✗ insert error (batch ${i}):`, insError.message)
    } else {
      upserted += rows.length
      process.stdout.write('.')
    }
  }

  return { chunks: chunks.length, upserted }
}

async function main() {
  const files = fs
    .readdirSync(KB_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''))

  console.log(`\nCS2 Knowledge Ingestion`)
  console.log(`Found ${files.length} files in ${KB_DIR}\n`)

  let totalChunks = 0
  let totalUpserted = 0

  for (const fileName of files) {
    process.stdout.write(`${fileName}: `)
    const { chunks, upserted } = await ingestFile(fileName)
    totalChunks += chunks
    totalUpserted += upserted
    console.log(` (${upserted}/${chunks} chunks)`)
  }

  console.log(`\n✓ Ingestion complete: ${totalUpserted}/${totalChunks} chunks stored`)
}

main().catch((err) => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
