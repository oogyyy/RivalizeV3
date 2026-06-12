-- Tracks the content hash of each ingested knowledge base file so the
-- boot-time sync (lib/knowledge/sync.ts) only re-embeds files that changed.

create table if not exists cs2_knowledge_files (
  file_name    text primary key,
  content_hash text not null,
  updated_at   timestamptz not null default now()
);

-- Service-role only: RLS enabled with no user policies.
alter table cs2_knowledge_files enable row level security;
