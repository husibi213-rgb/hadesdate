import "server-only";

/**
 * SOOP(숲) 공개 station API 클라이언트.
 *
 *   GET https://chapi.sooplive.co.kr/api/{channelId}/station
 *
 * 응답에는 방송국 정보와 "현재 방송(broad)" 정보가 함께 들어 있다.
 * broad 가 null 이면 방송이 꺼져 있는 상태다.
 *
 * 주의: 이 API 는 공식 문서가 없어서 필드 위치가 바뀔 수 있다.
 * 그래서 경로를 하드코딩하지 않고, 알려진 키를 재귀적으로 찾는 방식으로 파싱한다.
 * 실제 응답 원본은 GET /api/collect/probe?bj={channelId} 로 언제든 확인할 수 있다.
 */

const STATION_ENDPOINT = "https://chapi.sooplive.co.kr/api";

export interface SoopStationSnapshot {
  channelId: string;
  /** 방송국 표시 이름 (닉네임) */
  nickname: string | null;
  profileImageUrl: string | null;
  /** 누적 방송시간(초) — 참고용 */
  totalBroadSeconds: number | null;
  totalViewCount: number | null;
  fanCount: number | null;
  /** 현재 방송 중이면 채워진다 */
  live: {
    broadNo: string;
    title: string | null;
    viewers: number;
    startedAt: string | null;
  } | null;
  /** 파싱 원본 (probe 용) */
  raw: unknown;
}

type Json = unknown;

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 객체 트리에서 키 이름으로 첫 번째 값을 찾는다 (깊이 제한 있음). */
function findByKey(root: Json, keys: string[], depth = 6): Json {
  if (depth < 0 || !isRecord(root)) return undefined;
  for (const key of keys) {
    if (key in root && root[key] !== null && root[key] !== undefined) return root[key];
  }
  for (const value of Object.values(root)) {
    const found = findByKey(value, keys, depth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
}

function asString(value: Json): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function asNumber(value: Json): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** "//profile.img..." 형태의 프로토콜 상대 URL 을 https 로 정규화한다. */
function normalizeUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("http")) return value;
  return null;
}

/** SOOP 이 내려주는 "2026-09-03 19:02:11" (KST) 을 ISO 로 변환한다. */
export function parseSoopDate(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`).toISOString();
}

/** 채널 ID 로부터 프로필 이미지 URL 을 규칙대로 만든다. */
export function profileImageUrlFor(channelId: string): string {
  const prefix = channelId.slice(0, 2);
  return `https://profile.img.sooplive.co.kr/LOGO/${prefix}/${channelId}/${channelId}.jpg`;
}

export function parseStationPayload(channelId: string, raw: Json): SoopStationSnapshot {
  const station = isRecord(raw) && isRecord(raw.station) ? raw.station : raw;
  const broadCandidate = findByKey(raw, ["broad"]);
  const broad = isRecord(broadCandidate) ? broadCandidate : null;

  const broadNo = broad ? asString(findByKey(broad, ["broad_no"], 2)) : null;

  return {
    channelId,
    nickname: asString(findByKey(station, ["user_nick", "station_name"], 3)),
    profileImageUrl:
      normalizeUrl(asString(findByKey(raw, ["profile_image"], 4))) ??
      profileImageUrlFor(channelId),
    totalBroadSeconds: asNumber(findByKey(raw, ["total_broad_time"], 4)),
    totalViewCount: asNumber(findByKey(raw, ["total_view_cnt"], 4)),
    fanCount: asNumber(findByKey(raw, ["fan_cnt"], 4)),
    live: broadNo
      ? {
          broadNo,
          title: asString(findByKey(broad, ["broad_title", "user_nick"], 2)),
          viewers:
            asNumber(findByKey(broad, ["current_sum_viewer", "total_view_cnt"], 2)) ?? 0,
          startedAt: parseSoopDate(
            asString(findByKey(broad, ["broad_start", "broad_reg_date"], 2)) ??
              asString(findByKey(station, ["broad_start"], 2))
          ),
        }
      : null,
    raw,
  };
}

export async function fetchStation(channelId: string): Promise<SoopStationSnapshot> {
  const response = await fetch(`${STATION_ENDPOINT}/${encodeURIComponent(channelId)}/station`, {
    headers: {
      accept: "application/json",
      // SOOP 은 브라우저 외 요청을 막는 경우가 있어 Referer 를 붙인다.
      referer: `https://www.sooplive.com/station/${channelId}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`SOOP station API ${response.status} (${channelId})`);
  }

  return parseStationPayload(channelId, (await response.json()) as Json);
}
