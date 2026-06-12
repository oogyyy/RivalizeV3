-- AI output feedback — the raw material for fine-tuning a custom CS2 model.
-- Users rate AI outputs (coach answers, playbook sections, briefs); positively
-- rated examples are exported as a fine-tuning dataset by
-- scripts/export-finetune-dataset.ts.

create table if not exists ai_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  feature     text not null,
  model       text not null,
  rating      smallint not null check (rating in (-1, 1)),
  prompt      text,
  content     text not null,
  context     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists ai_feedback_user_idx
  on ai_feedback (user_id, created_at desc);

create index if not exists ai_feedback_dataset_idx
  on ai_feedback (feature, rating, created_at desc);

alter table ai_feedback enable row level security;

create policy "Users manage own ai feedback"
  on ai_feedback for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
