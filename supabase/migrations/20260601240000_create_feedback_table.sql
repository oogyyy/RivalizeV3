create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('bug', 'suggestion', 'other')),
  title       text,
  description text not null,
  email       text,
  user_id     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  with check (true);

create policy "Service role can read feedback"
  on public.feedback
  for select
  using (false);
