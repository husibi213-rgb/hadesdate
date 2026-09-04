import { PERIOD_PRESETS, periodDays, resolvePeriod, type PeriodKey } from "@/lib/constants";
import { addDaysToKey, todayKey } from "@/lib/utils/dates";

export interface PeriodRange {
  key: PeriodKey;
  from: string | null;
  to: string | null;
  label: string;
}

export function periodRange(value: string | undefined | null): PeriodRange {
  const key = resolvePeriod(value);
  const days = periodDays(key);
  const to = todayKey();
  const label = PERIOD_PRESETS.find((p) => p.key === key)?.label ?? "";

  if (days === null) return { key, from: null, to: null, label };
  return { key, from: addDaysToKey(to, -(days - 1)), to, label };
}

/** 그래프용 범위 (전체 선택 시에도 무한히 그리지 않도록 상한을 둔다) */
export function chartRange(range: PeriodRange, maxDays = 365): { from: string; to: string } {
  const to = range.to ?? todayKey();
  const from = range.from ?? addDaysToKey(to, -(maxDays - 1));
  return { from, to };
}

export function buildPeriodTabs(basePath: string, activeKey: PeriodKey, extraQuery?: string) {
  return PERIOD_PRESETS.map((preset) => ({
    key: preset.key,
    label: preset.label,
    href: `${basePath}?period=${preset.key}${extraQuery ? `&${extraQuery}` : ""}`,
  }));
}

export { type PeriodKey };
