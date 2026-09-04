import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/ui/section";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { ComparisonTable } from "@/components/analytics/comparison-table";
import { RankingCard, type RankingEntry } from "@/components/analytics/ranking-card";

import { getMemberComparison } from "@/lib/queries/analytics";
import { buildPeriodTabs, periodRange } from "@/lib/utils/period";
import { formatDurationShort, formatNumber } from "@/lib/utils/format";

export const metadata = { title: "통계" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const range = periodRange(period);
  const result = await getMemberComparison(range.from, range.to);

  if (result.notConfigured) {
    return (
      <>
        <PageHeader title="통계" />
        <SetupNotice />
      </>
    );
  }

  const rows = result.data;
  const toEntries = (
    pick: (row: (typeof rows)[number]) => number,
    display: (value: number) => string
  ): RankingEntry[] =>
    rows.map((row) => ({
      id: row.member_id,
      slug: row.slug ?? row.member_id,
      name: row.name,
      value: pick(row),
      display: display(pick(row)),
    }));

  return (
    <>
      <PageHeader
        title="통계"
        description={`${range.label} 기준 멤버 비교 및 랭킹`}
        actions={
          <FilterTabs items={buildPeriodTabs("/analytics", range.key)} activeKey={range.key} />
        }
      />

      {result.error ? <ErrorState description={result.error} /> : null}

      <Section title="멤버 비교">
        {rows.length === 0 ? (
          <EmptyState title="비교할 데이터가 없습니다" />
        ) : (
          <ComparisonTable rows={rows} />
        )}
      </Section>

      <Section title="랭킹">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <RankingCard title="평균 시청자 TOP" entries={toEntries((r) => r.avg_viewers, formatNumber)} />
          <RankingCard title="최고 시청자 TOP" entries={toEntries((r) => r.peak_viewers, formatNumber)} />
          <RankingCard
            title="방송시간 TOP"
            entries={toEntries((r) => r.total_duration_seconds, formatDurationShort)}
          />
          <RankingCard
            title="방송 횟수 TOP"
            entries={toEntries((r) => r.broadcast_count, (v) => `${formatNumber(v)}회`)}
          />
          <RankingCard
            title="캐치 TOP"
            entries={toEntries((r) => r.catch_count, (v) => `${formatNumber(v)}개`)}
          />
          <RankingCard title="클릭 TOP" entries={toEntries((r) => r.click_count, formatNumber)} />
        </div>
      </Section>
    </>
  );
}
