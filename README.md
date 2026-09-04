# HADES DATA

SOOP(숲) 하데스 멤버 방송 데이터 아카이브.
**멤버 → 날짜 → 방송 → 시청자 그래프 → 캐치 → 클릭 → 관련 공지** 흐름을 하나의 데이터 구조로 연결한다.

- Next.js 16 (App Router, 서버 컴포넌트 기본) / TypeScript strict
- Supabase (PostgreSQL + RLS)
- Tailwind CSS v4 / Recharts / Lucide

---

## 1. 실행 방법

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # http://localhost:3000
```

`.env.local`

| 키 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 배포 도메인 (sitemap·robots·og 메타용). 비우면 Vercel 값 → localhost 폴백 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 공개 키 (브라우저 노출 OK) |
| `SUPABASE_SERVICE_ROLE_KEY` | **서버 전용.** 수집기/관리자 API 에서만 사용 |
| `CLICK_HASH_SALT` | 클릭 익명 해시용 임의 문자열 |
| `COLLECT_SECRET` | 수집 API 보호용. 배포 환경에서는 **반드시** 설정 |
| `ADMIN_PASSWORD` | `/admin` 로그인 비밀번호. 비우면 관리자 페이지가 잠깁니다 |
| `ADMIN_SESSION_SECRET` | (선택) 세션 서명 키. 비우면 `ADMIN_PASSWORD` 사용 |

> 환경변수는 전부 `lib/env.ts` 의 `envValue()` 를 거쳐 읽습니다.
> `.env.example` 을 그대로 복사하면 값이 **빈 문자열**로 들어오는데,
> `process.env.X ?? 기본값` 은 빈 문자열에서 폴백하지 않아 조용히 깨집니다.

환경변수가 비어 있어도 앱은 정상 실행되며, 각 페이지에 연결 안내가 표시된다.

## 1-1. 로컬 Supabase 로 띄우기

Docker Desktop 이 실행 중이어야 한다.

```bash
cd ~/Projects/hades-data
supabase init      # supabase/config.toml 이 없을 때만. migrations 폴더는 건드리지 않는다
supabase start     # 처음엔 이미지 받느라 몇 분 걸린다
```

`supabase start` 가 끝나면 출력에 아래가 찍힌다. 이 값을 `.env.local` 에 옮긴다.

```
API URL:        http://127.0.0.1:54321   → NEXT_PUBLIC_SUPABASE_URL
anon key:       eyJ...                   → NEXT_PUBLIC_SUPABASE_ANON_KEY
service_role:   eyJ...                   → SUPABASE_SERVICE_ROLE_KEY
Studio URL:     http://127.0.0.1:54323   ← SQL Editor 가 여기 있다
DB URL:         postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

나머지 값도 채운다.

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CLICK_HASH_SALT=아무_랜덤_문자열
COLLECT_SECRET=아무_랜덤_문자열
ADMIN_PASSWORD=원하는_비밀번호
```

그 다음 Studio(`http://127.0.0.1:54323`) → SQL Editor 에서
`supabase/all_migrations.sql` 내용을 붙여넣고 실행한다.
`supabase start` 가 이미 `migrations/` 를 적용했더라도 다시 실행해도 안전하다.

```bash
npm install
npm run dev            # http://localhost:3000
```

멤버 5명이 보이면 연결된 것이다. 이어서 수집을 한 번 돌린다.

```bash
COLLECT_SECRET=... node scripts/collect.mjs        # 방송 상태 + 닉네임/프로필 채우기
COLLECT_SECRET=... node scripts/collect.mjs vods   # 다시보기·클립·캐치
```

또는 `/admin` 에서 버튼으로 실행한다.

## 2. DB 준비

Supabase SQL Editor 에서 **번호 순서대로** 실행한다.

```
supabase/migrations/001_initial.sql     테이블 + 트리거
supabase/migrations/002_indexes.sql     인덱스
supabase/migrations/003_rls.sql         RLS 정책
supabase/migrations/004_aggregates.sql  집계 테이블 + 서버 집계 함수(RPC)
supabase/migrations/005_members.sql     하데스 멤버 5명 등록
supabase/migrations/006_monthly.sql     캐치 날짜축 + 일간/월간 종합 함수
supabase/migrations/007_realtime.sql    broadcasts Realtime 발행 (LIVE 실시간 갱신)
supabase/migrations/008_search.sql      pg_trgm 검색 인덱스 + 통합 검색 함수
supabase/migrations/009_error_logs.sql  자체 오류 로그 테이블 + 기록/정리 함수
supabase/all_migrations.sql             ↑ 001~009 합본 (한 번에 붙여넣기용)
supabase/seed.dev.sql                   (선택) 개발용 더미 데이터
```

SQL Editor 를 쓴다면 **`all_migrations.sql` 하나만** 붙여넣으면 된다. 여러 번 실행해도 안전하다.

> `seed.dev.sql` 은 `members` 까지 `truncate` 한다. 005 로 등록한 실제 멤버 5명도 지워지므로
> **실제 수집을 할 DB 에서는 실행하지 않는다.** 파일명을 `seed.sql` 로 두지 않은 것은
> Supabase CLI 가 `start`/`db reset` 때 `supabase/seed.sql` 을 자동 실행하기 때문이다.

### 데이터 관계

```
members
  └── broadcasts (= 방송 세션, 모든 데이터의 중심)
        ├── viewer_snapshots
        ├── catches
        └── click_events
notices ── member_notices ── members
```

- 날짜 기준축은 `broadcasts.broadcast_date` — **방송 시작 시각(KST) 기준 날짜**의 generated column.
  자정을 넘긴 방송도 시작일에 귀속되므로 `19:02 ~ 01:14` 방송은 시작일 하루로 집계된다.
- 캐치도 같은 규칙의 `catches.catch_date` 를 가진다. 날짜별 나열은
  `(catch_date desc, views desc)` 인덱스로 처리하므로 "날짜별로 묶고 조회수 순"이 정렬 비용 없이 나온다.
- 월 단위 종합은 `month_summary` / `daily_totals` / `monthly_totals` 세 함수로 끝난다.
  하루씩 30번 호출하지 않는다.
- 집계는 전부 DB 에서 수행한다 (`member_stats`, `member_daily_series`, `daily_summary`,
  `member_comparison`, `click_breakdown`, `click_hourly`, `viewer_series_for_date`,
  `daily_totals`, `monthly_totals`, `month_summary`).
  원시 행을 클라이언트로 내리지 않는다.

### 개인정보

- `click_events` 에는 닉네임 / IP / 계정 정보를 저장하지 않는다. 익명 `session_hash` 만 사용한다.
- `click_events` 는 RLS 로 **직접 조회가 막혀 있고**, 집계 RPC 로만 노출된다.
- 캐치·공지는 원문을 복제하지 않고 메타데이터 + 원문 링크만 저장/표시한다.

## 3. 라우트

| 경로 | 설명 |
| --- | --- |
| `/` | 오늘 요약 / LIVE NOW / 오늘 시청자 그래프 / 최근 방송·캐치·공지 |
| `/members` | 멤버 목록 (기간별 요약) |
| `/members/[memberId]` | 멤버 통계 · 추이 그래프 · 방송 캘린더 · 최근 방송 (uuid 또는 slug) |
| `/broadcasts` | 전체 방송 목록 (멤버 필터 + 페이지네이션) |
| `/broadcasts/[broadcastId]` | 방송 상세 — 시청자 그래프 / 캐치 / 클릭 / 관련 공지 |
| `/calendar` | 월 캘린더 (전체 멤버) |
| `/calendar/[year]/[month]` | **HADES MONTHLY** — 월 종합 (일별 추이 · 월별 추이 · 멤버 비교 · 인기 캐치) |
| `/calendar/[year]/[month]/[day]` | **HADES DAILY** — 그날의 전체 아카이브 |
| `/analytics` | 멤버 비교 테이블 + 랭킹 6종 |
| `/catches` | 캐치 — **날짜별 / 멤버별 / 전체** 3가지 보기. 묶어보기는 각 그룹 안에서 조회수 순 |
| `/clicks` | 익명 클릭 분석 (타겟별/시간대별/멤버별) |
| `/notices` | 공지 (source 필터) |
| `/search?q=` | 통합 검색 — 멤버·방송·캐치·공지 제목 |
| `POST /api/clicks` | 익명 클릭 수집 (service role, 서버에서만 기록) |
| `POST /api/collect/sync` | SOOP 방송 상태 동기화 (헤더 `x-collect-secret`) |
| `POST /api/collect/vods` | 다시보기/클립/캐치 수집 (`?pages=3`) |
| `POST /api/collect/rollup` | 클릭 일일 집계 (`?date=2026-09-01`, 기본 어제·오늘) |
| `GET /api/collect/probe?bj=ldrboo` | station API 응답 확인 (`&raw=1` 로 원본 JSON) |
| `GET /api/collect/probe?bj=ldrboo&kind=vods` | 게시물 `board_type` / `bbs_name` 분포 확인 |
| `GET /api/dev/selftest` | 회귀 테스트 69건 (픽스처만 사용, 네트워크 없음) |
| `/admin` | 관리자 개요 — 데이터 현황, 수집 수동 실행, 수집기 생존 확인 |
| `/admin/members` | 멤버 CRUD (활성/비활성, 채널 ID, 색상) |
| `/admin/broadcasts` | 방송 CRUD (멤버·기간 필터, 시각은 KST 입력) |
| `/admin/catches` | 캐치 CRUD (방송 연결 포함) |
| `/admin/notices` | 공지 CRUD + 관련 멤버 연결 |
| `/admin/errors` | 오류 로그 — 지문별로 묶어서 발생 횟수·위치·스택 요약 |

## 3-1. 데이터 수집

```bash
# 방송 상태 — 1~3분 간격 (이 간격이 곧 시청자 스냅샷 간격)
COLLECT_SECRET=... node scripts/collect.mjs

# 다시보기/클립/캐치 — 30분~1시간 간격
COLLECT_SECRET=... node scripts/collect.mjs vods

# 클릭 일일 집계 — 하루 1회 (새벽 권장)
COLLECT_SECRET=... node scripts/collect.mjs rollup

# 배포본을 대상으로
COLLECT_BASE_URL=https://<도메인> COLLECT_SECRET=... node scripts/collect.mjs
```

**`sync`** — 활성 멤버마다 `chapi.sooplive.co.kr/api/{channel_id}/station` 을 호출해서

1. 닉네임·프로필 이미지를 최신으로 맞추고 (최초 등록 시 `name` 이 channel_id → 닉네임으로 교체됨)
2. 방송 중이면 `broad_no` 를 `external_id` 로 하는 방송 세션을 만들거나 이어가며 시청자 스냅샷을 남기고
3. 방송이 꺼졌으면 열려 있던 세션을 닫고 스냅샷에서 평균/최고 시청자를 확정한다.

**`vods`** — 방송국 게시물 목록(`/vods/catch`)을 읽어서

- 클립/캐치 게시물 → `catches` 에 upsert (`external_id` = `title_no`). 조회수·좋아요는 매번 갱신한다.
- 다시보기 게시물 → 등록 시각이 걸치는 방송에 `vod_url` / `views` 를 채운다.
- 게시물은 방송 종료 직후 올라오는 경우가 많아 방송 구간 뒤로 6시간 여유를 두고 매칭한다.

두 API 모두 공식 문서가 없어 필드 위치와 `board_type` 분류가 바뀔 수 있다. 그래서

- `lib/soop/station.ts` 는 경로를 하드코딩하지 않고 알려진 키를 재귀 탐색한다.
- `lib/soop/vods.ts` 상단의 분류 표 한 곳에서 `board_type` / `bbs_name` → 종류를 결정한다.

어긋나면 `/api/collect/probe?bj=...&kind=vods` 로 실제 분포를 확인하고 그 표만 고치면 된다.
`vods` 응답의 `unclassified` 에 미분류 조합이 그대로 나온다.

## 3-1-1. 유저 클릭 수집

SOOP 에서 가져오는 데이터가 아니라 **이 사이트 방문자의 클릭**이다.
`components/analytics/tracked-link.tsx` 가 링크 클릭 시 `sendBeacon` 으로 기록한다.
페이지 이동을 막지 않고, 실패해도 이동에는 영향이 없다.

| 위치 | target_type |
| --- | --- |
| 캐치 카드 썸네일 → 원본 | `catch` |
| 방송 카드 / 방송 목록 항목 | `broadcast` |
| 멤버 카드 / 멤버 이름 링크 | `profile` |
| 방송 상세의 VOD 보기 | `vod` |
| 공지 카드 → 원문 | `notice` |

저장되는 것은 대상 종류·대상 id·익명 세션 해시뿐이다.
세션 해시는 브라우저 탭 단위 무작위 값(`sessionStorage`)을 날짜·서버 솔트와 함께 단방향 해시한 값이라
역추적이 불가능하고, 탭을 닫으면 사라진다. 스토리지가 막힌 브라우저에서는 세션 구분 없이 집계된다.

원시 이벤트가 쌓이면 `rollup` 으로 `daily_click_stats` 에 집계해 두고 그것만 조회하면 된다.

## 3-1-2. LIVE 실시간 갱신

`007_realtime.sql` 을 적용하면 `broadcasts` 변경이 Realtime 으로 발행된다.
`components/layout/live-refresher.tsx` 가 이를 구독해 화면을 다시 그린다.

- 갱신은 5초에 한 번으로 묶어 화면이 계속 깜빡이지 않게 한다.
- Realtime 이 꺼져 있거나 연결이 실패하면 60초 폴링으로 조용히 대체한다.
  수집기가 1~3분 간격으로 돌기 때문에 폴링만으로도 충분히 따라간다.

## 3-1-3. 검색

`/search?q=` 하나로 멤버·방송·캐치·공지 제목을 함께 찾는다. 상단 검색창은 모든 페이지에 있다.

한국어는 PostgreSQL 기본 전문검색 사전이 없어 `to_tsvector` 가 제대로 동작하지 않는다.
그래서 **pg_trgm(3-gram) 인덱스 + ILIKE 부분일치**로 구현했다. 트라이그램 GIN 인덱스가 있으면
`'%검색어%'` 도 순차 스캔 없이 처리된다.

- 종류별로 상한(기본 8건)을 두고 **DB 에서 잘라서** 가져온다.
- 사용자가 넣은 `%` `_` `\` 는 이스케이프해서 와일드카드로 동작하지 않는다.
- 빈 검색어는 전체를 쏟아내지 않고 0건을 돌려준다.

## 3-2. 관리자 페이지

`ADMIN_PASSWORD` 를 설정하면 `/admin` 이 열린다. 별도 사용자 테이블 없이 비밀번호 하나로 들어간다.

- 쿠키에는 비밀번호가 아니라 `만료시각.난수.HMAC` 토큰만 저장한다 (12시간 만료, httpOnly).
- 인증은 **세 곳에서 각각** 확인한다: 레이아웃 / 각 페이지 첫 줄 / 모든 server action(`assertAdmin`).
  화면 가드만 믿지 않으므로, 위조 쿠키로 페이지를 열어도 데이터 조회 자체가 일어나지 않는다.
- 쓰기는 전부 server action → service role 로 수행한다. 브라우저에서 DB 를 직접 쓰지 않는다.
- 편집 UI 는 `details/summary` 기반이라 클라이언트 상태가 없다.
- 개요 화면에서 수집 3종(방송 상태 / 게시물 / 클릭 집계)을 수동으로 돌릴 수 있다.

## 3-3. 오류 모니터링

외부 서비스 없이 `error_logs` 테이블에 직접 남긴다. `/admin/errors` 에서 본다.

- **같은 오류는 한 행으로 묶인다.** 메시지에서 uuid·숫자를 지운 지문으로 묶으므로
  `broadcast <uuid> not found` 가 수백 번 나도 한 행에 카운트만 올라간다.
- 기록되는 곳: 공개 페이지 조회(`guard`) / 관리자 조회(`loadAdmin`) / 수집 3종 /
  API 라우트 / 브라우저 에러 바운더리.
- 로깅은 **절대 예외를 던지지 않고**, DB 쓰기가 실패하면 5분간 재시도하지 않는다.
  DB 장애로 난 오류를 DB 에 쓰려다 다시 실패하는 고리를 끊기 위해서다.
- 같은 지문은 60초 안에 중복 기록하지 않는다.
- 30일이 지난 로그는 `rollup` 이 돌 때 함께 정리된다.
- `error_logs` 는 RLS 정책을 하나도 만들지 않았다 → 공개 조회·쓰기 모두 불가, service role 전용.
- 개인정보를 담지 않는다. 메시지·스택 앞부분·경로만 남기고 길이도 잘라서 저장한다.

## 3-4. 배포 준비

- `app/robots.ts` — `/admin`, `/api` 는 색인 제외
- `app/sitemap.ts` — 정적 페이지 + 멤버 + 최근 3개월 월 종합 + 최근 90일 날짜 페이지.
  방송이 매우 많아질 수 있어 개별 방송 URL 은 넣지 않는다.
- 루트 레이아웃에 `metadataBase` / OpenGraph / Twitter 메타 설정

## 3-5. 배포 (GitHub + Vercel)

### 1) GitHub 에 올리기

```bash
cd ~/Projects/hades-data
git init
git add .
git commit -m "HADES DATA 초기 커밋"
git branch -M main
git remote add origin https://github.com/<계정>/hades-data.git
git push -u origin main
```

`.gitignore` 가 `.env*` 를 막고 있으므로 키는 올라가지 않는다. (`.env.example` 만 올라간다)

### 2) Vercel 연결

1. vercel.com → Add New → Project → 방금 만든 저장소 선택
2. Framework 는 Next.js 로 자동 인식된다. 빌드 설정은 건드리지 않는다.
3. **Environment Variables** 에 아래를 넣는다 (Production/Preview 모두)

   | 키 | 값 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable 키 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret 키 |
   | `CLICK_HASH_SALT` | 임의 문자열 |
   | `COLLECT_SECRET` | 임의 문자열 (GitHub Actions 와 같은 값) |
   | `ADMIN_PASSWORD` | 관리자 비밀번호 |
   | `ADMIN_SESSION_SECRET` | 임의 문자열 |
   | `NEXT_PUBLIC_SITE_URL` | 배포 후 받은 도메인 (예: `https://hades-data.vercel.app`) |

4. Deploy. 배포가 끝나면 `NEXT_PUBLIC_SITE_URL` 을 실제 도메인으로 고치고 한 번 더 배포한다.

이후 `git push` 할 때마다 자동 배포된다.

### 3) 수집 자동화 (GitHub Actions)

`.github/workflows/collect.yml` 이 이미 들어 있다. 저장소 Settings 에 두 개만 넣으면 된다.

- **Variables** → `COLLECT_BASE_URL` = 배포 도메인 (예: `https://hades-data.vercel.app`)
- **Secrets** → `COLLECT_SECRET` = Vercel 에 넣은 값과 **동일하게**

스케줄:

| 주기 | 하는 일 |
| --- | --- |
| 5분 | 방송 상태 + 시청자 스냅샷 |
| 30분 | 다시보기 / 클립 / 캐치 |
| 매일 04:00 (KST) | 클릭 집계 + 오래된 오류 로그 정리 |

Actions 탭 → collect → **Run workflow** 로 수동 실행도 된다 (모드 선택 가능).

> GitHub 의 cron 은 최소 5분이고 혼잡하면 몇 분 밀린다. 시청자 그래프를 더 촘촘하게
> 남기고 싶으면 PC 작업 스케줄러로 `node scripts/collect.mjs` 를 1분마다 함께 돌리면 된다.
> (`COLLECT_BASE_URL` 을 배포 도메인으로 지정)

## 4. 폴더 구조

```
app/
  (dashboard)/           Sidebar + Topbar 레이아웃이 적용되는 공개 페이지
  api/clicks/            클릭 수집 엔드포인트
components/
  ui/                    Card, Badge, StatCard, Table, FilterTabs, Pagination ...
  layout/                Sidebar, Topbar, MobileNav, PageHeader
  charts/                Recharts 래퍼 (클라이언트 컴포넌트)
  members|broadcasts|catches|notices|analytics/
lib/
  supabase/{client,server,admin}.ts
  queries/               공개 페이지용 데이터 접근 계층 (중복 쿼리 금지)
  soop/                  SOOP API 클라이언트 (station / vods)
  collect/               수집 로직 (run-sync, run-vods, match)
  admin/                 세션·폼 파싱·관리자 쿼리·server action
  monitor/               오류 로그 기록
  utils/{cn,format,dates,period,datetime-input}.ts
types/database.ts        스키마 타입 (migrations 와 1:1)
supabase/migrations/     번호 순서대로 실행
```

## 5. 개발 원칙

- 서버 컴포넌트 기본. 클라이언트 컴포넌트는 차트/실시간 경과시간 등 인터랙션에만 사용한다.
- 필터·정렬·페이지는 **URL 쿼리스트링**에 둔다 → 서버에서 그대로 필터링, 클라이언트 fetch 없음.
- 모든 쿼리는 `lib/queries/*` 를 통해서만 호출한다. 페이지에서 직접 Supabase 를 부르지 않는다.
- 모든 목록에 loading / error / empty 상태를 구현한다.
- `any` 금지. supabase-js 생성 타입과의 경계 캐스팅은 `lib/queries/result.ts:callRpc`,
  `lib/supabase/admin.ts:insertRows` 두 곳으로만 격리한다.

## 6. 하데스 멤버 / 수집 가능 범위

| slug | 채널 | 상태 |
| --- | --- | --- |
| `ldrboo` | https://www.sooplive.com/station/ldrboo | station API 확인됨 |
| `chaenna02` | https://www.sooplive.com/station/chaenna02 | station API 확인됨 |
| `kymakyma` | https://www.sooplive.com/station/kymakyma | station API 확인됨 |
| `singgyul` | https://www.sooplive.com/station/singgyul | station API 502 (재시도 필요) |
| `whatcherry4` | https://www.sooplive.com/station/whatcherry4 | station API 확인됨 |

수집 가능 여부:

| 항목 | 경로 | 상태 |
| --- | --- | --- |
| LIVE 여부 / 방송 제목 / 현재 시청자 / broad_no | `chapi.sooplive.co.kr/api/{id}/station` | **가능** — 구현 완료 |
| 닉네임 / 프로필 이미지 / 누적 방송시간 / 팬 수 | 같은 응답 | **가능** — 구현 완료 |
| 평균·최고 시청자 | 스냅샷에서 계산 | **가능** — 수집 주기에 비례해 정확 |
| 다시보기 VOD 링크 / 조회수 | `chapi.sooplive.co.kr/api/{id}/vods/catch` | **가능** — 구현 완료 |
| 유저 클립 / 캐치 | 같은 게시물 목록 | **가능** — 구현 완료 (분류 표 확인 필요) |
| 카페 공지 | — | **제외** (수집하지 않음) |
| 방송국 공지 | 미확인 | 보류 — 엔드포인트 미확인 |
| 유저 클릭 | 자체 수집 (`/api/clicks`) | 가능 — 이 사이트 안에서 발생한 클릭만 |

> 유저 클릭은 SOOP 에서 가져오는 데이터가 아니라 **이 사이트 방문자의 클릭**이다.
> 익명 세션 해시 기반 집계만 저장한다.

> 확인된 `bbs_name` 은 `Replay`(다시보기), `Star Balloon Clip`(별풍선 클립)이다.
> 캐치가 별도 `board_type` 으로 오는 계정이 있을 수 있으니
> 첫 수집 후 `unclassified` 가 비어 있는지 한 번 확인하는 것을 권한다.

## 7. 남은 작업

- 첫 `vods` 수집 후 `unclassified` 확인해서 캐치 `board_type` 분류 확정 (실데이터 필요)
- 실제 Supabase 연결 후 관리자 CRUD 저장 확인
- 공지는 `/admin/notices` 에서 수동 입력 (카페 공지 자동 수집은 범위에서 제외)

### 스케줄러 예시 (Windows 작업 스케줄러)

```
1~3분 간격   node scripts/collect.mjs
30분 간격    node scripts/collect.mjs vods
매일 04:00   node scripts/collect.mjs rollup
```

```bash
npm run lint
npm run build
```
