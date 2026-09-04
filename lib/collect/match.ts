import { toDateKey } from "@/lib/utils/dates";

export interface BroadcastWindow {
  id: string;
  started_at: string;
  ended_at: string | null;
  broadcast_date: string;
}

/** "2026-09-03" 에 일수를 더한다. */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function minDateKey(keys: string[]): string {
  return keys.reduce((min, key) => (key < min ? key : min), keys[0]);
}

export function maxDateKey(keys: string[]): string {
  return keys.reduce((max, key) => (key > max ? key : max), keys[0]);
}

/** 게시물이 방송 종료 후 올라오는 여유 시간 (초) */
export const POST_UPLOAD_GRACE_SECONDS = 6 * 3600;

/**
 * 게시물 등록 시각이 걸치는 방송을 찾는다.
 *   1) 방송 구간(시작 ~ 종료 + 여유) 안에 들어가는 방송
 *   2) 없으면 같은 날짜(KST)의 방송
 *   3) 없으면 전날 방송 (자정을 넘긴 방송에서 올라온 게시물)
 */
export function matchBroadcastForPost<T extends BroadcastWindow>(
  broadcasts: T[],
  registeredAt: string | null,
  now = Date.now()
): T | null {
  if (!registeredAt) return null;
  const at = new Date(registeredAt).getTime();
  if (Number.isNaN(at)) return null;

  const inRange = broadcasts.find((b) => {
    const start = new Date(b.started_at).getTime();
    const end = b.ended_at ? new Date(b.ended_at).getTime() : now;
    return at >= start && at <= end + POST_UPLOAD_GRACE_SECONDS * 1000;
  });
  if (inRange) return inRange;

  const dateKey = toDateKey(registeredAt);
  return (
    broadcasts.find((b) => b.broadcast_date === dateKey) ??
    broadcasts.find((b) => b.broadcast_date === shiftDateKey(dateKey, -1)) ??
    null
  );
}

/** 방송 시작 기준 경과 초 */
export function offsetFromBroadcastStart(
  startedAt: string,
  registeredAt: string | null
): number | null {
  if (!registeredAt) return null;
  const offset = Math.round(
    (new Date(registeredAt).getTime() - new Date(startedAt).getTime()) / 1000
  );
  return Number.isFinite(offset) ? Math.max(0, offset) : null;
}
