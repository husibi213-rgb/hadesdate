import { PageHeader } from "@/components/layout/page-header";
import { CatchCard } from "@/components/catches/catch-card";
import { CatchGroupList, type CatchGroupBy } from "@/components/catches/catch-group-list";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";

import { getCatchesForGrouping, getCatchesPage } from "@/lib/queries/catches";
import { getMembers } from "@/lib/queries/members";
import { CATCH_SORTS, PERIOD_PRESETS, type CatchSortKey } from "@/lib/constants";
import { chartRange, periodRange } from "@/lib/utils/period";

export const metadata = { title: "캐치" };

const VIEW_MODES = [
  { key: "date", label: "날짜별" },
  { key: "member", label: "멤버별" },
  { key: "grid", label: "전체" },
] as const;

type ViewMode = (typeof VIEW_MODES)[number]["key"];

export default async function CatchesPage({
  searchParams,
}: {
  searchParams: Promise<{
    member?: string;
    sort?: string;
    period?: string;
    page?: string;
    view?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = (CATCH_SORTS.find((s) => s.key === sp.sort)?.key ?? "views") as CatchSortKey;
  const view = (VIEW_MODES.find((v) => v.key === sp.view)?.key ?? "date") as ViewMode;
  // 날짜별/멤버별 묶어보기는 기간을 한정해야 하므로 기본 30일
  const range = periodRange(sp.period ?? (view === "grid" ? "all" : "30d"));

  const members = await getMembers();
  if (members.notConfigured) {
    return (
      <>
        <PageHeader title="캐치" />
        <SetupNotice />
      </>
    );
  }

  const selected = sp.member
    ? (members.data.find((m) => m.slug === sp.member || m.id === sp.member) ?? null)
    : null;

  const query = (extra: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = {
      member: sp.member,
      sort: sp.sort,
      period: sp.period,
      view: sp.view,
      ...extra,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/catches?${qs}` : "/catches";
  };

  const filters = (
    <div className="flex flex-col gap-2">
      <FilterTabs
        activeKey={view}
        items={VIEW_MODES.map((v) => ({
          key: v.key,
          label: v.label,
          href: query({ view: v.key, page: undefined }),
        }))}
      />
      <FilterTabs
        activeKey={selected?.slug ?? selected?.id ?? "all"}
        items={[
          { key: "all", label: "전체 멤버", href: query({ member: undefined, page: undefined }) },
          ...members.data.map((m) => ({
            key: m.slug ?? m.id,
            label: m.name,
            href: query({ member: m.slug ?? m.id, page: undefined }),
          })),
        ]}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {view === "grid" ? (
          <FilterTabs
            activeKey={sort}
            items={CATCH_SORTS.map((s) => ({
              key: s.key,
              label: s.label,
              href: query({ sort: s.key, page: undefined }),
            }))}
          />
        ) : null}
        <FilterTabs
          activeKey={range.key}
          items={PERIOD_PRESETS.map((p) => ({
            key: p.key,
            label: p.label,
            href: query({ period: p.key, page: undefined }),
          }))}
        />
      </div>
    </div>
  );

  // ---------- 날짜별 / 멤버별 묶어보기 ----------
  if (view !== "grid") {
    const bounds = chartRange(range, 365);
    const grouped = await getCatchesForGrouping({
      from: bounds.from,
      to: bounds.to,
      memberId: selected?.id ?? null,
      limit: 240,
    });

    return (
      <>
        <PageHeader
          title="방송 캐치"
          description={
            view === "date"
              ? `${range.label} · 날짜별로 묶고 각 날짜 안에서는 조회수 순으로 나열합니다`
              : `${range.label} · 멤버별로 묶고 각 멤버 안에서는 조회수 순으로 나열합니다`
          }
        />
        {filters}

        {grouped.error ? <ErrorState description={grouped.error} /> : null}

        {grouped.data.length === 0 ? (
          <EmptyState
            title="캐치가 없습니다"
            description="기간을 넓히거나 수집기가 캐치를 적재했는지 확인해 주세요."
          />
        ) : (
          <CatchGroupList items={grouped.data} groupBy={view as CatchGroupBy} />
        )}
      </>
    );
  }

  // ---------- 전체 그리드 (페이지네이션) ----------
  const result = await getCatchesPage({
    page,
    memberId: selected?.id ?? null,
    sort,
    from: range.from,
    to: range.to,
  });

  return (
    <>
      <PageHeader
        title="방송 캐치"
        description="원본 콘텐츠는 복제하지 않습니다. 클릭하면 원본으로 이동합니다."
      />
      {filters}

      {result.error ? <ErrorState description={result.error} /> : null}

      {result.data.rows.length === 0 ? (
        <EmptyState title="캐치가 없습니다" />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {result.data.rows.map((item) => (
            <CatchCard key={item.id} item={item} />
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
