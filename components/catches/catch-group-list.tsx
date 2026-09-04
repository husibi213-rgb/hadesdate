import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { CatchWithMember } from "@/lib/queries/catches";
import { CatchCard } from "@/components/catches/catch-card";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { formatNumber } from "@/lib/utils/format";

export type CatchGroupBy = "date" | "member";

interface Group {
  key: string;
  label: string;
  href?: string;
  avatar?: { name: string; imageUrl: string | null; color: string | null };
  items: CatchWithMember[];
}

/**
 * 캐치를 날짜별 / 멤버별로 묶어서 보여준다.
 * 각 그룹 안은 조회수 내림차순 (쿼리에서 이미 그 순서로 내려온다).
 */
export function CatchGroupList({
  items,
  groupBy,
}: {
  items: CatchWithMember[];
  groupBy: CatchGroupBy;
}) {
  const groups = groupItems(items, groupBy);

  return (
    <div className="space-y-7">
      {groups.map((group) => {
        const totalViews = group.items.reduce((sum, item) => sum + item.views, 0);

        return (
          <section key={group.key} className="space-y-3">
            <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
              <div className="flex items-center gap-2">
                {group.avatar ? (
                  <MemberAvatar
                    name={group.avatar.name}
                    imageUrl={group.avatar.imageUrl}
                    color={group.avatar.color}
                    size="sm"
                  />
                ) : null}
                {group.href ? (
                  <Link
                    href={group.href}
                    className="tnum inline-flex items-center gap-0.5 text-sm font-semibold text-fg transition-colors hover:text-accent"
                  >
                    {group.label}
                    <ChevronRight className="size-3.5" />
                  </Link>
                ) : (
                  <span className="tnum text-sm font-semibold text-fg">{group.label}</span>
                )}
              </div>
              <span className="tnum text-[11px] text-fg-dim">
                {formatNumber(group.items.length)}개 · 조회 {formatNumber(totalViews)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              {group.items.map((item) => (
                <CatchCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function groupItems(items: CatchWithMember[], groupBy: CatchGroupBy): Group[] {
  const map = new Map<string, Group>();

  for (const item of items) {
    if (groupBy === "date") {
      const key = item.catch_date;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      const [y, m, d] = key.split("-");
      map.set(key, {
        key,
        label: `${y}.${m}.${d}`,
        href: `/calendar/${y}/${m}/${d}`,
        items: [item],
      });
    } else {
      const key = item.member_id;
      const existing = map.get(key);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      map.set(key, {
        key,
        label: item.member?.name ?? "알 수 없음",
        href: `/members/${item.member?.slug ?? item.member_id}`,
        avatar: item.member
          ? {
              name: item.member.name,
              imageUrl: item.member.profile_image_url,
              color: item.member.color,
            }
          : undefined,
        items: [item],
      });
    }
  }

  const groups = Array.from(map.values());

  if (groupBy === "date") {
    // 날짜 최신순
    return groups.sort((a, b) => b.key.localeCompare(a.key));
  }

  // 멤버별은 조회수 합계가 큰 순서로
  return groups.sort((a, b) => {
    const sum = (g: Group) => g.items.reduce((s, i) => s + i.views, 0);
    return sum(b) - sum(a);
  });
}
