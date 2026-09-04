import { SmartLink } from "@/components/ui/smart-link";
import { ExternalLink, Megaphone, Radio, Scissors, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { SearchBox } from "@/components/layout/search-box";
import { Section } from "@/components/ui/section";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { formatNumber } from "@/lib/utils/format";
import { searchAll } from "@/lib/queries/search";
import type { SearchKind, SearchResultRow } from "@/types/database";

export const metadata = { title: "검색" };

const GROUPS: {
  kind: SearchKind;
  label: string;
  icon: React.ReactNode;
  metricLabel?: string;
  external?: boolean;
}[] = [
  { kind: "member", label: "멤버", icon: <Users className="size-3.5" /> },
  {
    kind: "broadcast",
    label: "방송",
    icon: <Radio className="size-3.5" />,
    metricLabel: "최고 시청자",
  },
  {
    kind: "catch",
    label: "캐치",
    icon: <Scissors className="size-3.5" />,
    metricLabel: "조회",
    external: true,
  },
  { kind: "notice", label: "공지", icon: <Megaphone className="size-3.5" />, external: true },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const result = await searchAll(query);

  if (result.notConfigured) {
    return (
      <>
        <PageHeader title="검색" />
        <SetupNotice />
      </>
    );
  }

  const byKind = new Map<SearchKind, SearchResultRow[]>();
  for (const row of result.data) {
    const list = byKind.get(row.kind) ?? [];
    list.push(row);
    byKind.set(row.kind, list);
  }

  return (
    <>
      <PageHeader
        title="검색"
        description={
          query
            ? `"${query}" 검색 결과 ${formatNumber(result.data.length)}건`
            : "멤버 이름, 방송 제목, 캐치 제목, 공지 제목에서 찾습니다"
        }
      />

      <SearchBox className="max-w-md" />

      {result.error ? <ErrorState description={result.error} /> : null}

      {query.length === 0 ? (
        <EmptyState
          title="검색어를 입력해 주세요"
          icon={<Search className="size-5" />}
          description="예: 멤버 이름, 방송 제목의 한 단어"
        />
      ) : result.data.length === 0 ? (
        <EmptyState
          title={`"${query}"에 대한 결과가 없습니다`}
          description="다른 단어로 검색하거나 더 짧게 입력해 보세요."
        />
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const rows = byKind.get(group.kind);
            if (!rows?.length) return null;

            return (
              <Section
                key={group.kind}
                title={`${group.label} ${rows.length}건`}
                description={rows.length >= 8 ? "상위 8건만 표시합니다" : undefined}
              >
                <div className="space-y-2">
                  {rows.map((row) => (
                    <SmartLink
                      key={`${row.kind}-${row.id}`}
                      href={row.href}
                      external={group.external}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface/70 px-3.5 py-3 transition-colors hover:border-border-strong hover:bg-surface-2/60"
                    >
                      <span className="shrink-0 text-fg-dim">{group.icon}</span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-fg">
                          {row.title}
                        </span>
                        <span className="tnum block truncate text-[11px] text-fg-dim">
                          {[row.member_name, row.subtitle].filter(Boolean).join(" · ") || "-"}
                        </span>
                      </span>

                      {group.metricLabel && row.metric > 0 ? (
                        <span className="tnum shrink-0 text-right text-[11px] text-fg-muted">
                          {formatNumber(row.metric)}
                          <span className="block text-fg-dim">{group.metricLabel}</span>
                        </span>
                      ) : null}

                      {group.external ? (
                        <ExternalLink className="size-3 shrink-0 text-fg-dim" />
                      ) : null}
                    </SmartLink>
                  ))}
                </div>
              </Section>
            );
          })}
        </div>
      )}
    </>
  );
}
