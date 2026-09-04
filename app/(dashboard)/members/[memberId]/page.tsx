import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Eye, Radio, Scissors, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { BroadcastListItem } from "@/components/broadcasts/broadcast-list-item";
import { BroadcastCalendar } from "@/components/members/broadcast-calendar";
import { DailySeriesChart } from "@/components/charts/daily-series-chart";
import { Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

import { getMember, getMemberDailySeries, getMemberStats } from "@/lib/queries/members";
import { getBroadcastsPage } from "@/lib/queries/broadcasts";
import { buildPeriodTabs, chartRange, periodRange } from "@/lib/utils/period";
import { todayKey } from "@/lib/utils/dates";
import { groupMemberSeriesByMonth } from "@/lib/utils/monthly";
import { formatDurationShort, formatHours, formatNumber } from "@/lib/utils/format";

interface Props {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ period?: string; y?: string; m?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { memberId } = await params;
  const member = await getMember(memberId);
  return { title: member.data?.name ?? "멤버" };
}

export default async function MemberDetailPage({ params, searchParams }: Props) {
  const { memberId } = await params;
  const { period, y, m } = await searchParams;

  const memberResult = await getMember(memberId);
  if (memberResult.notConfigured) {
    return (
      <>
        <PageHeader title="멤버" />
        <SetupNotice />
      </>
    );
  }
  const member = memberResult.data;
  if (!member) notFound();

  const range = periodRange(period);
  const chart = chartRange(range, 365);
  const slug = member.slug ?? member.id;
  const basePath = `/members/${slug}`;

  // 캘린더에 표시할 월 (기본: 이번 달)
  const today = todayKey();
  const calYear = Number(y) || Number(today.slice(0, 4));
  const calMonth = Number(m) || Number(today.slice(5, 7));
  const calFrom = `${calYear}-${String(calMonth).padStart(2, "0")}-01`;
  const calTo = `${calYear}-${String(calMonth).padStart(2, "0")}-31`;

  const [stats, series, calendarSeries, broadcasts] = await Promise.all([
    getMemberStats(member.id, range.from, range.to),
    getMemberDailySeries(member.id, chart.from, chart.to),
    getMemberDailySeries(member.id, calFrom, calTo),
    getBroadcastsPage({ memberId: member.id, pageSize: 10 }),
  ]);

  const chartData = series.data.map((p) => ({
    date: p.stat_date,
    hours: Math.round((p.duration_seconds / 3600) * 10) / 10,
    avgViewers: p.avg_viewers,
    peakViewers: p.peak_viewers,
  }));

  // 통계 페이지를 없애면서 월별 종합을 여기로 옮겨 왔다.
  const monthlyRows = groupMemberSeriesByMonth(series.data).filter(
    (row) => row.broadcastCount > 0
  );

  const calendarDays = calendarSeries.data.map((p) => ({
    dateKey: p.stat_date,
    broadcastCount: p.broadcast_count,
    durationSeconds: p.duration_seconds,
    peakViewers: p.peak_viewers,
  }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <MemberAvatar
              name={member.name}
              imageUrl={member.profile_image_url}
              color={member.color}
              size="lg"
            />
            {member.name}
          </span>
        }
        description={
          <span className="tnum">
            방송 {formatNumber(stats.data.broadcast_count)}회 · 누적{" "}
            {formatHours(stats.data.total_duration_seconds)} · {range.label} 기준
          </span>
        }
        actions={
          <FilterTabs items={buildPeriodTabs(basePath, range.key)} activeKey={range.key} />
        }
      />

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
          label="총 캐치"
          value={formatNumber(stats.data.catch_count)}
          unit="개"
          icon={<Scissors className="size-3.5" />}
        />
      </div>

      <Section title="방송 추이" description="일별 방송시간 · 평균/최고 시청자">
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
                        href={`${basePath}?period=${range.key}&y=${row.year}&m=${String(row.month).padStart(2, "0")}`}
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

      <div className="grid gap-8 xl:grid-cols-[1fr_1.3fr]">
        <Section title="방송 캘린더" description="날짜를 누르면 그날의 전체 데이터로 이동합니다">
          <BroadcastCalendar
            year={calYear}
            month={calMonth}
            days={calendarDays}
            hrefForDate={(key) => {
              const [yy, mm, dd] = key.split("-");
              return `/calendar/${yy}/${mm}/${dd}`;
            }}
            hrefForMonth={(yy, mm) => `${basePath}?period=${range.key}&y=${yy}&m=${mm}`}
          />
        </Section>

        <Section title="최근 방송" href={`/broadcasts?member=${slug}`}>
          {broadcasts.data.rows.length === 0 ? (
            <EmptyState title="방송 기록이 없습니다" />
          ) : (
            <div className="space-y-2">
              {broadcasts.data.rows.map((b) => (
                <BroadcastListItem key={b.id} broadcast={b} showMember={false} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
