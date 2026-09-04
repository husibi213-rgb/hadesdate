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
