-- Phase 4: Upgrade pgvector index IVFFlat → HNSW + add demos lookup index.
--
-- IVFFlat requires lists-based approximate search and can miss neighbors on
-- small/growing datasets. HNSW (Hierarchical Navigable Small World) gives
-- better recall and does not need a training phase (no minimum row count).
-- m=16 / ef_construction=64 are Supabase-recommended defaults for 384-dim vectors.

-- Drop old IVFFlat index first (cannot ALTER index type in-place).
DROP INDEX IF EXISTS cs2_knowledge_embed_idx;

-- HNSW index — works at any table size, better recall vs IVFFlat at low row counts.
CREATE INDEX IF NOT EXISTS cs2_knowledge_embed_hnsw_idx ON cs2_knowledge
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── Demos lookup index ────────────────────────────────────────────────────────
-- Used by the worker and dashboard when ordering by created_at within a team.
-- The existing demos_team_status_type_parsed_idx covers (team_id, status, demo_type)
-- for completed opponent demos; this covers the general created_at ordering case.
CREATE INDEX IF NOT EXISTS demos_team_created_idx
  ON demos (team_id, status, created_at DESC);
