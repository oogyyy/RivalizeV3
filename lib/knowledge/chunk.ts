import { KnowledgeChunk } from './types'

const MAX_CHUNK_CHARS = 800

const MAP_PREFIXES = ['mirage', 'dust2', 'inferno', 'nuke', 'ancient', 'anubis', 'overpass']

function inferMap(fileName: string): string {
  const lower = fileName.toLowerCase()
  for (const m of MAP_PREFIXES) {
    if (lower.includes(m)) return `de_${m}`
  }
  return 'global'
}

function inferSide(fileName: string, heading: string | null): 't_side' | 'ct_side' | null {
  const combined = `${fileName} ${heading ?? ''}`.toLowerCase()
  if (combined.includes('ct_default') || combined.includes('ct-side') || combined.includes('ct side')) return 'ct_side'
  if (combined.includes('t_default') || combined.includes('t-side') || combined.includes('t side')) return 't_side'
  return null
}

function pushChunk(
  out: Omit<KnowledgeChunk, 'embedding'>[],
  text: string,
  map: string,
  fileName: string,
  heading: string | null,
  indexRef: { n: number },
) {
  const trimmed = text.trim()
  if (trimmed.length < 20) return
  out.push({
    map,
    side: inferSide(fileName, heading),
    fileName,
    heading,
    chunkIndex: indexRef.n++,
    content: trimmed,
  })
}

function splitOversized(
  text: string,
  map: string,
  fileName: string,
  heading: string | null,
  indexRef: { n: number },
  out: Omit<KnowledgeChunk, 'embedding'>[],
) {
  const paragraphs = text.split(/\n\n+/)
  let buf = ''
  for (const para of paragraphs) {
    const candidate = buf ? buf + '\n\n' + para : para
    if (candidate.length > MAX_CHUNK_CHARS && buf.length > 0) {
      pushChunk(out, buf, map, fileName, heading, indexRef)
      buf = para
    } else {
      buf = candidate
    }
  }
  if (buf) pushChunk(out, buf, map, fileName, heading, indexRef)
}

export function chunkMarkdownFile(
  fileName: string,
  content: string,
): Omit<KnowledgeChunk, 'embedding'>[] {
  const map = inferMap(fileName)
  const lines = content.split('\n')
  const out: Omit<KnowledgeChunk, 'embedding'>[] = []
  const indexRef = { n: 0 }

  let heading: string | null = null
  let buf: string[] = []

  function flush() {
    const text = buf.join('\n').trim()
    if (!text) return
    if (text.length <= MAX_CHUNK_CHARS) {
      pushChunk(out, text, map, fileName, heading, indexRef)
    } else {
      splitOversized(text, map, fileName, heading, indexRef, out)
    }
    buf = []
  }

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush()
      heading = line.replace(/^##\s+/, '').trim()
    } else {
      buf.push(line)
    }
  }
  flush()

  return out
}
