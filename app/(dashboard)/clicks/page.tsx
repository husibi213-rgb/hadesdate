import { MousePointerClick, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { HourlyBarChart } from "@/components/charts/hourly-bar-chart";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

import { getClickBreakdown, getClickHourly, getMemberComparison } from "@/lib/queries/analytics";
import { buildPeriodTabs, periodRange } from "@/lib/utils/period";
import { CLICK_TARGET_LABELS } from "@/lib/constants";
import { formatNumber } from "@/lib/utils/format";
import Link from "next/link";

export const metadata = { title: "클릭 분석" };

export default async function ClicksPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const range = periodRange(period ?? "7d");

  const [breakdown, hourly, comparison] = await Promise.all([
    getClickBreakdown(range.from, range.to),
    getClickHourly(range.from, range.to),
    getMemberComparison(range.from, range.to),
  ]);

  if (breakdown.notConfigured) {
    return (
      <>
        <PageHeader title="클릭 분석" />
        <SetupNotice />
      </>
    );
  }

  const total = breakdown.data.reduce((s, r) => s + r.click_count, 0);
  const uniqueSessions = breakdown.data.reduce((s, r) => s + r.unique_sessions, 0);

  const hourlyMap = new Map(hourly.data.map((h) => [h.hour, h.click_count]));
  const hourlyData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}`,
    clicks: hourlyMap.get(h) ?? 0,
  }));

  const memberClicks = [...comparison.data]
    .filter((row) => row.click_count > 0)
    .sort((a, b) => b.click_count - a.click_count);

  return (
    <>
      <PageHeader
        title="클릭 분석"
        description={`${range.label} 기준 · 익명 집계`}
        actions={<FilterTabs items={buildPeriodTabs("/clicks", range.key)} activeKey={range.key} />}
      />

      <div className="flex items-start gap-2 rounded-xl border border-border bg-surface/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-fg-muted">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-up" />
        개별 사용자를 식별하는 화면은 제공하지 않습니다. 닉네임·IP·계정 정보는 저장하지 않으며,
        익명 세션 해시 기반 집계만 사용합니다.
      </div>

      {breakdown.error ? <ErrorState description={breakdown.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="전체 클릭"
          value={formatNumber(total)}
          icon={<MousePointerClick className="size-3.5" />}
        />
        <StatCard label="고유 세션" value={formatNumber(uniqueSessions)} />
        <StatCard
          label="세션당 클릭"
          value={uniqueSessions > 0 ? (total / uniqueSessions).toFixed(1) : "-"}
        />
        <StatCard label="집계 대상 멤버" value={formatNumber(memberClicks.length)} unit="명" />
      </div>

      <Section title="타겟별 클릭">
        {breakdown.data.length === 0 ? (
          <EmptyState title="클릭 데이터가 없습니다" />
        ) : (
          <Card>
            <CardContent className="space-y-2.5 pt-4">
              {breakdown.data.map((row) => {
                const ratio = total > 0 ? (row.click_count / total) * 100 : 0;
                return (
                  <div key={row.target_type} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-fg-muted">
                        {CLICK_TARGET_LABELS[row.target_type] ?? row.target_type}
                      </span>
                      <span className="tnum text-fg">
                        {formatNumber(row.click_count)}
                        <span className="ml-1.5 text-fg-dim">{ratio.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${ratio}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </Section>

      <Section title="시간대별 클릭" description="KST 기준">
        <Card>
          <CardContent className="pt-4">
            {total === 0 ? (
              <EmptyState title="클릭 데이터가 없습니다" className="border-0" />
            ) : (
              <HourlyBarChart data={hourlyData} />
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="멤버별 클릭">
        {memberClicks.length === 0 ? (
          <EmptyState title="멤버별 클릭 데이터가 없습니다" />
        ) : (
          <TableWrap>
            <Table className="min-w-[480px]">
              <thead>
                <tr>
                  <Th>멤버</Th>
                  <Th className="text-right">클릭</Th>
                  <Th className="text-right">방송</Th>
                  <Th className="text-right">캐치</Th>
                </tr>
              </thead>
              <tbody>
                {memberClicks.map((row) => (
                  <Tr key={row.member_id}>
                    <Td>
                      <Link
                        href={`/members/${row.slug ?? row.member_id}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                      >
                        {row.name}
                      </Link>
                    </Td>
                    <Td className="tnum text-right">{formatNumber(row.click_count)}</Td>
                    <Td className="tnum text-right">{formatNumber(row.broadcast_count)}</Td>
                    <Td className="tnum text-right">{formatNumber(row.catch_count)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Section>
    </>
  );
}
