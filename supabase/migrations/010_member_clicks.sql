-- =========================================================
-- HADES DATA — 010 멤버별 클릭 집계
--
-- 사이트 구조를 "전체 비교" 대신 "멤버별로 보기" 로 바꾸면서,
-- 클릭 분석도 한 멤버만 따로 볼 수 있어야 한다.
-- 기존 click_breakdown / click_hourly 는 전체 기준이라 멤버 필터가 없으므로
-- 같은 형태에 member_id 조건만 더한 함수를 따로 둔다.
--
-- click_events 는 공개 SELECT 정책이 없다(원시 로그 비공개).
-- 그래서 여기서도 security definer 로 집계 결과만 노출한다.
-- =========================================================

create or replace function public.member_click_breakdown(
  p_member_id uuid,
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
  where ce.member_id = p_member_id
    and (p_from is null or (timezone('Asia/Seoul', ce.clicked_at))::date >= p_from)
    and (p_to   is null or (timezone('Asia/Seoul', ce.clicked_at))::date <= p_to)
  group by ce.target_type
  order by 2 desc;
$$;

create or replace function public.member_click_hourly(
  p_member_id uuid,
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
  where ce.member_id = p_member_id
    and (p_from is null or (timezone('Asia/Seoul', ce.clicked_at))::date >= p_from)
    and (p_to   is null or (timezone('Asia/Seoul', ce.clicked_at))::date <= p_to)
  group by 1
  order by 1;
$$;

-- 멤버 조건이 붙는 조회가 늘어나므로 인덱스를 맞춰 둔다.
create index if not exists idx_click_events_member_time
  on public.click_events(member_id, clicked_at desc);

grant execute on function public.member_click_breakdown(uuid, date, date) to anon, authenticated;
grant execute on function public.member_click_hourly(uuid, date, date)    to anon, authenticated;
