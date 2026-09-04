-- =========================================================
-- HADES DATA — 004 집계 테이블 & 서버 사이드 집계 함수(RPC)
--   * 모든 집계는 DB 에서 수행한다. 클라이언트로 원시 행을 내리지 않는다.
--   * click_events 는 RLS 로 직접 읽기가 막혀 있으므로
--     집계 함수만 security definer 로 노출한다.
-- =========================================================

-- ---------------------------------------------------------
-- 일별 클릭 집계 (원시 이벤트가 커지면 이 테이블만 조회)
-- ---------------------------------------------------------
-- member_id / broadcast_id 는 NULL 일 수 있으므로 복합 PK 대신 대리키 + NULLS NOT DISTINCT 유니크 인덱스를 쓴다.
create table if not exists public.daily_click_stats (
    id              bigint generated always as identity primary key,
    stat_date       date not null,
    member_id       uuid references public.members(id) on delete cascade,
    broadcast_id    uuid references public.broadcasts(id) on delete cascade,
    target_type     text not null,
    click_count     integer not null default 0,
    unique_sessions integer not null default 0,
    updated_at      timestamptz not null default now()
);

create unique index if not exists uq_daily_click_stats
  on public.daily_click_stats(stat_date, target_type, member_id, broadcast_id) nulls not distinct;

create index if not exists idx_daily_click_stats_date   on public.daily_click_stats(stat_date desc);
create index if not exists idx_daily_click_stats_member on public.daily_click_stats(member_id, stat_date desc);

alter table public.daily_click_stats enable row level security;

drop policy if exists "public read daily_click_stats" on public.daily_click_stats;
create policy "public read daily_click_stats" on public.daily_click_stats
  for select to anon, authenticated using (true);

-- 특정 날짜(KST)의 원시 클릭을 집계 테이블로 rollup 한다. (수집기/크론에서 호출)
create or replace function public.rollup_click_stats(p_date date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.daily_click_stats where stat_date = p_date;

  insert into public.daily_click_stats
    (stat_date, member_id, broadcast_id, target_type, click_count, unique_sessions)
  select p_date,
         ce.member_id,
         ce.broadcast_id,
         ce.target_type,
         count(*)::int,
         count(distinct ce.session_hash)::int
  from public.click_events ce
  where (timezone('Asia/Seoul', ce.clicked_at))::date = p_date
  group by ce.member_id, ce.broadcast_id, ce.target_type;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- ---------------------------------------------------------
-- 멤버 종합 통계
-- ---------------------------------------------------------
create or replace function public.member_stats(
  p_member_id uuid,
  p_from      date default null,
  p_to        date default null
)
returns table (
  broadcast_count        integer,
  total_duration_seconds bigint,
  avg_viewers            integer,
  peak_viewers           integer,
  total_views            bigint,
  total_followers        bigint,
  catch_count            integer
)
language sql
stable
as $$
  with b as (
    select *
    from public.broadcasts
    where member_id = p_member_id
      and status <> 'cancelled'
      and (p_from is null or broadcast_date >= p_from)
      and (p_to   is null or broadcast_date <= p_to)
  )
  select
    (select count(*) from b)::int,
    coalesce((select sum(coalesce(duration_seconds,0)) from b), 0)::bigint,
    coalesce((select round(avg(nullif(avg_viewers,0)))::int from b), 0),
    coalesce((select max(peak_viewers) from b), 0),
    coalesce((select sum(views) from b), 0)::bigint,
    coalesce((select sum(followers_gained) from b), 0)::bigint,
    (select count(*) from public.catches c
      where c.member_id = p_member_id
        and (p_from is null or (timezone('Asia/Seoul', coalesce(c.published_at, c.created_at)))::date >= p_from)
        and (p_to   is null or (timezone('Asia/Seoul', coalesce(c.published_at, c.created_at)))::date <= p_to))::int;
$$;

-- ---------------------------------------------------------
-- 멤버 일별 시계열 (그래프 + 캘린더 공용)
-- ---------------------------------------------------------
create or replace function public.member_daily_series(
  p_member_id uuid,
  p_from      date,
  p_to        date
)
returns table (
  stat_date        date,
  broadcast_count  integer,
  duration_seconds bigint,
  avg_viewers      integer,
  peak_viewers     integer,
  views            bigint
)
language sql
stable
as $$
  select b.broadcast_date,
         count(*)::int,
         coalesce(sum(coalesce(b.duration_seconds,0)),0)::bigint,
         coalesce(round(avg(nullif(b.avg_viewers,0)))::int, 0),
         coalesce(max(b.peak_viewers), 0),
         coalesce(sum(b.views),0)::bigint
  from public.broadcasts b
  where b.member_id = p_member_id
    and b.status <> 'cancelled'
    and b.broadcast_date between p_from and p_to
  group by b.broadcast_date
  order by b.broadcast_date;
$$;

-- ---------------------------------------------------------
-- 날짜 요약 (Daily Archive 헤더)
-- ---------------------------------------------------------
create or replace function public.daily_summary(p_date date)
returns table (
  member_count           integer,
  broadcast_count        integer,
  total_duration_seconds bigint,
  avg_viewers            integer,
  peak_viewers           integer,
  total_views            bigint,
  catch_count            integer,
  click_count            integer,
  notice_count           integer
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select * from public.broadcasts
    where broadcast_date = p_date and status <> 'cancelled'
  )
  select
    (select count(distinct member_id) from b)::int,
    (select count(*) from b)::int,
    coalesce((select sum(coalesce(duration_seconds,0)) from b),0)::bigint,
    coalesce((select round(avg(nullif(avg_viewers,0)))::int from b),0),
    coalesce((select max(peak_viewers) from b),0),
    coalesce((select sum(views) from b),0)::bigint,
    (select count(*) from public.catches c
      where c.broadcast_id in (select id from b)
         or (timezone('Asia/Seoul', coalesce(c.published_at, c.created_at)))::date = p_date)::int,
    (select count(*) from public.click_events ce
      where (timezone('Asia/Seoul', ce.clicked_at))::date = p_date)::int,
    (select count(*) from public.notices n
      where (timezone('Asia/Seoul', coalesce(n.published_at, n.created_at)))::date = p_date)::int;
$$;

-- ---------------------------------------------------------
-- 멤버 비교 (통계 페이지)
-- ---------------------------------------------------------
create or replace function public.member_comparison(
  p_from date default null,
  p_to   date default null
)
returns table (
  member_id              uuid,
  name                   text,
  slug                   text,
  profile_image_url      text,
  broadcast_count        integer,
  total_duration_seconds bigint,
  avg_viewers            integer,
  peak_viewers           integer,
  total_views            bigint,
  catch_count            integer,
  click_count            integer
)
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select * from public.broadcasts
    where status <> 'cancelled'
      and (p_from is null or broadcast_date >= p_from)
      and (p_to   is null or broadcast_date <= p_to)
  )
  select m.id, m.name, m.slug, m.profile_image_url,
         coalesce(bs.cnt, 0),
         coalesce(bs.dur, 0),
         coalesce(bs.avgv, 0),
         coalesce(bs.peak, 0),
         coalesce(bs.views, 0),
         coalesce(cs.cnt, 0),
         coalesce(cl.cnt, 0)
  from public.members m
  left join (
    select member_id,
           count(*)::int as cnt,
           sum(coalesce(duration_seconds,0))::bigint as dur,
           coalesce(round(avg(nullif(avg_viewers,0)))::int,0) as avgv,
           coalesce(max(peak_viewers),0) as peak,
           coalesce(sum(views),0)::bigint as views
    from b group by member_id
  ) bs on bs.member_id = m.id
  left join (
    select c.member_id, count(*)::int as cnt
    from public.catches c
    where (p_from is null or (timezone('Asia/Seoul', coalesce(c.published_at, c.created_at)))::date >= p_from)
      and (p_to   is null or (timezone('Asia/Seoul', coalesce(c.published_at, c.created_at)))::date <= p_to)
    group by c.member_id
  ) cs on cs.member_id = m.id
  left join (
    select ce.member_id, count(*)::int as cnt
    from public.click_events ce
    where (p_from is null or (timezone('Asia/Seoul', ce.clicked_at))::date >= p_from)
      and (p_to   is null or (timezone('Asia/Seoul', ce.clicked_at))::date <= p_to)
    group by ce.member_id
  ) cl on cl.member_id = m.id
  where m.is_active = true
  order by bs.dur desc nulls last, m.name;
$$;

-- ---------------------------------------------------------
-- 클릭 집계 (target_type 별 / 시간대별 / 방송별)
-- ---------------------------------------------------------
create or replace function public.click_breakdown(
  p_from date default null,
  p_to   date default null
)
returns table (
  target_type     text,
  click_count     integer,
  unique_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select ce.target_type,
         count(*)::int,
         count(distinct ce.session_hash)::int
  from public.click_events ce
  where (p_from is null or (timezone('Asia/Seoul', ce.clicked_at))::date >= p_from)
    and (p_to   is null or (timezone('Asia/Seoul', ce.clicked_at))::date <= p_to)
  group by ce.target_type
  order by 2 desc;
$$;

create or replace function public.click_hourly(
  p_from date default null,
  p_to   date default null
)
returns table (
  hour        integer,
  click_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select extract(hour from timezone('Asia/Seoul', ce.clicked_at))::int as hour,
         count(*)::int
  from public.click_events ce
  where (p_from is null or (timezone('Asia/Seoul', ce.clicked_at))::date >= p_from)
    and (p_to   is null or (timezone('Asia/Seoul', ce.clicked_at))::date <= p_to)
  group by 1
  order by 1;
$$;

create or replace function public.broadcast_click_breakdown(p_broadcast_id uuid)
returns table (
  target_type     text,
  click_count     integer,
  unique_sessions integer
)
language sql
stable
security definer
set search_path = public
as $$
  select ce.target_type, count(*)::int, count(distinct ce.session_hash)::int
  from public.click_events ce
  where ce.broadcast_id = p_broadcast_id
  group by ce.target_type
  order by 2 desc;
$$;

-- ---------------------------------------------------------
-- 오늘 시청자 추이 (대시보드) — 5분 버킷, 전 멤버 합산
-- ---------------------------------------------------------
create or replace function public.viewer_series_for_date(p_date date)
returns table (
  bucket        timestamptz,
  total_viewers integer,
  live_count    integer
)
language sql
stable
as $$
  select to_timestamp(floor(extract(epoch from vs.recorded_at) / 300) * 300) as bucket,
         sum(vs.viewers)::int,
         count(distinct b.member_id)::int
  from public.viewer_snapshots vs
  join public.broadcasts b on b.id = vs.broadcast_id
  where b.broadcast_date = p_date
  group by 1
  order by 1;
$$;

-- ---------------------------------------------------------
-- 실행 권한
-- ---------------------------------------------------------
grant execute on function public.member_stats(uuid, date, date)        to anon, authenticated;
grant execute on function public.member_daily_series(uuid, date, date) to anon, authenticated;
grant execute on function public.daily_summary(date)                   to anon, authenticated;
grant execute on function public.member_comparison(date, date)         to anon, authenticated;
grant execute on function public.click_breakdown(date, date)           to anon, authenticated;
grant execute on function public.click_hourly(date, date)              to anon, authenticated;
grant execute on function public.broadcast_click_breakdown(uuid)       to anon, authenticated;
grant execute on function public.viewer_series_for_date(date)          to anon, authenticated;
revoke execute on function public.rollup_click_stats(date) from anon, authenticated;
