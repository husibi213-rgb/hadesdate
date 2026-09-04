-- =========================================================
-- HADES DATA — 006 캐치 날짜축 + 월간/일간 종합 집계
--   * catches.catch_date : 캐치 발생 날짜(KST). broadcasts.broadcast_date 와 같은 규칙.
--   * daily_totals   : 기간 내 "하루 단위" 전체 종합 (월 페이지 그래프)
--   * monthly_totals : 기간 내 "한 달 단위" 종합 (연간 추이 / 월 목록)
--   * month_summary  : 특정 월 한 줄 요약
-- =========================================================

-- ---------------------------------------------------------
-- 캐치 날짜축
-- ---------------------------------------------------------
alter table public.catches
  add column if not exists catch_date date
    generated always as
      ((timezone('Asia/Seoul', coalesce(published_at, created_at)))::date) stored;

comment on column public.catches.catch_date is '캐치 발생 날짜(KST). 날짜별 정렬/그룹핑의 기준축.';

-- 날짜별 + 조회수순 나열을 위한 인덱스
create index if not exists idx_catches_date_views
  on public.catches(catch_date desc, views desc);

create index if not exists idx_catches_member_date_views
  on public.catches(member_id, catch_date desc, views desc);

-- ---------------------------------------------------------
-- 일간 종합 (전체 멤버 합산) — 월 페이지의 일별 그래프
-- ---------------------------------------------------------
create or replace function public.daily_totals(p_from date, p_to date)
returns table (
  stat_date        date,
  member_count     integer,
  broadcast_count  integer,
  duration_seconds bigint,
  avg_viewers      integer,
  peak_viewers     integer,
  views            bigint,
  catch_count      integer
)
language sql
stable
as $$
  with days as (
    select d::date as stat_date
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  b as (
    select broadcast_date,
           count(distinct member_id)::int                        as member_count,
           count(*)::int                                          as broadcast_count,
           coalesce(sum(coalesce(duration_seconds,0)),0)::bigint  as duration_seconds,
           coalesce(round(avg(nullif(avg_viewers,0)))::int,0)      as avg_viewers,
           coalesce(max(peak_viewers),0)                          as peak_viewers,
           coalesce(sum(views),0)::bigint                         as views
    from public.broadcasts
    where status <> 'cancelled' and broadcast_date between p_from and p_to
    group by broadcast_date
  ),
  c as (
    select catch_date, count(*)::int as catch_count
    from public.catches
    where catch_date between p_from and p_to
    group by catch_date
  )
  select days.stat_date,
         coalesce(b.member_count, 0),
         coalesce(b.broadcast_count, 0),
         coalesce(b.duration_seconds, 0),
         coalesce(b.avg_viewers, 0),
         coalesce(b.peak_viewers, 0),
         coalesce(b.views, 0),
         coalesce(c.catch_count, 0)
  from days
  left join b on b.broadcast_date = days.stat_date
  left join c on c.catch_date     = days.stat_date
  order by days.stat_date;
$$;

-- ---------------------------------------------------------
-- 월간 종합 (연간 추이 / 월 목록용)
-- ---------------------------------------------------------
create or replace function public.monthly_totals(p_from date, p_to date)
returns table (
  month_start      date,
  active_days      integer,
  member_count     integer,
  broadcast_count  integer,
  duration_seconds bigint,
  avg_viewers      integer,
  peak_viewers     integer,
  views            bigint,
  catch_count      integer
)
language sql
stable
as $$
  with b as (
    select date_trunc('month', broadcast_date)::date          as month_start,
           count(distinct broadcast_date)::int                 as active_days,
           count(distinct member_id)::int                      as member_count,
           count(*)::int                                       as broadcast_count,
           coalesce(sum(coalesce(duration_seconds,0)),0)::bigint as duration_seconds,
           coalesce(round(avg(nullif(avg_viewers,0)))::int,0)   as avg_viewers,
           coalesce(max(peak_viewers),0)                        as peak_viewers,
           coalesce(sum(views),0)::bigint                       as views
    from public.broadcasts
    where status <> 'cancelled' and broadcast_date between p_from and p_to
    group by 1
  ),
  c as (
    select date_trunc('month', catch_date)::date as month_start,
           count(*)::int                          as catch_count
    from public.catches
    where catch_date between p_from and p_to
    group by 1
  )
  select coalesce(b.month_start, c.month_start),
         coalesce(b.active_days, 0),
         coalesce(b.member_count, 0),
         coalesce(b.broadcast_count, 0),
         coalesce(b.duration_seconds, 0),
         coalesce(b.avg_viewers, 0),
         coalesce(b.peak_viewers, 0),
         coalesce(b.views, 0),
         coalesce(c.catch_count, 0)
  from b
  full outer join c on c.month_start = b.month_start
  order by 1;
$$;

-- ---------------------------------------------------------
-- 특정 월 요약 (월 페이지 헤더)
-- ---------------------------------------------------------
create or replace function public.month_summary(p_from date, p_to date)
returns table (
  active_days            integer,
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
    where status <> 'cancelled' and broadcast_date between p_from and p_to
  )
  select
    (select count(distinct broadcast_date) from b)::int,
    (select count(distinct member_id) from b)::int,
    (select count(*) from b)::int,
    coalesce((select sum(coalesce(duration_seconds,0)) from b),0)::bigint,
    coalesce((select round(avg(nullif(avg_viewers,0)))::int from b),0),
    coalesce((select max(peak_viewers) from b),0),
    coalesce((select sum(views) from b),0)::bigint,
    (select count(*) from public.catches c
      where c.catch_date between p_from and p_to)::int,
    (select count(*) from public.click_events ce
      where (timezone('Asia/Seoul', ce.clicked_at))::date between p_from and p_to)::int,
    (select count(*) from public.notices n
      where (timezone('Asia/Seoul', coalesce(n.published_at, n.created_at)))::date
            between p_from and p_to)::int;
$$;

grant execute on function public.daily_totals(date, date)   to anon, authenticated;
grant execute on function public.monthly_totals(date, date) to anon, authenticated;
grant execute on function public.month_summary(date, date)  to anon, authenticated;
