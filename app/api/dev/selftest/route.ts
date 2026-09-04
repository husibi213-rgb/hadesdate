import { NextResponse } from "next/server";

import { parseVodPayload } from "@/lib/soop/vods";
import { parseSoopDate, profileImageUrlFor, parseStationPayload } from "@/lib/soop/station";
import {
  matchBroadcastForPost,
  offsetFromBroadcastStart,
  shiftDateKey,
} from "@/lib/collect/match";
import { isCollectAuthorized } from "@/lib/collect/auth";
import { createSessionToken, safeEqual, verifySessionToken } from "@/lib/admin/token";
import { toDateTimeInput, fromDateTimeInput } from "@/lib/utils/datetime-input";
import { envValue, envValueOr } from "@/lib/env";
import {
  checked,
  integer,
  optionalInteger,
  required,
  stringList,
  text,
} from "@/lib/admin/form-data";
import { fingerprintOf } from "@/lib/monitor/log-error";
import { backfillExternalId, planBroadcastFromReplay } from "@/lib/collect/run-backfill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SOOP 파서 / 방송 매칭 회귀 테스트.
 *
 *   GET /api/dev/selftest      (헤더: x-collect-secret)
 *
 * SOOP 응답 모양이 바뀌어 파서를 손봤을 때 여기서 한 번 돌려보면 된다.
 * 네트워크를 타지 않고 고정 픽스처만 사용하므로 언제 호출해도 안전하다.
 * 실패가 있으면 500 과 함께 어떤 항목이 어긋났는지 돌려준다.
 */
export async function GET(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const checks: { name: string; pass: boolean; got: unknown; want: unknown }[] = [];
  const eq = (name: string, got: unknown, want: unknown) =>
    checks.push({ name, pass: JSON.stringify(got) === JSON.stringify(want), got, want });

  // ---------- 1. 게시물 파싱 ----------
  const payload = {
    data: [
      {
        title_no: 205974073,
        board_type: 105,
        title_name: "[하데스] 후여르르",
        reg_date: "2026-09-02 01:08:34",
        display: { bbs_name: "Replay" },
        count: { like_cnt: 28, read_cnt: 28742, comment_cnt: 8, vod_read_cnt: 1527 },
      },
      {
        title_no: 206100969,
        board_type: 105,
        title_name: "[클립]토요일 스케줄",
        reg_date: "2026-09-03 16:54:44",
        display: { bbs_name: "Star Balloon Clip" },
        read_cnt: 42,
        ucc_duration: 75050,
        thumbnail: "//iflv14.sooplive.com/clip/20260903/287/abc/42847287_r.jpg",
      },
      {
        title_no: 999,
        board_type: 777,
        title_name: "알 수 없는 게시판",
        reg_date: "2026-09-01 10:00:00",
        display: { bbs_name: "Something Else" },
      },
      {
        title_no: 206110791,
        board_type: 105,
        title_name: "[하데스] 우리 여르미",
        reg_date: "2026-09-03 18:59:38",
        display: { bbs_name: "다시보기" },
        count: { like_cnt: 30, read_cnt: 21342, vod_read_cnt: 1725 },
        ucc: { total_file_duration: 10716234 },
      },
      { no_title_no: true },
    ],
    catch_story: [
      {
        title_no: 3001,
        board_type: 109,
        title_name: "캐치 하나",
        reg_date: "2026-09-02 22:10:00",
        display: { bbs_name: "캐치" },
        count: { read_cnt: 500, vod_read_cnt: 12000, like_cnt: 340 },
      },
    ],
    meta: { current_page: 1, last_page: 43, total: 860 },
  };

  const page = parseVodPayload(payload);

  eq("게시물 5건만 파싱 (title_no 없는 항목 제외)", page.items.length, 5);
  eq("meta.total", page.total, 860);
  eq("meta.last_page", page.lastPage, 43);
  eq("Replay 분류", page.items[0].kind, "replay");
  eq("Star Balloon Clip 분류", page.items[1].kind, "clip");
  eq("미확인 게시판 분류", page.items[2].kind, "other");
  eq("catch_story 흡수 + 캐치 분류", page.items[4].kind, "catch");
  eq(
    "플레이어 URL",
    page.items[0].url,
    "https://vod.sooplive.co.kr/player/205974073"
  );
  eq("reg_date KST → ISO", page.items[0].registeredAt, "2026-09-01T16:08:34.000Z");
  eq("read_cnt", page.items[0].readCount, 28742);
  eq("vod_read_cnt", page.items[0].playCount, 1527);
  eq("like_cnt", page.items[0].likeCount, 28);
  eq("ms duration → 초", page.items[1].durationSeconds, 75);
  eq(
    "프로토콜 상대 URL 정규화",
    page.items[1].thumbnailUrl,
    "https://iflv14.sooplive.com/clip/20260903/287/abc/42847287_r.jpg"
  );
  eq("count 없을 때 read_cnt 폴백", page.items[1].readCount, 42);
  // 실제 응답에서 방송시간이 오는 자리는 ucc.total_file_duration (밀리초)
  eq("total_file_duration → 초", page.items[3].durationSeconds, 10716);
  eq("다시보기 분류(한글 게시판명)", page.items[3].kind, "replay");

  // ---------- 1-b. 지난 방송 백필 ----------
  const planned = planBroadcastFromReplay("M-1", page.items[3]);
  eq("백필 external_id 접두어", planned?.external_id, backfillExternalId("206110791"));
  eq("백필 종료 = 게시 시각", planned?.ended_at, "2026-09-03T09:59:38.000Z");
  // 종료(18:59:38 KST) − 2시간 58분 36초 = 16:01:02 KST
  eq("백필 시작 = 종료 − 방송시간", planned?.started_at, "2026-09-03T07:01:02.000Z");
  eq("백필 방송시간", planned?.duration_seconds, 10716);
  eq("백필 조회수 = max(재생, 조회)", planned?.views, 21342);

  const noDuration = planBroadcastFromReplay("M-1", { ...page.items[0], durationSeconds: null });
  eq("길이 모르면 시작 = 종료", noDuration?.started_at, noDuration?.ended_at);
  eq("길이 모르면 방송시간 null", noDuration?.duration_seconds, null);
  eq("등록 시각 없으면 건너뜀", planBroadcastFromReplay("M-1", { ...page.items[0], registeredAt: null }), null);

  // ---------- 2. 방송 매칭 ----------
  const broadcasts = [
    {
      id: "B-0902",
      started_at: "2026-09-02T10:05:00+09:00",
      ended_at: null,
      broadcast_date: "2026-09-02",
    },
    {
      id: "B-0901",
      started_at: "2026-09-01T19:05:00+09:00",
      ended_at: "2026-09-02T01:00:00+09:00",
      broadcast_date: "2026-09-01",
    },
  ];

  const replayMatch = matchBroadcastForPost(broadcasts, page.items[0].registeredAt);
  eq("종료 후 8분에 올라온 다시보기 → 그 방송에 매칭", replayMatch?.id, "B-0901");
  eq(
    "방송 시작 기준 경과 초",
    offsetFromBroadcastStart("2026-09-01T19:05:00+09:00", page.items[0].registeredAt),
    21814
  );

  // 구간에서 완전히 벗어나면 같은 날짜 방송으로 폴백
  const sameDay = matchBroadcastForPost(broadcasts, "2026-09-02T23:30:00+09:00");
  eq("같은 날짜 폴백", sameDay?.id, "B-0902");

  // 어느 방송에도 걸리지 않는 날짜
  const noMatch = matchBroadcastForPost(broadcasts, "2026-08-20T12:00:00+09:00");
  eq("매칭 없음", noMatch, null);

  eq("등록시각 없음 → null", matchBroadcastForPost(broadcasts, null), null);

  // ---------- 3. 날짜/방송국 유틸 ----------
  eq("날짜 이동", shiftDateKey("2026-03-01", -1), "2026-02-28");
  eq("윤년 아님 확인", shiftDateKey("2026-03-01", -2), "2026-02-27");
  eq("프로필 이미지 규칙", profileImageUrlFor("whatcherry4"), "https://profile.img.sooplive.co.kr/LOGO/wh/whatcherry4/whatcherry4.jpg");
  eq("잘못된 날짜 문자열", parseSoopDate("not-a-date"), null);

  const station = parseStationPayload("ldrboo", {
    station: { user_id: "ldrboo", user_nick: "테스트닉", broad_start: "2026-09-03 19:02:11" },
    profile_image: "//profile.img.sooplive.co.kr/LOGO/ld/ldrboo/ldrboo.jpg",
    broad: { broad_no: 296845575, broad_title: "[하데스] 방송", current_sum_viewer: 1222 },
    total_broad_time: 18830766,
    fan_cnt: 36486,
  });
  eq("station 닉네임", station.nickname, "테스트닉");
  eq("station LIVE broad_no", station.live?.broadNo, "296845575");
  eq("station LIVE 시청자", station.live?.viewers, 1222);
  eq("station 프로필 이미지", station.profileImageUrl, "https://profile.img.sooplive.co.kr/LOGO/ld/ldrboo/ldrboo.jpg");
  eq("station 팬 수", station.fanCount, 36486);

  const offline = parseStationPayload("x", { station: { user_nick: "n" }, broad: null });
  eq("방송 꺼짐 → live null", offline.live, null);

  // ---------- 4. 관리자 세션 토큰 ----------
  const now = 1_772_000_000_000; // 고정 시각
  const token = createSessionToken("s3cret", 3600, now);

  eq("정상 토큰 검증", verifySessionToken(token, "s3cret", now + 60_000), true);
  eq("만료된 토큰 거부", verifySessionToken(token, "s3cret", now + 3_601_000), false);
  eq("다른 키로 서명 검증 실패", verifySessionToken(token, "other", now), false);
  eq("서명 위조 거부", verifySessionToken(`${token.slice(0, -1)}0`, "s3cret", now), false);
  eq(
    "만료시각만 늘린 토큰 거부",
    verifySessionToken(
      [String(now + 999_999_999), token.split(".")[1], token.split(".")[2]].join("."),
      "s3cret",
      now
    ),
    false
  );
  eq("형식 불일치 거부", verifySessionToken("abc.def", "s3cret", now), false);
  eq("빈 토큰 거부", verifySessionToken(undefined, "s3cret", now), false);
  eq("토큰에 비밀번호가 들어가지 않음", token.includes("s3cret"), false);
  eq("safeEqual 동일", safeEqual("abc", "abc"), true);
  eq("safeEqual 길이 다름", safeEqual("abc", "abcd"), false);

  // ---------- 5. datetime-local 왕복 ----------
  const iso = "2026-09-03T10:02:00.000Z"; // KST 19:02
  eq("ISO → datetime-local (KST)", toDateTimeInput(iso), "2026-09-03T19:02");
  eq("datetime-local → ISO (KST 해석)", fromDateTimeInput("2026-09-03T19:02"), iso);
  eq("자정 처리", toDateTimeInput("2026-09-02T15:00:00.000Z"), "2026-09-03T00:00");
  eq("빈 값", fromDateTimeInput(""), null);
  eq("형식 오류", fromDateTimeInput("2026/09/03"), null);

  // ---------- 6. 환경변수 읽기 (빈 문자열 = 미설정) ----------
  process.env.__HADES_TEST_BLANK = "";
  process.env.__HADES_TEST_SPACES = "   ";
  process.env.__HADES_TEST_VALUE = "  ok  ";
  eq("빈 문자열은 미설정", envValue("__HADES_TEST_BLANK"), undefined);
  eq("공백만 있어도 미설정", envValue("__HADES_TEST_SPACES"), undefined);
  eq("값은 trim 해서 반환", envValue("__HADES_TEST_VALUE"), "ok");
  eq("없는 키", envValue("__HADES_TEST_MISSING"), undefined);
  eq("빈 문자열에서 폴백", envValueOr("__HADES_TEST_BLANK", "fallback"), "fallback");
  delete process.env.__HADES_TEST_BLANK;
  delete process.env.__HADES_TEST_SPACES;
  delete process.env.__HADES_TEST_VALUE;

  // ---------- 7. 관리자 폼 파싱 ----------
  const form = new FormData();
  form.set("name", "  김하데스  ");
  form.set("blank", "   ");
  form.set("views", "12,345");
  form.set("bad", "숫자아님");
  form.set("zero", "0");
  form.set("is_active", "on");
  form.append("member_ids", "m1");
  form.append("member_ids", "m2");

  eq("문자열은 trim", text(form, "name"), "김하데스");
  eq("공백만 있으면 null", text(form, "blank"), null);
  eq("없는 키는 null", text(form, "missing"), null);
  eq("콤마 포함 숫자", integer(form, "views"), 12345);
  eq("숫자가 아니면 기본값", integer(form, "bad", 7), 7);
  eq("0 은 0 으로", integer(form, "zero"), 0);
  eq("빈 값은 기본값", integer(form, "blank", 5), 5);
  eq("optionalInteger 없으면 null", optionalInteger(form, "missing"), null);
  eq("optionalInteger 값 있으면 숫자", optionalInteger(form, "zero"), 0);
  eq("체크박스 on", checked(form, "is_active"), true);
  eq("체크박스 없음", checked(form, "missing"), false);
  eq("다중 선택", stringList(form, "member_ids"), ["m1", "m2"]);
  eq("required 통과", required(form, "name", "이름"), "김하데스");

  let requiredThrew = false;
  try {
    required(form, "blank", "이름");
  } catch {
    requiredThrew = true;
  }
  eq("required 는 빈 값에서 예외", requiredThrew, true);

  // ---------- 8. 오류 지문 ----------
  // 같은 오류가 id/숫자 때문에 흩어지지 않아야 한다.
  eq(
    "uuid 가 달라도 같은 지문",
    fingerprintOf("query", "broadcast 3f2a1b4c-1111-2222-3333-444455556666 not found"),
    fingerprintOf("query", "broadcast 9c8d7e6f-aaaa-bbbb-cccc-ddddeeeeffff not found")
  );
  eq(
    "숫자가 달라도 같은 지문",
    fingerprintOf("api", "timeout after 3000ms"),
    fingerprintOf("api", "timeout after 12000ms")
  );
  eq(
    "메시지가 다르면 다른 지문",
    fingerprintOf("api", "timeout") === fingerprintOf("api", "connection refused"),
    false
  );
  eq(
    "source 가 다르면 다른 지문",
    fingerprintOf("api", "same message") === fingerprintOf("client", "same message"),
    false
  );
  eq("지문 길이 32", fingerprintOf("api", "x").length, 32);

  const failed = checks.filter((c) => !c.pass);
  return NextResponse.json(
    { total: checks.length, failed: failed.length, failures: failed },
    { status: failed.length ? 500 : 200 }
  );
}
