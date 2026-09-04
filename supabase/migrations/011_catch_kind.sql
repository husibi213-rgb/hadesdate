-- =========================================================
-- HADES DATA — 011 캐치 / 유저클립 구분
--
-- SOOP 방송국 게시물에는 '캐치'(짧은 세로 영상)와
-- '별풍선 클립'(시청자가 만든 클립)이 섞여 내려온다.
-- 지금까지는 둘 다 catches 테이블에 그대로 담아 한 화면에서 보여줬는데,
-- 성격이 달라서 화면을 나누기로 했다. 그래서 종류를 컬럼으로 남긴다.
--
-- 실제로 지금까지 수집된 항목은 전부 '별풍선 클립'이라 기본값을 clip 으로 둔다.
-- =========================================================

alter table public.catches
  add column if not exists kind text not null default 'clip';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catches_kind_check'
  ) then
    alter table public.catches
      add constraint catches_kind_check check (kind in ('clip', 'catch'));
  end if;
end $$;

comment on column public.catches.kind is 'clip = 유저클립(별풍선 클립), catch = SOOP 캐치';

-- 제목 앞에 붙여 두던 표기로 기존 행을 되살린다.
update public.catches
   set kind = 'catch'
 where kind <> 'catch'
   and title like '[캐치]%';

update public.catches
   set kind = 'clip'
 where kind <> 'clip'
   and title like '[클립]%';

-- 목록은 항상 "종류 + 날짜 + 조회수" 로 뽑으므로 그 순서로 인덱스를 둔다.
create index if not exists idx_catches_kind_date_views
  on public.catches(kind, catch_date desc, views desc);
