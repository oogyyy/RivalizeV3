import path from 'path'
import fs from 'fs'
import { createAdminClient } from '@/lib/supabase/admin'
import { embed } from './embed'
import type { RetrievalParams, RetrievalResult, KnowledgeChunk } from './types'

const KB_DIR = path.join(process.cwd(), 'knowledge_base/cs2')

// Files always included regardless of map (core principles + utility)
const GLOBAL_FILES = ['pro_default_principles', 'common_utility_lineups']

function mapShort(map: string): string {
  return map.replace(/^de_/, '')
}

function fileContentChunk(filePath: string, map: string): KnowledgeChunk | null {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf-8').slice(0, 3000)
  return {
    map,
    fileName: path.basename(filePath, '.md'),
    chunkIndex: 0,
    content,
  }
}

export async function retrieve(params: RetrievalParams): Promise<RetrievalResult> {
  const {
    query,
    map = 'global',
    teamId = null,
    topK = 8,
    similarityThreshold = 0.3,
  } = params

  const supabase = createAdminClient()

  // ── 1. Vector search ────────────────────────────────────────────────────────
  try {
    const queryVector = await embed(query)

    const { data, error } = await supabase.rpc('match_cs2_knowledge', {
      query_embedding: `[${queryVector.join(',')}]`,
      filter_map: map,
      team_filter: teamId ?? null,
      match_count: topK,
      similarity_threshold: similarityThreshold,
    })

    if (!error && Array.isArray(data) && data.length > 0) {
      const chunks: KnowledgeChunk[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        teamId: row.team_id as string | null,
        map: row.map as string,
        side: row.side as 't_side' | 'ct_side' | null,
        fileName: row.file_name as string,
        heading: row.heading as string | null,
        chunkIndex: row.chunk_index as number,
        content: row.content as string,
        similarity: row.similarity as number,
      }))
      return { chunks, source: 'vector' }
    }
  } catch (err) {
    // Vector search unavailable (model not loaded, DB not migrated, etc.)
    // Fall through to cheaper fallbacks
    console.warn('[knowledge/retrieval] vector search failed:', (err as Error).message)
  }

  // ── 2. Metadata-only DB fallback (no embedding comparison) ─────────────────
  try {
    const { data, error } = await supabase
      .from('cs2_knowledge')
      .select('id, team_id, map, side, file_name, heading, chunk_index, content')
      .or(`map.eq.${map},map.eq.global`)
      .is('team_id', null)
      .order('file_name')
      .order('chunk_index')
      .limit(topK * 2)

    if (!error && Array.isArray(data) && data.length > 0) {
      const chunks: KnowledgeChunk[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        teamId: row.team_id as string | null,
        map: row.map as string,
        side: row.side as 't_side' | 'ct_side' | null,
        fileName: row.file_name as string,
        heading: row.heading as string | null,
        chunkIndex: row.chunk_index as number,
        content: row.content as string,
      }))
      return { chunks, source: 'metadata' }
    }
  } catch (err) {
    console.warn('[knowledge/retrieval] metadata fallback failed:', (err as Error).message)
  }

  // ── 3. Direct file fallback (no DB required) ────────────────────────────────
  const short = mapShort(map)
  const filesToLoad = [
    ...GLOBAL_FILES.map(f => path.join(KB_DIR, `${f}.md`)),
    path.join(KB_DIR, `${short}_t_default.md`),
    path.join(KB_DIR, `${short}_ct_default.md`),
  ]

  const chunks: KnowledgeChunk[] = filesToLoad
    .map(fp => fileContentChunk(fp, map))
    .filter((c): c is KnowledgeChunk => c !== null)

  return { chunks, source: 'file' }
}

/**
 * Formats retrieved chunks into a plain-text context block for LLM injection.
 */
export function formatContext(result: RetrievalResult): string {
  if (result.chunks.length === 0) return ''

  const sections = result.chunks.map(c => {
    const header = c.heading ? `### ${c.heading}` : `### ${c.fileName}`
    return `${header}\n${c.content}`
  })

  return `--- KNOWLEDGE BASE (${result.source}) ---\n${sections.join('\n\n')}\n--- END KNOWLEDGE BASE ---`
}
