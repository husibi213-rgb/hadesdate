import Link from "next/link";
import { Clock, Eye, Radio, Scissors, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { DailySeriesChart } from "@/components/charts/daily-series-chart";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

import { getMembers, getMemberDailySeries, getMemberStats } from "@/lib/queries/members";
import { buildPeriodTabs, chartRange, periodRange } from "@/lib/utils/period";
import { buildMemberTabs, memberKey, resolveMember } from "@/lib/utils/member-nav";
import { groupMemberSeriesByMonth } from "@/lib/utils/monthly";
import { formatDurationShort, formatHours, formatNumber } from "@/lib/utils/format";

export const metadata = { title: "통계" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; member?: string }>;
}) {
  const { period, member: memberParam } = await searchParams;
  const range = periodRange(period);

  const members = await getMembers();

  if (members.notConfigured) {
    return (
      <>
        <PageHeader title="통계" />
        <SetupNotice />
      </>
    );
  }

  const selected = resolveMember(members.data, memberParam);

  if (!selected) {
    return (
      <>
        <PageHeader title="통계" />
        {members.error ? <ErrorState description={members.error} /> : null}
        <EmptyState
          title="등록된 멤버가 없습니다"
          description="멤버가 등록되면 멤버별 통계를 볼 수 있습니다."
          icon={<Users className="size-5" />}
        />
      </>
    );
  }

  const key = memberKey(selected);
  const chart = chartRange(range, 365);

  const [stats, series] = await Promise.all([
    getMemberStats(selected.id, range.from, range.to),
    getMemberDailySeries(selected.id, chart.from, chart.to),
  ]);

  const chartData = series.data.map((p) => ({
    date: p.stat_date,
    hours: Math.round((p.duration_seconds / 3600) * 10) / 10,
    avgViewers: p.avg_viewers,
    peakViewers: p.peak_viewers,
  }));

  const monthlyRows = groupMemberSeriesByMonth(series.data).filter(
    (row) => row.broadcastCount > 0
  );

  return (
    <>
      <PageHeader
        title="통계"
        description={`${selected.name} · ${range.label} 기준`}
        actions={
          <FilterTabs
            items={buildPeriodTabs("/analytics", range.key, `member=${encodeURIComponent(key)}`)}
            activeKey={range.key}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <MemberAvatar
          name={selected.name}
          imageUrl={selected.profile_image_url}
          color={selected.color}
          size="sm"
        />
        <FilterTabs
          items={buildMemberTabs("/analytics", members.data, `period=${range.key}`)}
          activeKey={key}
        />
        <Link
          href={`/members/${key}`}
          className="ml-auto text-[11px] text-fg-muted transition-colors hover:text-fg"
        >
          멤버 상세 보기 →
        </Link>
      </div>

      {stats.error ? <ErrorState description={stats.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="방송 횟수"
          value={formatNumber(stats.data.broadcast_count)}
          unit="회"
          icon={<Radio className="size-3.5" />}
        />
        <StatCard
          label="누적 방송시간"
          value={formatHours(stats.data.total_duration_seconds)}
          icon={<Clock className="size-3.5" />}
        />
        <StatCard
          label="평균 시청자"
          value={formatNumber(stats.data.avg_viewers)}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="최고 시청자"
          value={formatNumber(stats.data.peak_viewers)}
          tone="accent"
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          label="총 조회수"
          value={formatNumber(stats.data.total_views)}
          icon={<Eye className="size-3.5" />}
        />
        <StatCard
          label="캐치"
          value={formatNumber(stats.data.catch_count)}
          unit="개"
          icon={<Scissors className="size-3.5" />}
        />
      </div>

      <Section title="일별 추이" description="방송시간 · 평균/최고 시청자">
        <Card>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <EmptyState title="선택한 기간에 방송 기록이 없습니다" className="border-0" />
            ) : (
              <DailySeriesChart data={chartData} />
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="월별 종합" description="방송이 있었던 달만 표시합니다">
        {monthlyRows.length === 0 ? (
          <EmptyState title="집계할 방송 기록이 없습니다" />
        ) : (
          <TableWrap>
            <Table className="min-w-[560px]">
              <thead>
                <tr>
                  <Th>월</Th>
                  <Th className="text-right">방송일</Th>
                  <Th className="text-right">방송</Th>
                  <Th className="text-right">방송시간</Th>
                  <Th className="text-right">평균 시청자</Th>
                  <Th className="text-right">최고 시청자</Th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <Tr key={row.monthKey}>
                    <Td>
                      <Link
                        href={`/calendar/${row.year}/${String(row.month).padStart(2, "0")}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                      >
                        {row.year}년 {row.month}월
                      </Link>
                    </Td>
                    <Td className="tnum text-right">{formatNumber(row.activeDays)}일</Td>
                    <Td className="tnum text-right">{formatNumber(row.broadcastCount)}회</Td>
                    <Td className="tnum text-right">
                      {formatDurationShort(row.durationSeconds)}
                    </Td>
                    <Td className="tnum text-right">{formatNumber(row.avgViewers)}</Td>
                    <Td className="tnum text-right">{formatNumber(row.peakViewers)}</Td>
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
