/**
 * 날짜 유틸. 이 사이트의 모든 "날짜"는 KST(Asia/Seoul) 기준이다.
 * 자정을 넘긴 방송도 시작일에 귀속된다 (broadcasts.broadcast_date).
 */

export const TIME_ZONE = "Asia/Seoul";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Date | ISO string -> "2026-09-03" (KST) */
export function toDateKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return dateKeyFormatter.format(date);
}

/** 오늘 (KST) */
export function todayKey(): string {
  return dateKeyFormatter.format(new Date());
}

/** "19:02" */
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  const date = typeof value === "string" ? new Date(value) : value;
  return timeFormatter.format(date);
}

/** "2026.09.03 19:02" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return dateTimeFormatter.format(date).replace(/\. /g, ".").replace(/\.$/, "");
}

/** "2026.09.03" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return toDateKey(typeof value === "string" ? new Date(value) : value).replace(/-/g, ".");
}

/** "09/03" */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const key = toDateKey(typeof value === "string" ? new Date(value) : value);
  return key.slice(5).replace("-", "/");
}

/** "2026-09-03" 을 그대로 더하고 빼기 (UTC 기준 계산 후 키만 사용) */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateKeyToParts(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { year, month, day } = dateKeyToParts(key);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** 달력 그리드용: 해당 월의 1일 ~ 말일 키 배열 */
export function monthDayKeys(year: number, month: number): string[] {
  const keys: string[] = [];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d += 1) {
    keys.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return keys;
}

/** 해당 월 1일의 요일 (0=일) */
export function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/** 진행 중 방송의 경과 초 */
export function elapsedSeconds(startedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}
