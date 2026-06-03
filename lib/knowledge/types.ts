export interface KnowledgeChunk {
  id?: string
  teamId?: string | null
  map: string
  side?: 't_side' | 'ct_side' | null
  fileName: string
  heading?: string | null
  chunkIndex: number
  content: string
  embedding?: number[]
  similarity?: number
}

export interface RetrievalParams {
  query: string
  map?: string
  teamId?: string | null
  topK?: number
  similarityThreshold?: number
}

export interface RetrievalResult {
  chunks: KnowledgeChunk[]
  source: 'vector' | 'metadata' | 'file'
}
