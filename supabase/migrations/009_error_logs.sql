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
