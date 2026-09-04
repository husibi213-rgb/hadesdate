-- =========================================================
-- HADES DATA — 007 Realtime
-- broadcasts 변경을 구독해서 LIVE 상태를 실시간으로 갱신한다.
-- (Supabase 대시보드 Database > Replication 에서 켜는 것과 같은 작업)
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'broadcasts'
  ) then
    alter publication supabase_realtime add table public.broadcasts;
  end if;
end
$$;

-- 실시간으로 내려보낼 때 이전 값 비교가 필요하면 REPLICA IDENTITY 를 올린다.
-- 여기서는 변경 알림만 받으면 되므로 기본값(primary key)으로 충분하다.
