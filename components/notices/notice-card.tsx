import { ExternalLink } from "lucide-react";
import type { NoticeRow } from "@/types/database";

import { TrackedLink } from "@/components/analytics/tracked-link";
import { Badge } from "@/components/ui/badge";
import { NOTICE_SOURCE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils/dates";

const SOURCE_VARIANT = {
  cafe: "accent",
  broadcast_station: "warn",
  other: "neutral",
} as const;

/** 원문 전체를 복제하지 않는다. 제목 + 요약 + 원문 링크만. */
export function NoticeCard({ notice }: { notice: NoticeRow }) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <Badge variant={SOURCE_VARIANT[notice.source]}>
          {NOTICE_SOURCE_LABELS[notice.source]}
        </Badge>
        <span className="tnum text-[11px] text-fg-dim">
          {formatDate(notice.published_at ?? notice.created_at)}
        </span>
        {notice.url ? <ExternalLink className="ml-auto size-3 text-fg-dim" /> : null}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug font-medium text-fg">
        {notice.title}
      </p>
      {notice.summary ? (
        <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{notice.summary}</p>
      ) : null}
    </>
  );

  const className =
    "block rounded-xl border border-border bg-surface/70 px-3.5 py-3 transition-colors hover:border-border-strong";

  if (notice.url) {
    return (
      <TrackedLink
        href={notice.url}
        external
        targetType="notice"
        targetId={notice.id}
        className={className}
      >
        {body}
      </TrackedLink>
    );
  }
  return <div className={className}>{body}</div>;
}
