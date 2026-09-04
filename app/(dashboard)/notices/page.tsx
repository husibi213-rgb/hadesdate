import { PageHeader } from "@/components/layout/page-header";
import { NoticeCard } from "@/components/notices/notice-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";

import { getNoticesPage } from "@/lib/queries/notices";
import { NOTICE_SOURCE_LABELS } from "@/lib/constants";
import type { NoticeSource } from "@/types/database";

export const metadata = { title: "공지" };

const SOURCES: NoticeSource[] = ["cafe", "broadcast_station", "other"];

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const source = SOURCES.includes(sp.source as NoticeSource)
    ? (sp.source as NoticeSource)
    : null;

  const result = await getNoticesPage({ page, source });

  if (result.notConfigured) {
    return (
      <>
        <PageHeader title="공지" />
        <SetupNotice />
      </>
    );
  }

  const query = (extra: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { source: sp.source, ...extra };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/notices?${qs}` : "/notices";
  };

  return (
    <>
      <PageHeader
        title="공지"
        description="제목·요약·원문 링크만 제공합니다. 전체 원문은 원본에서 확인해 주세요."
        actions={
          <FilterTabs
            activeKey={source ?? "all"}
            items={[
              { key: "all", label: "전체", href: query({ source: undefined, page: undefined }) },
              ...SOURCES.map((s) => ({
                key: s,
                label: NOTICE_SOURCE_LABELS[s],
                href: query({ source: s, page: undefined }),
              })),
            ]}
          />
        }
      />

      {result.error ? <ErrorState description={result.error} /> : null}

      {result.data.rows.length === 0 ? (
        <EmptyState title="공지가 없습니다" />
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {result.data.rows.map((notice) => (
            <NoticeCard key={notice.id} notice={notice} />
          ))}
        </div>
      )}

      <Pagination
        page={page}
        hasNext={result.data.hasNext}
        buildHref={(p) => query({ page: p > 1 ? String(p) : undefined })}
      />
    </>
  );
}
