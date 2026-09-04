-- =========================================================
-- HADES DATA — 전체 마이그레이션 (001~009 합본)
--
-- Supabase SQL Editor 에 이 파일 하나만 붙여넣고 실행하면 된다.
-- 여러 번 실행해도 안전하다 (create if not exists / create or replace / do 블록).
--
-- 더미 데이터가 필요하면 이 파일을 실행한 뒤 supabase/seed.sql 을 따로 실행한다.
-- (seed.sql 은 truncate 로 시작하므로 운영 DB 에서는 실행하지 않는다)
-- =========================================================


-- ##########  001_initial.sql  ##########
-- =========================================================
-- HADES DATA — 001 initial schema
-- =========================================================
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- members
-- ---------------------------------------------------------
create table if not exists public.members (
    id                uuid primary key default gen_random_uuid(),
    name              text not null,
    slug              text unique,
    channel_id        text unique,
    channel_url       text,
    profile_image_url text,
    color             text,
    is_active         boolean not null default true,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

comment on table public.members is '하데스 멤버. slug 는 URL 에서 memberId 대신 사용할 수 있다.';

-- ---------------------------------------------------------
-- broadcasts (= 방송 세션. 모든 데이터의 중심)
-- ---------------------------------------------------------
create table if not exists public.broadcasts (
    id               uuid primary key default gen_random_uuid(),
    member_id        uuid not null references public.members(id) on delete cascade,

    title            text,
    started_at       timestamptz not null,
    ended_at         timestamptz,
    duration_seconds integer,

    avg_viewers      integer not null default 0,
    peak_viewers     integer not null default 0,
    views            integer not null default 0,
    followers_gained integer not null default 0,

    vod_url          text,
    thumbnail_url    text,

    status           text not null default 'ended'
                       check (status in ('live', 'ended', 'cancelled')),

    external_id      text,

    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),

    -- 방송 시작 시각(KST) 기준 날짜. 날짜 페이지/캘린더의 기준 축.
    -- timezone(text, timestamptz) 는 IMMUTABLE 이므로 generated column 사용 가능.
    broadcast_date   date generated always as
                       ((timezone('Asia/Seoul', started_at))::date) stored,

    constraint broadcasts_time_order check (ended_at is null or ended_at >= started_at),
    constraint broadcasts_external_unique unique (member_id, external_id)
);

comment on column public.broadcasts.broadcast_date is '방송 시작 시각(KST) 기준 날짜. 자정을 넘긴 방송도 시작일에 귀속된다.';

-- ---------------------------------------------------------
-- viewer_snapshots (방송 중 시계열 지표)
-- ---------------------------------------------------------
create table if not exists public.viewer_snapshots (
    id           bigint generated always as identity primary key,
    broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
    recorded_at  timestamptz not null,
    viewers      integer not null default 0,
    -- 선택 지표 (수집기가 제공하면 채운다)
    clicks       integer,
    followers    integer,
    constraint viewer_snapshots_unique unique (broadcast_id, recorded_at)
);

-- ---------------------------------------------------------
-- catches (방송 캐치)
-- ---------------------------------------------------------
create table if not exists public.catches (
    id                  uuid primary key default gen_random_uuid(),
    broadcast_id        uuid references public.broadcasts(id) on delete cascade,
    member_id           uuid not null references public.members(id) on delete cascade,

    title               text,
    description         text,
    catch_url           text not null,
    thumbnail_url       text,

    -- 방송 시작 기준 경과 초
    broadcast_timestamp integer,

    views               integer not null default 0,
    likes               integer not null default 0,

    external_id         text,
    published_at        timestamptz,
    created_at          timestamptz not null default now(),

    constraint catches_external_unique unique (member_id, external_id)
);

comment on table public.catches is '원본 콘텐츠를 복제하지 않는다. 메타데이터 + 원본 링크만 저장한다.';

-- ---------------------------------------------------------
-- click_events (익명 집계 전용. 개인정보 저장 금지)
-- ---------------------------------------------------------
create table if not exists public.click_events (
    id           bigint generated always as identity primary key,
    broadcast_id uuid references public.broadcasts(id) on delete set null,
    member_id    uuid references public.members(id) on delete set null,

    target_type  text not null
                   check (target_type in ('broadcast','member','catch','vod','profile','notice','external')),
    target_id    text,

    -- 익명화된 세션 해시. 닉네임/IP/계정정보를 저장하지 않는다.
    session_hash text,

    clicked_at   timestamptz not null default now()
);

comment on column public.click_events.session_hash is '익명 해시. 개인 식별 정보(IP/닉네임/계정)는 절대 저장하지 않는다.';

-- ---------------------------------------------------------
-- notices
-- ---------------------------------------------------------
create table if not exists public.notices (
    id           uuid primary key default gen_random_uuid(),
    source       text not null check (source in ('cafe','broadcast_station','other')),
    external_id  text,
    title        text not null,
    summary      text,
    content      text,
    url          text,
    published_at timestamptz,
    created_at   timestamptz not null default now(),
    unique (source, external_id)
);

comment on column public.notices.content is '원문 전체 복제를 피한다. 가능하면 summary + url 만 사용한다.';

-- ---------------------------------------------------------
-- member_notices (N:M)
-- ---------------------------------------------------------
create table if not exists public.member_notices (
    member_id uuid not null references public.members(id) on delete cascade,
    notice_id uuid not null references public.notices(id) on delete cascade,
    primary key (member_id, notice_id)
);

-- ---------------------------------------------------------
-- updated_at 트리거
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_broadcasts_updated_at on public.broadcasts;
create trigger trg_broadcasts_updated_at
  before update on public.broadcasts
  for each row execute function public.set_updated_at();

-- 방송 종료 시 duration 자동 계산
create or replace function public.set_broadcast_duration()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null then
    new.duration_seconds = greatest(0, extract(epoch from (new.ended_at - new.started_at))::int);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_broadcasts_duration on public.broadcasts;
create trigger trg_broadcasts_duration
  before insert or update of started_at, ended_at on public.broadcasts
  for each row execute function public.set_broadcast_duration();


-- ##########  002_indexes.sql  ##########
-- =========================================================
-- HADES DATA — 002 indexes
-- 방송 데이터는 장기적으로 수백만 행까지 늘어날 수 있다.
-- =========================================================

-- broadcasts
create index if not exists idx_broadcasts_member        on public.broadcasts(member_id);
create index if not exists idx_broadcasts_started       on public.broadcasts(started_at desc);
create index if not exists idx_broadcasts_status        on public.broadcasts(status) where status = 'live';
create index if not exists idx_broadcasts_date          on public.broadcasts(broadcast_date desc);
create index if not exists idx_broadcasts_member_date   on public.broadcasts(member_id, broadcast_date desc);

-- viewer_snapshots
create index if not exists idx_viewer_snapshots_bc      on public.viewer_snapshots(broadcast_id, recorded_at);

-- catches
create index if not exists idx_catches_broadcast        on public.catches(broadcast_id);
create index if not exists idx_catches_member           on public.catches(member_id);
create index if not exists idx_catches_created          on public.catches(created_at desc);
create index if not exists idx_catches_views            on public.catches(views desc);
create index if not exists idx_catches_likes            on public.catches(likes desc);

-- click_events
create index if not exists idx_click_events_broadcast   on public.click_events(broadcast_id, clicked_at desc);
create index if not exists idx_click_events_member      on public.click_events(member_id, clicked_at desc);
create index if not exists idx_click_events_clicked     on public.click_events(clicked_at desc);
create index if not exists idx_click_events_target      on public.click_events(target_type, clicked_at desc);

-- notices
create index if not exists idx_notices_published        on public.notices(published_at desc);
create index if not exists idx_notices_source           on public.notices(source, published_at desc);

-- member_notices
create index if not exists idx_member_notices_notice    on public.member_notices(notice_id);


-- ##########  003_rls.sql  ##########
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


-- ##########  004_aggregates.sql  ##########
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


-- ##########  005_members.sql  ##########
-- =========================================================
-- HADES DATA — 005 하데스 멤버 등록
--
-- name / profile_image_url 은 수집기(/api/collect/sync)가
-- SOOP station API 에서 읽어와 자동으로 갱신한다.
-- 여기서는 확실한 값(채널 ID, 채널 URL, 프로필 이미지 규칙)만 넣는다.
--   프로필 이미지 규칙: //profile.img.sooplive.co.kr/LOGO/{앞 2글자}/{id}/{id}.jpg
-- =========================================================

insert into public.members (name, slug, channel_id, channel_url, profile_image_url, color, is_active)
values
  ('ldrboo',      'ldrboo',      'ldrboo',
   'https://www.sooplive.com/station/ldrboo',
   'https://profile.img.sooplive.co.kr/LOGO/ld/ldrboo/ldrboo.jpg',           '#6d8cff', true),

  ('chaenna02',   'chaenna02',   'chaenna02',
   'https://www.sooplive.com/station/chaenna02',
   'https://profile.img.sooplive.co.kr/LOGO/ch/chaenna02/chaenna02.jpg',     '#37d67a', true),

  ('kymakyma',    'kymakyma',    'kymakyma',
   'https://www.sooplive.com/station/kymakyma',
   'https://profile.img.sooplive.co.kr/LOGO/ky/kymakyma/kymakyma.jpg',       '#f0a92b', true),

  ('singgyul',    'singgyul',    'singgyul',
   'https://www.sooplive.com/station/singgyul',
   'https://profile.img.sooplive.co.kr/LOGO/si/singgyul/singgyul.jpg',       '#ff6ec7', true),

  ('whatcherry4', 'whatcherry4', 'whatcherry4',
   'https://www.sooplive.com/station/whatcherry4',
   'https://profile.img.sooplive.co.kr/LOGO/wh/whatcherry4/whatcherry4.jpg', '#4dd6e8', true)
on conflict (channel_id) do update
  set channel_url       = excluded.channel_url,
      profile_image_url = coalesce(public.members.profile_image_url, excluded.profile_image_url),
      is_active         = true;

-- 카페 공지 소스 메모 (수집기 설정용, 데이터가 아니라 문서 목적의 주석)
--   네이버 카페 clubid = 31091221 / menuid = 78 (공지 게시판)
--   목록 API 는 Referer 헤더가 필요하므로 서버 수집기에서만 호출한다.


-- ##########  006_monthly.sql  ##########
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


-- ##########  007_realtime.sql  ##########
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


-- ##########  008_search.sql  ##########
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


-- ##########  009_error_logs.sql  ##########
-- =========================================================
-- HADES DATA — 009 오류 로그
--
-- 외부 서비스(Sentry 등) 없이 자체 DB 에 오류를 남긴다.
-- 조회는 관리자(service role)만 가능하다. 공개 정책을 만들지 않는다.
-- =========================================================

create table if not exists public.error_logs (
    id          bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),

    -- 어디서 났는지: query / admin / collect / api / client
    source      text not null,
    -- 같은 오류를 묶기 위한 지문 (source + 메시지 해시)
    fingerprint text not null,

    message     text not null,
    detail      text,
    path        text,

    -- 같은 지문이 반복되면 행을 늘리지 않고 카운트만 올린다
    count       integer not null default 1,
    first_seen  timestamptz not null default now(),

    created_at  timestamptz not null default now()
);

create unique index if not exists uq_error_logs_fingerprint
  on public.error_logs(fingerprint);

create index if not exists idx_error_logs_occurred
  on public.error_logs(occurred_at desc);

alter table public.error_logs enable row level security;
-- 정책을 만들지 않는다 => anon/authenticated 는 읽기·쓰기 모두 불가.
-- service role 만 RLS 를 우회해서 접근한다.

comment on table public.error_logs is
  '자체 오류 로그. 개인정보를 담지 않는다 — 메시지/스택 요약/경로만 남긴다.';

-- ---------------------------------------------------------
-- 오류 기록 (있으면 카운트만 증가)
-- ---------------------------------------------------------
create or replace function public.record_error(
  p_source      text,
  p_fingerprint text,
  p_message     text,
  p_detail      text default null,
  p_path        text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  insert into public.error_logs (source, fingerprint, message, detail, path)
  values (p_source, p_fingerprint, left(p_message, 2000), left(p_detail, 4000), left(p_path, 500))
  on conflict (fingerprint) do update
    set count       = public.error_logs.count + 1,
        occurred_at = now(),
        message     = excluded.message,
        detail      = excluded.detail,
        path        = excluded.path
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.record_error(text, text, text, text, text)
  from anon, authenticated;

-- ---------------------------------------------------------
-- 오래된 로그 정리 (rollup 과 함께 하루 한 번 호출)
-- ---------------------------------------------------------
create or replace function public.prune_error_logs(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  delete from public.error_logs
  where occurred_at < now() - (greatest(1, p_days) || ' days')::interval;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke execute on function public.prune_error_logs(integer) from anon, authenticated;

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
