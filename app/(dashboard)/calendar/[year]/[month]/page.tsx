import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Megaphone,
  MousePointerClick,
  Radio,
  Scissors,
  TrendingUp,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { MemberMonthCard } from "@/components/members/member-month-card";
import { BroadcastCalendar } from "@/components/members/broadcast-calendar";
import { CatchCard } from "@/components/catches/catch-card";
import { DailySeriesChart } from "@/components/charts/daily-series-chart";

import { getDailyTotals, getMonthSummary, getMonthlyTotals } from "@/lib/queries/analytics";
import { getMembers, getMemberStats } from "@/lib/queries/members";
import { getTopCatches } from "@/lib/queries/catches";
import { formatDuration, formatDurationShort, formatNumber } from "@/lib/utils/format";

interface Props {
  params: Promise<{ year: string; month: string }>;
}

function monthBounds(year: number, month: number) {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export async function generateMetadata({ params }: Props) {
  const { year, month } = await params;
  return { title: `${year}년 ${Number(month)}월 종합` };
}

export default async function MonthlyArchivePage({ params }: Props) {
  const p = await params;
  const year = Number(p.year);
  const month = Number(p.month);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    notFound();
  }

  const { from, to } = monthBounds(year, month);

  const [summary, daily, members, topCatches, trend] = await Promise.all([
    getMonthSummary(from, to),
    getDailyTotals(from, to),
    getMembers(),
    getTopCatches(from, to, 12),
    // 최근 12개월 추이
    getMonthlyTotals(`${year - 1}-${String(month).padStart(2, "0")}-01`, to),
  ]);

  // 멤버별 그 달 기록 (비교표 대신 각자 카드로 보여준다)
  const memberMonth = await Promise.all(
    members.data.map(async (member) => ({
      member,
      stats: (await getMemberStats(member.id, from, to)).data,
    }))
  );

  if (summary.notConfigured) {
    return (
      <>
        <PageHeader title={`${year}년 ${month}월`} />
        <SetupNotice />
      </>
    );
  }

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const href = (y: number, m: number) => `/calendar/${y}/${String(m).padStart(2, "0")}`;

  const chartData = daily.data.map((d) => ({
    date: d.stat_date,
    hours: Math.round((d.duration_seconds / 3600) * 10) / 10,
    avgViewers: d.avg_viewers,
    peakViewers: d.peak_viewers,
  }));

  const calendarDays = daily.data
    .filter((d) => d.broadcast_count > 0)
    .map((d) => ({
      dateKey: d.stat_date,
      broadcastCount: d.broadcast_count,
      durationSeconds: d.duration_seconds,
      peakViewers: d.peak_viewers,
    }));

  // 전월 대비
  const trendRows = trend.data;
  const thisMonthKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const thisIndex = trendRows.findIndex((r) => r.month_start.startsWith(thisMonthKey.slice(0, 7)));
  const prevRow = thisIndex > 0 ? trendRows[thisIndex - 1] : null;
  const deltaHours =
    prevRow && prevRow.duration_seconds > 0
      ? ((summary.data.total_duration_seconds - prevRow.duration_seconds) /
          prevRow.duration_seconds) *
        100
      : null;

  return (
    <>
      <PageHeader
        title={
          <span className="tnum">
            {year}년 {month}월
          </span>
        }
        description="HADES MONTHLY · 한 달 전체 종합"
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={href(prev.y, prev.m)}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <ChevronLeft className="size-3.5" />
              이전 달
            </Link>
            <Link
              href={`/calendar?y=${year}&m=${month}`}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <CalendarDays className="size-3.5" />
              캘린더
            </Link>
            <Link
              href={href(next.y, next.m)}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              다음 달
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        }
      />

      {summary.error ? <ErrorState description={summary.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="방송일"
          value={formatNumber(summary.data.active_days)}
          unit="일"
          hint={`멤버 ${summary.data.member_count}명`}
          icon={<CalendarDays className="size-3.5" />}
        />
        <StatCard
          label="방송 수"
          value={formatNumber(summary.data.broadcast_count)}
          unit="회"
          icon={<Radio className="size-3.5" />}
        />
        <StatCard
          label="총 방송시간"
          value={formatDuration(summary.data.total_duration_seconds)}
          hint={
            deltaHours === null ? undefined : (
              <span className={deltaHours >= 0 ? "text-up" : "text-down"}>
                전월 대비 {deltaHours >= 0 ? "+" : ""}
                {deltaHours.toFixed(1)}%
              </span>
            )
          }
          icon={<Clock className="size-3.5" />}
        />
        <StatCard
          label="평균 시청자"
          value={formatNumber(summary.data.avg_viewers)}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="최고 동시시청자"
          value={formatNumber(summary.data.peak_viewers)}
          tone="accent"
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          label="캐치"
          value={formatNumber(summary.data.catch_count)}
          unit="개"
          icon={<Scissors className="size-3.5" />}
        />
        <StatCard
          label="클릭"
          value={formatNumber(summary.data.click_count)}
          hint={`공지 ${summary.data.notice_count}건`}
          icon={<MousePointerClick className="size-3.5" />}
        />
      </div>

      <Section title="일별 추이" description="방송시간(막대) · 평균/최고 시청자(선)">
        <Card>
          <CardContent className="pt-4">
            {chartData.every((d) => d.hours === 0) ? (
              <EmptyState title="이 달에 방송 기록이 없습니다" className="border-0" />
            ) : (
              <DailySeriesChart data={chartData} height={280} />
            )}
          </CardContent>
        </Card>
      </Section>

      <div className="grid gap-8 xl:grid-cols-[1fr_1.3fr]">
        <Section title="방송 캘린더" description="날짜를 누르면 그날의 아카이브로 이동합니다">
          <BroadcastCalendar
            year={year}
            month={month}
            days={calendarDays}
            hrefForDate={(key) => {
              const [yy, mm, dd] = key.split("-");
              return `/calendar/${yy}/${mm}/${dd}`;
            }}
            hrefForMonth={(yy, mm) => href(yy, mm)}
          />
        </Section>

        <Section title="월별 추이" description="최근 13개월">
          <Card>
            <CardContent className="space-y-2 pt-4">
              {trendRows.length === 0 ? (
                <EmptyState title="데이터가 없습니다" className="border-0" />
              ) : (
                trendRows
                  .slice()
                  .reverse()
                  .map((row) => {
                    const max = Math.max(1, ...trendRows.map((r) => r.duration_seconds));
                    const label = row.month_start.slice(0, 7).replace("-", ".");
                    const isCurrent = row.month_start.slice(0, 7) === thisMonthKey.slice(0, 7);
                    return (
                      <div key={row.month_start} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <Link
                            href={href(
                              Number(row.month_start.slice(0, 4)),
                              Number(row.month_start.slice(5, 7))
                            )}
                            className={
                              isCurrent
                                ? "tnum font-medium text-fg"
                                : "tnum text-fg-muted transition-colors hover:text-fg"
                            }
                          >
                            {label}
                          </Link>
                          <span className="tnum text-fg-muted">
                            {formatDurationShort(row.duration_seconds)} · {row.broadcast_count}회
                            {row.catch_count > 0 ? ` · 캐치 ${row.catch_count}` : ""}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={isCurrent ? "h-full rounded-full bg-accent" : "h-full rounded-full bg-accent/45"}
                            style={{ width: `${(row.duration_seconds / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              )}
            </CardContent>
          </Card>
        </Section>
      </div>

      <Section
        title="멤버별 기록"
        description={`${year}년 ${month}월 · 카드를 누르면 해당 멤버 상세로 이동합니다`}
      >
        {memberMonth.length === 0 ? (
          <EmptyState title="등록된 멤버가 없습니다" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {memberMonth.map(({ member, stats }) => (
              <MemberMonthCard
                key={member.id}
                member={member}
                stats={stats}
                year={year}
                month={month}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="이 달 인기 캐치" description="조회수 상위" href="/catches">
        {topCatches.data.length === 0 ? (
          <EmptyState title="캐치가 없습니다" icon={<Megaphone className="size-5" />} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {topCatches.data.map((item) => (
              <CatchCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
