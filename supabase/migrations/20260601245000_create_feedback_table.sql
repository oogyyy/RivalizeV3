-- Feedback table. Renamed off the duplicate version 20260601240000 and made
-- idempotent so it replays cleanly on a fresh database and is a safe no-op
-- where it already exists.
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('bug', 'suggestion', 'other')),
  title       text,
  description text not null,
  email       text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Anyone can submit feedback" on public.feedback;
create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  with check (true);

drop policy if exists "Service role can read feedback" on public.feedback;
create policy "Service role can read feedback"
  on public.feedback
  for select
  using (false);
