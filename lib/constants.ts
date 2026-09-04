import type { NoticeSource } from "@/types/database";

/** 기간 필터 프리셋 */
export const PERIOD_PRESETS = [
  { key: "7d", label: "7일", days: 7 },
  { key: "30d", label: "30일", days: 30 },
  { key: "90d", label: "90일", days: 90 },
  { key: "1y", label: "1년", days: 365 },
  { key: "all", label: "전체", days: null },
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];

export const DEFAULT_PERIOD: PeriodKey = "30d";

export function resolvePeriod(value: string | undefined | null): PeriodKey {
  const found = PERIOD_PRESETS.find((p) => p.key === value);
  return found ? found.key : DEFAULT_PERIOD;
}

export function periodDays(key: PeriodKey): number | null {
  return PERIOD_PRESETS.find((p) => p.key === key)?.days ?? null;
}


export const NOTICE_SOURCE_LABELS: Record<NoticeSource, string> = {
  cafe: "카페",
  broadcast_station: "방송국",
  other: "기타",
};

export const CATCH_SORTS = [
  { key: "recent", label: "최신순" },
  { key: "views", label: "조회수순" },
  { key: "likes", label: "좋아요순" },
] as const;

export type CatchSortKey = (typeof CATCH_SORTS)[number]["key"];

export const PAGE_SIZE = 20;
export const CATCH_PAGE_SIZE = 24;
