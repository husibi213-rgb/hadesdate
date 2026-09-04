import { ChevronRight } from "lucide-react";

import type { MemberRow } from "@/types/database";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { LiveBadge } from "@/components/ui/badge";

/**
 * 멤버 선택 카드.
 *
 * 예전에는 카드마다 평균/최고 시청자를 찍어 5명이 한 화면에서 비교되는 형태였다.
 * 지금은 "한 멤버를 고르는" 관문 역할만 하고, 수치는 멤버 상세에서 본다.
 */
export function MemberCard({
  member,
  isLive = false,
}: {
  member: MemberRow;
  isLive?: boolean;
}) {
  return (
    <TrackedLink
      href={`/members/${member.slug ?? member.id}`}
      targetType="profile"
      targetId={member.id}
      memberId={member.id}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-4 transition-colors hover:border-border-strong hover:bg-surface-2/50"
    >
      <MemberAvatar
        name={member.name}
        imageUrl={member.profile_image_url}
        color={member.color}
        size="lg"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-fg">{member.name}</span>
          {isLive ? <LiveBadge /> : null}
        </div>
        {member.channel_id ? (
          <p className="mt-0.5 truncate text-[11px] text-fg-dim">{member.channel_id}</p>
        ) : null}
      </div>

      <ChevronRight className="size-4 shrink-0 text-fg-dim transition-colors group-hover:text-fg" />
    </TrackedLink>
  );
}
