import { SmartLink } from "@/components/ui/smart-link";
import { ExternalLink, Eye, Heart, Play } from "lucide-react";

import type { CatchWithMember } from "@/lib/queries/catches";
import { formatDate } from "@/lib/utils/dates";
import { formatNumber, formatTimestamp } from "@/lib/utils/format";

/**
 * 원본 콘텐츠를 복제하지 않는다.
 * 썸네일 + 메타데이터만 보여주고, 재생은 원본으로 이동한다.
 */
export function CatchCard({ item }: { item: CatchWithMember }) {
  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-surface/70 transition-colors hover:border-border-strong">
      <SmartLink
        href={item.catch_url}
        external
        className="relative block aspect-video overflow-hidden bg-surface-3"
      >
        {item.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail_url}
            alt={item.title ?? "캐치"}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-fg-dim">
            <Play className="size-6" />
          </div>
        )}
        {item.broadcast_timestamp !== null ? (
          <span className="tnum absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {formatTimestamp(item.broadcast_timestamp)}
          </span>
        ) : null}
        <span className="absolute top-2 right-2 rounded bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ExternalLink className="size-3" />
        </span>
      </SmartLink>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-[13px] leading-snug font-medium text-fg">
          {item.title ?? "제목 없음"}
        </p>

        <div className="flex items-center justify-between gap-2 text-[11px] text-fg-muted">
          {item.member ? (
            <SmartLink
              href={`/members/${item.member.slug ?? item.member.id}`}
              className="truncate transition-colors hover:text-fg"
            >
              {item.member.name}
            </SmartLink>
          ) : (
            <span />
          )}
          <span className="tnum shrink-0 text-fg-dim">
            {formatDate(item.published_at ?? item.created_at)}
          </span>
        </div>

        <div className="tnum flex items-center gap-3 text-[11px] text-fg-dim">
          <span className="inline-flex items-center gap-1">
            <Eye className="size-3" />
            {formatNumber(item.views)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart className="size-3" />
            {formatNumber(item.likes)}
          </span>
          {item.broadcast_id ? (
            <SmartLink
              href={`/broadcasts/${item.broadcast_id}`}
              className="ml-auto transition-colors hover:text-fg"
            >
              방송 보기
            </SmartLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
