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
