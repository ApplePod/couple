-- Supabase SQL Editor에서 실행하세요
-- Dashboard → SQL Editor → New query

create table if not exists budget_checks (
  id text primary key,
  checks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 초기 행 (선택)
insert into budget_checks (id, checks)
values ('sion_checks', '{}'::jsonb)
on conflict (id) do nothing;

-- RLS: anon 키로 읽기/쓰기 허용 (둘만 쓰는 비공개 앱용)
alter table budget_checks enable row level security;

create policy "allow public read write"
  on budget_checks
  for all
  using (true)
  with check (true);

-- Realtime 활성화: Database → Replication → budget_checks 켜기
-- 또는:
-- alter publication supabase_realtime add table budget_checks;
