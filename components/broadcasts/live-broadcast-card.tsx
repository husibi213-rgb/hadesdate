"use client";

import { useEffect, useState } from "react";
import type { BroadcastWithMember } from "@/lib/queries/broadcasts";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { LiveBadge } from "@/components/ui/badge";
import { elapsedSeconds, formatTime } from "@/lib/utils/dates";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";
import { TrackedLink } from "@/components/analytics/tracked-link";

export function LiveBroadcastCard({ broadcast }: { broadcast: BroadcastWithMember }) {
  // 방송시간은 클라이언트에서 흐르게 한다.
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(broadcast.started_at));

  useEffect(() => {
    const id = setInterval(() => setElapsed(elapsedSeconds(broadcast.started_at)), 30_000);
    return () => clearInterval(id);
  }, [broadcast.started_at]);

  return (
    <TrackedLink
      href={`/broadcasts/${broadcast.id}`}
      targetType="broadcast"
      targetId={broadcast.id}
      memberId={broadcast.member_id}
      broadcastId={broadcast.id}
      className="group flex flex-col gap-3 rounded-xl border border-live/25 bg-surface/70 p-4 transition-colors hover:border-live/50"
    >
      <div className="flex items-start gap-3">
        <MemberAvatar
          name={broadcast.member?.name ?? "?"}
          imageUrl={broadcast.member?.profile_image_url}
          color={broadcast.member?.color}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">
              {broadcast.member?.name ?? "알 수 없음"}
            </span>
            <LiveBadge />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-fg-muted">
            {broadcast.title ?? "제목 없음"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Metric label="시청자" value={formatNumber(broadcast.peak_viewers)} tone="live" />
        <Metric label="방송시간" value={formatDurationShort(elapsed)} />
        <Metric label="시작" value={formatTime(broadcast.started_at)} />
      </div>
    </TrackedLink>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "live";
}) {
  return (
    <div>
      <div className="text-[10px] tracking-wide text-fg-dim uppercase">{label}</div>
      <div
        className={`tnum text-sm font-semibold ${tone === "live" ? "text-live" : "text-fg"}`}
      >
        {value}
      </div>
    </div>
  );
}
