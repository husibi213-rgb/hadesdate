-- =========================================================
-- HADES DATA — 008 검색
--
-- 한국어는 PostgreSQL 기본 전문검색 사전이 없어서 to_tsvector 가 잘 동작하지 않는다.
-- 그래서 pg_trgm(3-gram) 인덱스 + ILIKE 부분일치로 간다.
-- 트라이그램 인덱스가 있으면 '%검색어%' 도 순차 스캔 없이 처리된다.
-- =========================================================

create extension if not exists pg_trgm;

create index if not exists idx_members_name_trgm
  on public.members using gin (name gin_trgm_ops);

create index if not exists idx_broadcasts_title_trgm
  on public.broadcasts using gin (title gin_trgm_ops);

create index if not exists idx_catches_title_trgm
  on public.catches using gin (title gin_trgm_ops);

create index if not exists idx_notices_title_trgm
  on public.notices using gin (title gin_trgm_ops);

-- ---------------------------------------------------------
-- 통합 검색
--   kind: member | broadcast | catch | notice
--   href: 그대로 링크에 쓸 수 있는 경로
-- ---------------------------------------------------------
create or replace function public.search_all(
  p_query text,
  p_limit integer default 8
)
returns table (
  kind         text,
  id           text,
  title        text,
  subtitle     text,
  member_name  text,
  member_slug  text,
  occurred_on  date,
  href         text,
  metric       integer
)
language sql
stable
as $$
  with q as (
    select
      -- LIKE 메타문자를 이스케이프해서 사용자가 넣은 % _ 가 와일드카드로 동작하지 않게 한다.
      '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
        as pattern,
      greatest(1, least(coalesce(p_limit, 8), 50)) as lim,
      -- 빈 검색어로 전체가 쏟아지지 않게 한다.
      length(btrim(coalesce(p_query, ''))) > 0 as valid
  ),
  -- UNION 의 컬럼 이름은 첫 번째 분기에서 결정되므로 여기서만 별칭을 붙인다.
  members_hit as (
    select 'member'::text                                  as kind,
           m.id::text                                      as id,
           m.name                                          as title,
           coalesce(m.channel_id, '')                      as subtitle,
           m.name                                          as member_name,
           coalesce(m.slug, m.id::text)                    as member_slug,
           null::date                                      as occurred_on,
           '/members/' || coalesce(m.slug, m.id::text)     as href,
           0                                               as metric
    from public.members m, q
    where q.valid and m.is_active = true and m.name ilike q.pattern escape '\'
    limit (select lim from q)
  ),
  broadcasts_hit as (
    select 'broadcast'::text,
           b.id::text,
           coalesce(b.title, '제목 없음'),
           to_char(b.broadcast_date, 'YYYY.MM.DD'),
           m.name,
           coalesce(m.slug, m.id::text),
           b.broadcast_date,
           '/broadcasts/' || b.id::text,
           b.peak_viewers
    from public.broadcasts b
    join public.members m on m.id = b.member_id, q
    where q.valid and b.title ilike q.pattern escape '\'
    order by b.started_at desc
    limit (select lim from q)
  ),
  catches_hit as (
    select 'catch'::text,
           c.id::text,
           coalesce(c.title, '제목 없음'),
           to_char(c.catch_date, 'YYYY.MM.DD'),
           m.name,
           coalesce(m.slug, m.id::text),
           c.catch_date,
           c.catch_url,
           c.views
    from public.catches c
    join public.members m on m.id = c.member_id, q
    where q.valid and c.title ilike q.pattern escape '\'
    order by c.views desc
    limit (select lim from q)
  ),
  notices_hit as (
    select 'notice'::text,
           n.id::text,
           n.title,
           coalesce(n.summary, ''),
           null::text,
           null::text,
           (timezone('Asia/Seoul', coalesce(n.published_at, n.created_at)))::date,
           coalesce(n.url, '/notices'),
           0
    from public.notices n, q
    where q.valid and n.title ilike q.pattern escape '\'
    order by n.published_at desc nulls last
    limit (select lim from q)
  )
  select * from (
    select * from members_hit
    union all select * from broadcasts_hit
    union all select * from catches_hit
    union all select * from notices_hit
  ) hits
  -- 멤버를 먼저, 그 다음은 최신순 → 지표 높은 순
  order by case hits.kind
             when 'member' then 0
             when 'broadcast' then 1
             when 'catch' then 2
             else 3
           end,
           hits.occurred_on desc nulls last,
           hits.metric desc;
$$;

grant execute on function public.search_all(text, integer) to anon, authenticated;
