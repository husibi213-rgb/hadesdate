import { PageHeader } from "@/components/layout/page-header";
import { BroadcastListItem } from "@/components/broadcasts/broadcast-list-item";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";

import { getBroadcastsPage } from "@/lib/queries/broadcasts";
import { getMembers } from "@/lib/queries/members";

export const metadata = { title: "방송" };

export default async function BroadcastsPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; page?: string; date?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  const members = await getMembers();
  if (members.notConfigured) {
    return (
      <>
        <PageHeader title="방송" />
        <SetupNotice />
      </>
    );
  }

  const selected = sp.member
    ? (members.data.find((m) => m.slug === sp.member || m.id === sp.member) ?? null)
    : null;

  const result = await getBroadcastsPage({
    page,
    memberId: selected?.id ?? null,
    date: sp.date ?? null,
  });

  const query = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { member: sp.member, date: sp.date, ...extra };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/broadcasts?${qs}` : "/broadcasts";
  };

  return (
    <>
      <PageHeader
        title="방송"
        description={sp.date ? `${sp.date} 방송 기록` : "전체 방송 기록 (최신순)"}
        actions={
          <FilterTabs
            activeKey={selected?.slug ?? selected?.id ?? "all"}
            items={[
              { key: "all", label: "전체", href: query({ member: undefined, page: undefined }) },
              ...members.data.map((m) => ({
                key: m.slug ?? m.id,
                label: m.name,
                href: query({ member: m.slug ?? m.id, page: undefined }),
              })),
            ]}
          />
        }
      />

      {result.error ? <ErrorState description={result.error} /> : null}

      {result.data.rows.length === 0 ? (
        <EmptyState title="방송 기록이 없습니다" />
      ) : (
        <div className="space-y-2">
          {result.data.rows.map((b) => (
            <BroadcastListItem key={b.id} broadcast={b} />
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
