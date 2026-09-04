import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Clock, Megaphone, Radio, Scissors, TrendingUp, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { BroadcastListItem } from "@/components/broadcasts/broadcast-list-item";
import { CatchCard } from "@/components/catches/catch-card";
import { NoticeCard } from "@/components/notices/notice-card";

import { getBroadcastsForDate } from "@/lib/queries/broadcasts";
import { getCatchesForBroadcastIds } from "@/lib/queries/catches";
import { getNoticesForDate } from "@/lib/queries/notices";
import { getDailySummary } from "@/lib/queries/analytics";
import { addDaysToKey, isValidDateKey } from "@/lib/utils/dates";
import { formatDuration, formatDurationShort, formatNumber } from "@/lib/utils/format";

interface Props {
  params: Promise<{ year: string; month: string; day: string }>;
}

function toKey(p: { year: string; month: string; day: string }) {
  return `${p.year}-${p.month.padStart(2, "0")}-${p.day.padStart(2, "0")}`;
}

export async function generateMetadata({ params }: Props) {
  const p = await params;
  return { title: `${toKey(p)} 아카이브` };
}

export default async function DailyArchivePage({ params }: Props) {
  const p = await params;
  const dateKey = toKey(p);
  if (!isValidDateKey(dateKey)) notFound();

  const [summary, broadcasts, notices] = await Promise.all([
    getDailySummary(dateKey),
    getBroadcastsForDate(dateKey),
    getNoticesForDate(dateKey),
  ]);

  if (summary.notConfigured) {
    return (
      <>
        <PageHeader title={dateKey.replace(/-/g, ".")} />
        <SetupNotice />
      </>
    );
  }

  const catches = await getCatchesForBroadcastIds(broadcasts.data.map((b) => b.id));

  // 멤버별 그룹핑
  const byMember = new Map<
    string,
    { name: string; slug: string; imageUrl: string | null; color: string | null; rows: typeof broadcasts.data }
  >();
  for (const b of broadcasts.data) {
    const key = b.member_id;
    const entry = byMember.get(key) ?? {
      name: b.member?.name ?? "알 수 없음",
      slug: b.member?.slug ?? b.member_id,
      imageUrl: b.member?.profile_image_url ?? null,
      color: b.member?.color ?? null,
      rows: [] as typeof broadcasts.data,
    };
    entry.rows.push(b);
    byMember.set(key, entry);
  }

  const performance = Array.from(byMember.entries())
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      slug: entry.slug,
      duration: entry.rows.reduce((s, b) => s + (b.duration_seconds ?? 0), 0),
      peak: Math.max(0, ...entry.rows.map((b) => b.peak_viewers)),
    }))
    .sort((a, b) => b.duration - a.duration);
  const maxDuration = Math.max(1, ...performance.map((x) => x.duration));

  const prev = addDaysToKey(dateKey, -1);
  const next = addDaysToKey(dateKey, 1);
  const hrefFor = (key: string) => `/calendar/${key.slice(0, 4)}/${key.slice(5, 7)}/${key.slice(8, 10)}`;

  return (
    <>
      <PageHeader
        title={<span className="tnum">{dateKey.replace(/-/g, ".")}</span>}
        description="HADES DAILY · 그날 하데스 멤버들에게 일어난 모든 데이터"
        actions={
          <div className="flex items-center gap-1">
            <Link
              href={hrefFor(prev)}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              <ChevronLeft className="size-3.5" />
              이전
            </Link>
            <Link
              href={`/calendar/${p.year}/${p.month.padStart(2, "0")}`}
              className="rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              이 달 종합
            </Link>
            <Link
              href="/calendar"
              className="rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              캘린더
            </Link>
            <Link
              href={hrefFor(next)}
              className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface/60 px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              다음
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        }
      />

      {summary.error ? <ErrorState description={summary.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="방송"
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
          label="최고 동시시청자"
          value={formatNumber(summary.data.peak_viewers)}
          tone="accent"
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          label="평균 시청자"
          value={formatNumber(summary.data.avg_viewers)}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="캐치"
          value={formatNumber(summary.data.catch_count)}
          icon={<Scissors className="size-3.5" />}
        />
      </div>

      <Section title="오늘 방송한 멤버" description={`${byMember.size}명`}>
        {broadcasts.data.length === 0 ? (
          <EmptyState title="이 날짜에 방송 기록이 없습니다" icon={<Radio className="size-5" />} />
        ) : (
          <div className="space-y-4">
            {Array.from(byMember.entries()).map(([id, entry]) => (
              <div key={id} className="space-y-2">
                <Link
                  href={`/members/${entry.slug}`}
                  className="inline-flex items-center gap-2 text-[13px] font-medium text-fg transition-colors hover:text-accent"
                >
                  <MemberAvatar
                    name={entry.name}
                    imageUrl={entry.imageUrl}
                    color={entry.color}
                    size="sm"
                  />
                  {entry.name}
                  <span className="tnum text-[11px] font-normal text-fg-dim">
                    {entry.rows.length}회 ·{" "}
                    {formatDurationShort(
                      entry.rows.reduce((s, b) => s + (b.duration_seconds ?? 0), 0)
                    )}
                  </span>
                </Link>
                <div className="space-y-2">
                  {entry.rows.map((b) => (
                    <BroadcastListItem
                      key={b.id}
                      broadcast={b}
                      showMember={false}
                      showDate={false}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {performance.length > 0 ? (
        <Section title="멤버 퍼포먼스" description="방송시간 기준">
          <Card>
            <CardContent className="space-y-2.5 pt-4">
              {performance.map((row) => (
                <div key={row.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <Link href={`/members/${row.slug}`} className="text-fg-muted hover:text-fg">
                      {row.name}
                    </Link>
                    <span className="tnum text-fg">
                      {formatDurationShort(row.duration)} · 최고 {formatNumber(row.peak)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${(row.duration / maxDuration) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </Section>
      ) : null}

      <Section title={`오늘의 캐치 ${catches.data.length}개`} href="/catches">
        {catches.data.length === 0 ? (
          <EmptyState title="캐치가 없습니다" />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {catches.data.slice(0, 12).map((c) => (
              <CatchCard key={c.id} item={c} />
            ))}
          </div>
        )}
      </Section>

      <Section title="오늘의 공지" href="/notices">
        {notices.data.length === 0 ? (
          <EmptyState title="공지가 없습니다" icon={<Megaphone className="size-5" />} />
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {notices.data.map((n) => (
              <NoticeCard key={n.id} notice={n} />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
