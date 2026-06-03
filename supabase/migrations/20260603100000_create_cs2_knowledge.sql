-- ── Phase 3: CS2 Knowledge RAG ────────────────────────────────────────────────
-- Stores chunked markdown knowledge-base content with pgvector embeddings.
-- team_id IS NULL  → global shared knowledge (Phase 1 files, ingested once)
-- team_id IS NOT NULL → team-specific customisations (future)

-- Enable pgvector (already available on Supabase; no-ops if present)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cs2_knowledge (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid        REFERENCES teams(id) ON DELETE CASCADE,
  map         text        NOT NULL DEFAULT 'global',
  side        text        CHECK (side IN ('t_side', 'ct_side')),
  file_name   text        NOT NULL,
  heading     text,
  chunk_index integer     NOT NULL DEFAULT 0,
  content     text        NOT NULL,
  embedding   vector(384),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Partial unique indexes handle NULL team_id correctly
-- (standard UNIQUE treats two NULLs as unequal, so we need these separately)
CREATE UNIQUE INDEX IF NOT EXISTS cs2_knowledge_global_uq
  ON cs2_knowledge (file_name, chunk_index)
  WHERE team_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cs2_knowledge_team_uq
  ON cs2_knowledge (file_name, chunk_index, team_id)
  WHERE team_id IS NOT NULL;

-- Filtered lookup indexes
CREATE INDEX IF NOT EXISTS cs2_knowledge_map_idx  ON cs2_knowledge (map);
CREATE INDEX IF NOT EXISTS cs2_knowledge_team_idx ON cs2_knowledge (team_id);

-- IVFFlat vector index — lists=50 is optimal for ≤5 000 rows.
-- Re-run CREATE INDEX after row count grows beyond 5 000 with lists=100.
CREATE INDEX IF NOT EXISTS cs2_knowledge_embed_idx ON cs2_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE cs2_knowledge ENABLE ROW LEVEL SECURITY;

-- Global rows (team_id IS NULL) are readable by every authenticated user
CREATE POLICY "cs2_knowledge_global_read" ON cs2_knowledge
  FOR SELECT TO authenticated
  USING (team_id IS NULL);

-- Team rows are only readable by members of that team
CREATE POLICY "cs2_knowledge_team_read" ON cs2_knowledge
  FOR SELECT TO authenticated
  USING (
    team_id IS NOT NULL
    AND private.is_team_member(team_id, auth.uid())
  );

-- ── RPC: vector similarity search ────────────────────────────────────────────
-- Called from lib/knowledge/retrieval.ts via supabase.rpc('match_cs2_knowledge')
-- Requires query_embedding to be pre-computed by the caller.
-- Returns rows ordered by cosine similarity (highest first).

CREATE OR REPLACE FUNCTION public.match_cs2_knowledge(
  query_embedding  vector(384),
  filter_map       text        DEFAULT 'global',
  team_filter      uuid        DEFAULT NULL,
  match_count      integer     DEFAULT 8,
  similarity_threshold float   DEFAULT 0.30
)
RETURNS TABLE (
  id          uuid,
  team_id     uuid,
  map         text,
  side        text,
  file_name   text,
  heading     text,
  chunk_index integer,
  content     text,
  similarity  float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.team_id,
    k.map,
    k.side,
    k.file_name,
    k.heading,
    k.chunk_index,
    k.content,
    (1 - (k.embedding <=> query_embedding))::float AS similarity
  FROM cs2_knowledge k
  WHERE
    -- Map filter: include map-specific rows + global principles/utility rows
    (k.map = filter_map OR k.map = 'global')
    -- Team filter: always include global rows; also include team rows if requested
    AND (
      k.team_id IS NULL
      OR (team_filter IS NOT NULL AND k.team_id = team_filter)
    )
    -- Only rows that have embeddings
    AND k.embedding IS NOT NULL
    -- Similarity threshold guard (avoids returning totally unrelated chunks)
    AND (1 - (k.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Allow authenticated role to call this RPC
GRANT EXECUTE ON FUNCTION public.match_cs2_knowledge TO authenticated;
