import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { MemberRow, MemberStats } from "@/types/database";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";

/**
 * 한 멤버의 그 달 방송 요약 카드.
 * 예전 월 페이지에 있던 5명 비교표를 대체한다 — 줄세우지 않고 각자 기록만 보여준다.
 */
export function MemberMonthCard({
  member,
  stats,
  year,
  month,
}: {
  member: MemberRow;
  stats: MemberStats;
  year: number;
  month: number;
}) {
  const key = member.slug ?? member.id;
  const hasRecord = stats.broadcast_count > 0;

  return (
    <Link
      href={`/members/${key}?y=${year}&m=${String(month).padStart(2, "0")}`}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-surface/70 p-4 transition-colors hover:border-border-strong hover:bg-surface-2/50"
    >
      <div className="flex items-center gap-2.5">
        <MemberAvatar
          name={member.name}
          imageUrl={member.profile_image_url}
          color={member.color}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-fg">{member.name}</div>
          <p className="tnum mt-0.5 text-[11px] text-fg-dim">
            {hasRecord
              ? `방송 ${formatNumber(stats.broadcast_count)}회 · ${formatDurationShort(stats.total_duration_seconds)}`
              : "이 달 방송 기록 없음"}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-fg-dim transition-colors group-hover:text-fg" />
      </div>

      {hasRecord ? (
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div>
            <div className="text-[10px] tracking-wide text-fg-dim uppercase">평균</div>
            <div className="tnum text-sm font-semibold text-fg">
              {formatNumber(stats.avg_viewers)}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-fg-dim uppercase">최고</div>
            <div className="tnum text-sm font-semibold text-fg">
              {formatNumber(stats.peak_viewers)}
            </div>
          </div>
          <div>
            <div className="text-[10px] tracking-wide text-fg-dim uppercase">캐치</div>
            <div className="tnum text-sm font-semibold text-fg">
              {formatNumber(stats.catch_count)}
            </div>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
