import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { firstWeekdayOfMonth, monthDayKeys, todayKey } from "@/lib/utils/dates";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export interface CalendarDay {
  dateKey: string;
  broadcastCount: number;
  durationSeconds: number;
  peakViewers: number;
}

/**
 * 방송 캘린더. 서버 컴포넌트 — 날짜 클릭 시 해당 날짜 페이지로 이동한다.
 * 월 이동은 링크(쿼리스트링)로 처리하므로 클라이언트 상태가 필요 없다.
 */
export function BroadcastCalendar({
  year,
  month,
  days,
  hrefForDate,
  hrefForMonth,
}: {
  year: number;
  month: number;
  days: CalendarDay[];
  hrefForDate: (dateKey: string) => string;
  hrefForMonth: (year: number, month: number) => string;
}) {
  const byDate = new Map(days.map((d) => [d.dateKey, d]));
  const dayKeys = monthDayKeys(year, month);
  // 월요일 시작 그리드
  const leading = (firstWeekdayOfMonth(year, month) + 6) % 7;
  const today = todayKey();

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };

  const maxDuration = Math.max(1, ...days.map((d) => d.durationSeconds));

  return (
    <div className="rounded-xl border border-border bg-surface/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={hrefForMonth(prev.y, prev.m)}
          scroll={false}
          aria-label="이전 달"
          className="rounded-md border border-border p-1 text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <ChevronLeft className="size-3.5" />
        </Link>
        <span className="tnum text-sm font-semibold text-fg">
          {year}년 {month}월
        </span>
        <Link
          href={hrefForMonth(next.y, next.m)}
          scroll={false}
          aria-label="다음 달"
          className="rounded-md border border-border p-1 text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-[10px] font-medium text-fg-dim">
            {w}
          </div>
        ))}

        {Array.from({ length: leading }).map((_, i) => (
          <div key={`lead-${i}`} />
        ))}

        {dayKeys.map((key) => {
          const day = byDate.get(key);
          const dayNum = Number(key.slice(8));
          const intensity = day ? 0.18 + 0.6 * (day.durationSeconds / maxDuration) : 0;
          const isToday = key === today;

          if (!day) {
            return (
              <div
                key={key}
                className={cn(
                  "tnum flex aspect-square flex-col items-center justify-center rounded-md border border-transparent text-[11px] text-fg-dim",
                  isToday && "border-border-strong"
                )}
              >
                {dayNum}
              </div>
            );
          }

          return (
            <Link
              key={key}
              href={hrefForDate(key)}
              title={`${key} · ${day.broadcastCount}회 · ${formatDurationShort(day.durationSeconds)} · 최고 ${formatNumber(day.peakViewers)}명`}
              className={cn(
                "tnum flex aspect-square flex-col items-center justify-center rounded-md border text-[11px] font-medium text-fg transition-colors",
                isToday ? "border-accent/60" : "border-border/60 hover:border-border-strong"
              )}
              style={{ backgroundColor: `rgba(109, 140, 255, ${intensity.toFixed(3)})` }}
            >
              {dayNum}
              <span className="mt-0.5 size-1 rounded-full bg-accent" />
            </Link>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-fg-dim">
        색이 진할수록 방송시간이 깁니다. 날짜를 누르면 그날의 전체 데이터를 볼 수 있습니다.
      </p>
    </div>
  );
}
