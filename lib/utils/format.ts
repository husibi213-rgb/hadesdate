/** 숫자/시간 포맷 유틸 (전부 KST 기준) */

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return numberFormatter.format(Math.round(value));
}

/** 12,431 -> 12.4K */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  if (Math.abs(value) < 1000) return String(Math.round(value));
  if (Math.abs(value) < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/** 22320 -> "6시간 12분" */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0분";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

/** 22320 -> "6h 12m" (테이블/카드용 짧은 표기) */
export function formatDurationShort(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** 누적 시간: 1832시간 -> "1,832h" */
export function formatHours(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "0h";
  return `${formatNumber(Math.floor(seconds / 3600))}h`;
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

/** 방송 경과 초 -> "00:13:42" (캐치 타임스탬프) */
export function formatTimestamp(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "--:--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
