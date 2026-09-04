import { TIME_ZONE } from "@/lib/utils/dates";

/**
 * <input type="datetime-local"> 값과 ISO 문자열 사이의 변환.
 * 입력값은 항상 KST 로 해석한다. (사이트의 모든 시각 기준이 KST)
 */

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** ISO → "2026-09-03T19:02" (KST) */
export function toDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = partsFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  // en-CA + h23 조합에서 자정이 "24" 로 나오는 경우를 보정한다.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** "2026-09-03T19:02" (KST) → ISO. 빈 값이면 null */
export function fromDateTimeInput(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(`${y}-${m}-${d}T${hh}:${mm}:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** "2026-09-03" (KST 날짜) → 그 날 00:00 KST 의 ISO */
export function fromDateInput(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00+09:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
