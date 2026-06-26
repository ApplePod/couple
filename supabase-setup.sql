-- Supabase SQL Editor에서 실행하세요
-- Dashboard → SQL Editor → New query
--
-- checks JSON 구조 (테이블/컬럼 변경 불필요 — jsonb 안에 모두 저장):
-- {
--   "2026": {
--     "7": {
--       "yj_irp": true,
--       "yj_irp_actual": 500000,
--       "sn_isa": true,
--       "sn_isa_actual": 480000
--     }
--   }
-- }

create table if not exists budget_checks (
  id text primary key,
  checks jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 초기 행 (선택)
insert into budget_checks (id, checks)
values ('sion_checks', '{}'::jsonb)
on conflict (id) do nothing;

insert into budget_checks (id, checks)
values ('sion_portfolio', '{"ledger":{}}'::jsonb)
on conflict (id) do nothing;

-- RLS: anon 키로 읽기/쓰기 허용 (둘만 쓰는 비공개 앱용)
alter table budget_checks enable row level security;

drop policy if exists "allow public read write" on budget_checks;
create policy "allow public read write"
  on budget_checks
  for all
  using (true)
  with check (true);

-- Realtime: Dashboard → Database → Replication → budget_checks 켜기
-- alter publication supabase_realtime add table budget_checks;
