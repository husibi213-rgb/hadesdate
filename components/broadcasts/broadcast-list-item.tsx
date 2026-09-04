import Link from "next/link";
import { Eye, Users } from "lucide-react";

import type { BroadcastWithMember } from "@/lib/queries/broadcasts";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { LiveBadge } from "@/components/ui/badge";
import { formatDate, formatTime } from "@/lib/utils/dates";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";

export function BroadcastListItem({
  broadcast,
  showMember = true,
  showDate = true,
}: {
  broadcast: BroadcastWithMember;
  showMember?: boolean;
  showDate?: boolean;
}) {
  const isLive = broadcast.status === "live";

  return (
    <Link
      href={`/broadcasts/${broadcast.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-2/60"
    >
      {showMember && broadcast.member ? (
        <MemberAvatar
          name={broadcast.member.name}
          imageUrl={broadcast.member.profile_image_url}
          color={broadcast.member.color}
          size="md"
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showMember && broadcast.member ? (
            <span className="text-[13px] font-medium text-fg">{broadcast.member.name}</span>
          ) : null}
          {isLive ? <LiveBadge /> : null}
        </div>
        <p className="truncate text-xs text-fg-muted">{broadcast.title ?? "제목 없음"}</p>
      </div>

      <div className="hidden shrink-0 text-right sm:block">
        <div className="tnum text-xs text-fg-muted">
          {showDate ? `${formatDate(broadcast.started_at)} ` : ""}
          {formatTime(broadcast.started_at)}
          {broadcast.ended_at ? ` ~ ${formatTime(broadcast.ended_at)}` : " ~"}
        </div>
        <div className="tnum text-[11px] text-fg-dim">
          {formatDurationShort(broadcast.duration_seconds)}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div className="tnum flex items-center justify-end gap-1 text-[13px] font-medium text-fg">
          <Users className="size-3 text-fg-dim" />
          {formatNumber(isLive ? broadcast.peak_viewers : broadcast.avg_viewers)}
        </div>
        <div className="tnum flex items-center justify-end gap-1 text-[11px] text-fg-dim">
          <Eye className="size-3" />
          {formatNumber(broadcast.views)}
        </div>
      </div>
    </Link>
  );
}
