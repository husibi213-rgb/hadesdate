-- =========================================================
-- HADES DATA — 개발/미리보기용 더미 데이터
--
-- ⚠️ 이 파일은 members 를 포함해 전부 truncate 한 뒤 가짜 데이터를 넣는다.
--    005_members.sql 로 등록한 실제 하데스 멤버 5명도 함께 지워진다.
--    실제 수집을 할 DB 에서는 절대 실행하지 않는다.
--
-- 파일명이 seed.sql 이 아닌 이유: Supabase CLI 가 start/reset 때
-- supabase/seed.sql 을 자동 실행하기 때문이다. 실수로 날아가지 않게 이름을 바꿔 뒀다.
-- 필요할 때만 SQL Editor 에 직접 붙여넣어 실행한다.
-- =========================================================
begin;

truncate table public.member_notices, public.notices, public.click_events,
               public.catches, public.viewer_snapshots, public.broadcasts,
               public.daily_click_stats, public.members
        restart identity cascade;

-- ---------- members ----------
insert into public.members (name, slug, channel_id, channel_url, color) values
  ('김하데스', 'kimhades', 'kimhades', 'https://ch.sooplive.co.kr/kimhades', '#6d8cff'),
  ('이하데스', 'leehades', 'leehades', 'https://ch.sooplive.co.kr/leehades', '#37d67a'),
  ('박하데스', 'parkhades','parkhades','https://ch.sooplive.co.kr/parkhades','#f0a92b'),
  ('최하데스', 'choihades','choihades','https://ch.sooplive.co.kr/choihades','#ff6ec7'),
  ('정하데스', 'junghades','junghades','https://ch.sooplive.co.kr/junghades','#4dd6e8');

-- ---------- broadcasts (최근 60일) ----------
-- timezone('Asia/Seoul', <timestamp>) 은 "KST 로 해석해서 timestamptz 로" 변환한다.
-- (<timestamptz> at time zone 'Asia/Seoul' 은 반대 방향이므로 사용하지 않는다)
insert into public.broadcasts
  (member_id, title, started_at, ended_at, avg_viewers, peak_viewers, views, followers_gained, status, vod_url)
select
  m.id,
  concat(m.name, ' 방송 · ', to_char(d::date, 'MM/DD')),
  s.start_ts,
  s.start_ts + s.dur,
  (2000 + random() * 4000)::int,
  0, 0, (50 + random() * 400)::int,
  'ended',
  concat('https://vod.sooplive.co.kr/player/', floor(random()*9000000+1000000)::text)
from public.members m
cross join generate_series(
  (timezone('Asia/Seoul', now()))::date - 59,
  (timezone('Asia/Seoul', now()))::date - 1,
  interval '1 day'
) as d
cross join lateral (
  select timezone('Asia/Seoul', d::date + time '19:00' + (random() * interval '90 minutes')) as start_ts,
         (interval '3 hours' + random() * interval '5 hours') as dur
) s
where random() < 0.65;

update public.broadcasts
set peak_viewers = (avg_viewers * (1.3 + random() * 0.7))::int,
    views        = (avg_viewers * (6 + random() * 6))::int;

-- ---------- 오늘 LIVE 방송 2건 ----------
insert into public.broadcasts (member_id, title, started_at, avg_viewers, peak_viewers, views, followers_gained, status)
select m.id,
       concat(m.name, ' 실시간 방송'),
       now() - (interval '1 hour' + random() * interval '3 hours'),
       (3000 + random() * 3000)::int,
       (5000 + random() * 4000)::int,
       (10000 + random() * 20000)::int,
       (10 + random() * 200)::int,
       'live'
from public.members m
order by random()
limit 2;

-- ---------- viewer_snapshots (최근 14일 방송만, 10분 간격) ----------
insert into public.viewer_snapshots (broadcast_id, recorded_at, viewers)
select b.id,
       t,
       greatest(0, (b.avg_viewers
         * (0.7 + 0.6 * sin(extract(epoch from (t - b.started_at)) / 3600.0))
         + (random() - 0.5) * b.avg_viewers * 0.2)::int)
from public.broadcasts b
cross join lateral generate_series(
  b.started_at,
  coalesce(b.ended_at, now()),
  interval '10 minutes'
) as t
where b.broadcast_date >= (timezone('Asia/Seoul', now()))::date - 14;

update public.broadcasts b
set peak_viewers = s.mx,
    avg_viewers  = s.av
from (
  select broadcast_id, max(viewers) mx, round(avg(viewers))::int av
  from public.viewer_snapshots group by broadcast_id
) s
where s.broadcast_id = b.id;

-- ---------- catches ----------
insert into public.catches
  (broadcast_id, member_id, title, catch_url, broadcast_timestamp, views, likes, published_at)
select b.id, b.member_id,
       (array['이건 진짜 레전드네','오늘의 하이라이트','폭소 구간','역대급 리액션','클러치 순간'])[1 + floor(random()*5)::int],
       concat('https://vod.sooplive.co.kr/catch/', floor(random()*9000000+1000000)::text),
       (random() * coalesce(b.duration_seconds, 7200))::int,
       (500 + random() * 20000)::int,
       (20 + random() * 1500)::int,
       b.started_at + (random() * interval '4 hours')
from public.broadcasts b
cross join generate_series(1, 3)
where b.broadcast_date >= (timezone('Asia/Seoul', now()))::date - 21
  and random() < 0.7;

-- ---------- click_events (최근 14일) ----------
insert into public.click_events (broadcast_id, member_id, target_type, target_id, session_hash, clicked_at)
select b.id, b.member_id,
       (array['broadcast','profile','vod','catch','external'])[1 + floor(random()*5)::int],
       b.id::text,
       md5(random()::text || floor(random()*500)::text),
       b.started_at + (random() * (coalesce(b.ended_at, now()) - b.started_at))
from public.broadcasts b
cross join generate_series(1, 60)
where b.broadcast_date >= (timezone('Asia/Seoul', now()))::date - 14;

-- ---------- notices ----------
insert into public.notices (source, external_id, title, summary, url, published_at)
select (array['cafe','broadcast_station','other'])[1 + floor(random()*3)::int],
       'seed-' || g::text,
       (array['9월 방송 일정 안내','하데스 이벤트 안내','합방 일정 변경 안내','정기 점검 공지','신규 콘텐츠 안내'])[1 + floor(random()*5)::int],
       '자세한 내용은 원문 링크를 확인해 주세요.',
       'https://cafe.naver.com/hades/' || (1000 + g)::text,
       now() - (g * interval '1 day') - (random() * interval '12 hours')
from generate_series(1, 20) g;

insert into public.member_notices (member_id, notice_id)
select m.id, n.id
from public.notices n
cross join lateral (select id from public.members order by random() limit 1) m
where random() < 0.6
on conflict do nothing;

-- ---------- 클릭 집계 rollup (최근 14일) ----------
select public.rollup_click_stats(d::date)
from generate_series(
  (timezone('Asia/Seoul', now()))::date - 14,
  (timezone('Asia/Seoul', now()))::date,
  interval '1 day'
) d;

commit;
