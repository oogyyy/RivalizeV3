-- AI coach conversation persistence + AI token usage logging

-- ── Coach sessions ───────────────────────────────────────────────────────────
create table if not exists coach_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  team_id     uuid references teams(id) on delete set null,
  folder_id   uuid references team_folders(id) on delete set null,
  mode        text not null default 'opponent' check (mode in ('opponent', 'myteam')),
  focus_area  text,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coach_sessions_user_idx
  on coach_sessions (user_id, updated_at desc);

create table if not exists coach_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references coach_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists coach_messages_session_idx
  on coach_messages (session_id, created_at);

alter table coach_sessions enable row level security;
alter table coach_messages enable row level security;

create policy "Users manage own coach sessions"
  on coach_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage messages in own coach sessions"
  on coach_messages for all
  using (exists (
    select 1 from coach_sessions s
    where s.id = coach_messages.session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from coach_sessions s
    where s.id = coach_messages.session_id and s.user_id = auth.uid()
  ));

-- ── AI usage logging ─────────────────────────────────────────────────────────
-- Written by the service role from API routes; users can read their own rows.
create table if not exists ai_usage (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  feature           text not null,
  model             text not null,
  prompt_tokens     integer,
  completion_tokens integer,
  created_at        timestamptz not null default now()
);

create index if not exists ai_usage_user_idx
  on ai_usage (user_id, created_at desc);

alter table ai_usage enable row level security;

create policy "Users read own ai usage"
  on ai_usage for select
  using (auth.uid() = user_id);
