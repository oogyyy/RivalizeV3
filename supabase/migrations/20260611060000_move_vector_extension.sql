-- Move the pgvector extension out of the public schema (advisor 0014).
--
-- Only three objects depend on it — cs2_knowledge.embedding, the HNSW index,
-- and match_cs2_knowledge(). The type, operators and operator class are
-- referenced by OID, so the column and index follow the extension automatically.
-- The one thing that would break is operator resolution (<=>) inside
-- match_cs2_knowledge, whose search_path was 'public'. We add 'extensions' so
-- the cosine operator still resolves. No function body change.

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

alter extension vector set schema extensions;

-- The arg type is now extensions.vector after the move.
alter function public.match_cs2_knowledge(extensions.vector, text, uuid, integer, double precision)
  set search_path = public, extensions;
