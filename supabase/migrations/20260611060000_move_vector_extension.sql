-- Move the pgvector extension out of the public schema (advisor 0014).
--
-- Idempotent and schema-agnostic: production had vector in `public`, but a
-- fresh Supabase build pre-installs it in `extensions`. We only move it if it
-- is currently in public, and we widen match_cs2_knowledge's search_path so the
-- <=> cosine operator resolves wherever the extension lives. The type, index
-- and operator class are referenced by OID and follow the extension.

create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;

do $$
declare
  cur_schema text;
  fn         regprocedure;
begin
  select n.nspname into cur_schema
  from pg_extension e join pg_namespace n on e.extnamespace = n.oid
  where e.extname = 'vector';

  if cur_schema = 'public' then
    alter extension vector set schema extensions;
  end if;

  select p.oid::regprocedure into fn
  from pg_proc p join pg_namespace n on p.pronamespace = n.oid
  where n.nspname = 'public' and p.proname = 'match_cs2_knowledge'
  limit 1;

  if fn is not null then
    execute format('alter function %s set search_path = public, extensions', fn);
  end if;
end $$;
