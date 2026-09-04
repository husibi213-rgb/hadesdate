import type { MemberRow } from "@/types/database";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { LiveBadge } from "@/components/ui/badge";
import { formatHours, formatNumber } from "@/lib/utils/format";

export interface MemberCardStats {
  broadcastCount: number;
  totalDurationSeconds: number;
  avgViewers: number;
  peakViewers: number;
}

export function MemberCard({
  member,
  stats,
  isLive = false,
}: {
  member: MemberRow;
  stats?: MemberCardStats;
  isLive?: boolean;
}) {
  return (
    <TrackedLink
      href={`/members/${member.slug ?? member.id}`}
      targetType="profile"
      targetId={member.id}
      memberId={member.id}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface/70 p-4 transition-colors hover:border-border-strong hover:bg-surface-2/50"
    >
      <div className="flex items-center gap-3">
        <MemberAvatar
          name={member.name}
          imageUrl={member.profile_image_url}
          color={member.color}
          size="lg"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">{member.name}</span>
            {isLive ? <LiveBadge /> : null}
          </div>
          <p className="tnum mt-0.5 text-[11px] text-fg-dim">
            방송 {formatNumber(stats?.broadcastCount ?? 0)}회 ·{" "}
            {formatHours(stats?.totalDurationSeconds ?? 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        <div>
          <div className="text-[10px] tracking-wide text-fg-dim uppercase">평균 시청자</div>
          <div className="tnum text-sm font-semibold text-fg">
            {formatNumber(stats?.avgViewers ?? 0)}
          </div>
        </div>
        <div>
          <div className="text-[10px] tracking-wide text-fg-dim uppercase">최고 시청자</div>
          <div className="tnum text-sm font-semibold text-fg">
            {formatNumber(stats?.peakViewers ?? 0)}
          </div>
        </div>
      </div>
    </TrackedLink>
  );
}
