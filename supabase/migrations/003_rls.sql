-- =========================================================
-- HADES DATA — 003 Row Level Security
--   일반 방문자 : SELECT 만
--   click_events: 익명 INSERT 허용(집계용), SELECT 는 서버 전용
--   수집기/관리자: service_role (RLS 우회)
-- =========================================================

alter table public.members         enable row level security;
alter table public.broadcasts      enable row level security;
alter table public.viewer_snapshots enable row level security;
alter table public.catches         enable row level security;
alter table public.click_events    enable row level security;
alter table public.notices         enable row level security;
alter table public.member_notices  enable row level security;

-- ---------- public read ----------
drop policy if exists "public read members" on public.members;
create policy "public read members" on public.members
  for select to anon, authenticated using (is_active = true);

drop policy if exists "public read broadcasts" on public.broadcasts;
create policy "public read broadcasts" on public.broadcasts
  for select to anon, authenticated using (true);

drop policy if exists "public read viewer_snapshots" on public.viewer_snapshots;
create policy "public read viewer_snapshots" on public.viewer_snapshots
  for select to anon, authenticated using (true);

drop policy if exists "public read catches" on public.catches;
create policy "public read catches" on public.catches
  for select to anon, authenticated using (true);

drop policy if exists "public read notices" on public.notices;
create policy "public read notices" on public.notices
  for select to anon, authenticated using (true);

drop policy if exists "public read member_notices" on public.member_notices;
create policy "public read member_notices" on public.member_notices
  for select to anon, authenticated using (true);

-- ---------- click_events ----------
-- 원시 클릭 로그는 개별 조회를 허용하지 않는다. (집계 RPC 로만 노출)
-- 쓰기는 서버 라우트(service_role)를 통해서만 수행한다.
drop policy if exists "no public read click_events" on public.click_events;

-- write 권한은 어떤 정책도 부여하지 않는다 => anon/authenticated 는 INSERT/UPDATE/DELETE 불가.
-- service_role 은 RLS 를 우회하므로 수집기/관리자 API 에서만 기록한다.
