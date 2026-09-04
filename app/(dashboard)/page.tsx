import Link from "next/link";
import { CalendarDays, Clock, Eye, Radio, Users } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/section";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { LiveBroadcastCard } from "@/components/broadcasts/live-broadcast-card";
import { BroadcastListItem } from "@/components/broadcasts/broadcast-list-item";
import { CatchCard } from "@/components/catches/catch-card";
import { NoticeCard } from "@/components/notices/notice-card";
import { ViewerAreaChart } from "@/components/charts/viewer-area-chart";
import { Card, CardContent } from "@/components/ui/card";

import { getDailySummary, getViewerSeriesForDate } from "@/lib/queries/analytics";
import { getLiveBroadcasts, getRecentBroadcasts } from "@/lib/queries/broadcasts";
import { getRecentCatches } from "@/lib/queries/catches";
import { getRecentNotices } from "@/lib/queries/notices";
import { todayKey } from "@/lib/utils/dates";
import { formatDuration, formatNumber } from "@/lib/utils/format";

export const metadata = { title: "대시보드" };

export default async function DashboardPage() {
  const date = todayKey();

  const [summary, live, series, recent, catches, notices] = await Promise.all([
    getDailySummary(date),
    getLiveBroadcasts(),
    getViewerSeriesForDate(date),
    getRecentBroadcasts(10),
    getRecentCatches(6),
    getRecentNotices(5),
  ]);

  if (summary.notConfigured) {
    return (
      <>
        <PageTitle date={date} />
        <SetupNotice />
      </>
    );
  }

  const chartData = series.data.map((p) => ({ t: p.bucket, viewers: p.total_viewers }));

  return (
    <>
      <PageTitle date={date} />

      {/* 오늘의 요약 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="오늘 방송"
          value={formatNumber(summary.data.broadcast_count)}
          unit="회"
          hint={`멤버 ${summary.data.member_count}명`}
          icon={<Radio className="size-3.5" />}
        />
        <StatCard
          label="총 방송시간"
          value={formatDuration(summary.data.total_duration_seconds)}
          icon={<Clock className="size-3.5" />}
        />
        <StatCard
          label="최고 동시 시청자"
          value={formatNumber(summary.data.peak_viewers)}
          hint={`평균 ${formatNumber(summary.data.avg_viewers)}명`}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="현재 LIVE"
          value={formatNumber(live.data.length)}
          unit="명"
          tone={live.data.length > 0 ? "live" : "neutral"}
          icon={<Eye className="size-3.5" />}
        />
      </div>

      {summary.error ? <ErrorState description={summary.error} /> : null}

      {/* LIVE NOW */}
      <Section title="LIVE NOW" description="현재 방송 중인 멤버" href="/broadcasts">
        {live.data.length === 0 ? (
          <EmptyState title="현재 방송 중인 멤버가 없습니다" icon={<Radio className="size-5" />} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {live.data.map((b) => (
              <LiveBroadcastCard key={b.id} broadcast={b} />
            ))}
          </div>
        )}
      </Section>

      {/* 오늘 시청자 추이 */}
      <Section title="오늘 시청자 추이" description="전 멤버 합산 · 5분 간격">
        <Card>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <EmptyState
                title="오늘 수집된 시청자 데이터가 없습니다"
                description="방송이 시작되면 자동으로 기록됩니다."
                className="border-0"
              />
            ) : (
              <ViewerAreaChart data={chartData} label="합산 시청자" />
            )}
          </CardContent>
        </Card>
      </Section>

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        {/* 최근 방송 */}
        <Section title="최근 방송" href="/broadcasts">
          {recent.data.length === 0 ? (
            <EmptyState title="방송 기록이 없습니다" />
          ) : (
            <div className="space-y-2">
              {recent.data.map((b) => (
                <BroadcastListItem key={b.id} broadcast={b} />
              ))}
            </div>
          )}
        </Section>

        {/* 최근 공지 */}
        <Section title="최근 공지" href="/notices">
          {notices.data.length === 0 ? (
            <EmptyState title="공지가 없습니다" />
          ) : (
            <div className="space-y-2">
              {notices.data.map((n) => (
                <NoticeCard key={n.id} notice={n} />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* 최근 캐치 */}
      <Section title="최근 캐치" href="/catches">
        {catches.data.length === 0 ? (
          <EmptyState title="캐치가 없습니다" />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {catches.data.map((c) => (
              <CatchCard key={c.id} item={c} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function PageTitle({ date }: { date: string }) {
  const [y, m, d] = date.split("-");
  return (
    <div className="flex flex-col gap-1 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">TODAY</h1>
        <p className="tnum mt-0.5 text-xs text-fg-muted">
          {y}년 {Number(m)}월 {Number(d)}일 · KST 기준
        </p>
      </div>
      <Link
        href={`/calendar/${y}/${m}/${d}`}
        className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg sm:self-auto"
      >
        <CalendarDays className="size-3.5" />
        오늘의 아카이브
      </Link>
    </div>
  );
}
