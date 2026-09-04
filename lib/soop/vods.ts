import "server-only";

import { parseSoopDate } from "@/lib/soop/station";
import { soopFetchJson } from "@/lib/soop/request";

/**
 * SOOP(숲) 방송국 게시물(다시보기 / 클립 / 캐치) 목록.
 *
 *   GET https://chapi.sooplive.co.kr/api/{channelId}/vods/catch?page=1&per_page=20
 *
 * 이 경로는 이름과 달리 방송국의 VOD 게시물을 board_type 별로 섞어서 돌려준다.
 * 실제로 확인된 display.bbs_name 값: "Replay"(다시보기), "Star Balloon Clip"(별풍선 클립).
 * 캐치가 별도 board_type 으로 오는지는 계정마다 다를 수 있어서,
 * 분류를 아래 표 한 곳으로 모아두고 board_type / bbs_name 어느 쪽이든 매칭되게 했다.
 *
 *   확인 방법: GET /api/collect/probe?bj={channelId}&kind=vods
 *   → 실제로 내려오는 board_type / bbs_name 조합과 건수를 그대로 보여준다.
 */

const VODS_ENDPOINT = "https://chapi.sooplive.co.kr/api";

export type SoopVodKind = "replay" | "clip" | "catch" | "other";

/** board_type → 종류. 확인되지 않은 값은 bbs_name 으로 한 번 더 판단한다. */
const BOARD_TYPE_KIND: Record<number, SoopVodKind> = {
  105: "replay",
};

/** bbs_name 에 이 조각이 들어 있으면 해당 종류로 본다 (소문자 비교). */
const BBS_NAME_RULES: { match: string; kind: SoopVodKind }[] = [
  { match: "catch", kind: "catch" },
  { match: "캐치", kind: "catch" },
  { match: "clip", kind: "clip" },
  { match: "클립", kind: "clip" },
  { match: "replay", kind: "replay" },
  { match: "다시보기", kind: "replay" },
];

export function classifyVod(boardType: number | null, bbsName: string | null): SoopVodKind {
  const name = (bbsName ?? "").toLowerCase();
  for (const rule of BBS_NAME_RULES) {
    if (name.includes(rule.match)) return rule.kind;
  }
  if (boardType !== null && boardType in BOARD_TYPE_KIND) return BOARD_TYPE_KIND[boardType];
  return "other";
}

export interface SoopVodItem {
  titleNo: string;
  boardType: number | null;
  bbsName: string | null;
  kind: SoopVodKind;
  title: string | null;
  /** 게시물(플레이어) URL */
  url: string;
  thumbnailUrl: string | null;
  /**
   * 초 단위 길이. 원본 `ucc_duration` 은 밀리초로 확인됐다 (클립 75050 → 75초).
   * DB 에 저장하지는 않고 probe 출력에만 쓰므로, 값이 이상하면 여기만 보면 된다.
   */
  durationSeconds: number | null;
  /** 게시물 조회수 */
  readCount: number;
  /** 실제 영상 재생 수 (없으면 0) */
  playCount: number;
  likeCount: number;
  registeredAt: string | null;
}

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: Json): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function str(value: Json): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http")) return value;
  return null;
}

/** 게시물 번호로 플레이어 URL 을 만든다. */
export function vodUrlFor(titleNo: string): string {
  return `https://vod.sooplive.co.kr/player/${titleNo}`;
}

export function parseVodItem(raw: Json): SoopVodItem | null {
  if (!isRecord(raw)) return null;

  const titleNo = str(raw.title_no);
  if (!titleNo) return null;

  const boardType = num(raw.board_type);
  const display = isRecord(raw.display) ? raw.display : null;
  const bbsName = display ? str(display.bbs_name) : null;
  const count = isRecord(raw.count) ? raw.count : null;
  const ucc = isRecord(raw.ucc) ? raw.ucc : null;

  const thumbnail =
    normalizeUrl(str(raw.thumbnail)) ??
    (ucc ? normalizeUrl(str(ucc.thumb) ?? str(ucc.thumbnail)) : null);

  const durationRaw = num(raw.ucc_duration) ?? (ucc ? num(ucc.duration) : null);

  return {
    titleNo,
    boardType,
    bbsName,
    kind: classifyVod(boardType, bbsName),
    title: str(raw.title_name),
    url: vodUrlFor(titleNo),
    thumbnailUrl: thumbnail,
    durationSeconds: durationRaw === null ? null : Math.round(durationRaw / 1000),
    readCount: (count ? num(count.read_cnt) : null) ?? num(raw.read_cnt) ?? 0,
    playCount: (count ? num(count.vod_read_cnt) : null) ?? 0,
    likeCount: (count ? num(count.like_cnt) : null) ?? 0,
    registeredAt: parseSoopDate(str(raw.reg_date)),
  };
}

export interface SoopVodPage {
  items: SoopVodItem[];
  page: number;
  lastPage: number;
  total: number;
}

/** 응답 본문 → 페이지. (네트워크와 분리해 두어 테스트 가능하게 한다) */
export function parseVodPayload(body: Json, fallbackPage = 1): SoopVodPage {
  const record = isRecord(body) ? body : {};
  const data = Array.isArray(record.data) ? record.data : [];
  const meta = isRecord(record.meta) ? record.meta : {};

  // catch_story 가 따로 내려오는 계정도 있어서 함께 흡수한다.
  const catchStory = Array.isArray(record.catch_story) ? record.catch_story : [];

  const items = [...data, ...catchStory]
    .map(parseVodItem)
    .filter((item): item is SoopVodItem => item !== null);

  return {
    items,
    page: num(meta.current_page) ?? fallbackPage,
    lastPage: num(meta.last_page) ?? fallbackPage,
    total: num(meta.total) ?? items.length,
  };
}

export async function fetchVodPage(
  channelId: string,
  page = 1,
  perPage = 20
): Promise<SoopVodPage> {
  const url =
    `${VODS_ENDPOINT}/${encodeURIComponent(channelId)}/vods/catch` +
    `?page=${page}&per_page=${perPage}&orderby=reg_date`;

  const payload = await soopFetchJson(
    url,
    `https://www.sooplive.com/station/${channelId}/vod`,
    `SOOP vods API (${channelId})`
  );

  return parseVodPayload(payload as Json, page);
}

/** 여러 페이지를 이어서 가져온다 (최대 maxPages). */
export async function fetchVodItems(
  channelId: string,
  maxPages = 2,
  perPage = 20
): Promise<{ items: SoopVodItem[]; total: number; lastPage: number }> {
  const collected: SoopVodItem[] = [];
  let lastPage = 1;
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const result = await fetchVodPage(channelId, page, perPage);
    collected.push(...result.items);
    lastPage = result.lastPage;
    total = result.total;
    if (page >= result.lastPage) break;
  }

  return { items: collected, total, lastPage };
}
