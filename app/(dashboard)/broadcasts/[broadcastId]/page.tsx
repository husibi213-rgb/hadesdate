import { SmartLink } from "@/components/ui/smart-link";
import { notFound } from "next/navigation";
import { ExternalLink, Eye, Heart, TrendingUp, UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { LiveBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Section } from "@/components/ui/section";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { CatchCard } from "@/components/catches/catch-card";
import { NoticeCard } from "@/components/notices/notice-card";
import { ViewerAreaChart } from "@/components/charts/viewer-area-chart";

import {
  getBroadcast,
  getViewerSnapshots,
} from "@/lib/queries/broadcasts";
import { getCatchesForBroadcast } from "@/lib/queries/catches";
import { getRelatedNotices } from "@/lib/queries/notices";
import { formatDate, formatTime } from "@/lib/utils/dates";
import { formatDuration, formatNumber } from "@/lib/utils/format";

interface Props {
  params: Promise<{ broadcastId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { broadcastId } = await params;
  const result = await getBroadcast(broadcastId);
  const b = result.data;
  if (!b) return { title: "방송" };
  return { title: `${b.member?.name ?? "방송"} · ${formatDate(b.started_at)}` };
}

export default async function BroadcastDetailPage({ params }: Props) {
  const { broadcastId } = await params;

  const result = await getBroadcast(broadcastId);
  if (result.notConfigured) {
    return (
      <>
        <PageHeader title="방송" />
        <SetupNotice />
      </>
    );
  }
  const broadcast = result.data;
  if (!broadcast) notFound();

  const [snapshots, catches, notices] = await Promise.all([
    getViewerSnapshots(broadcast.id),
    getCatchesForBroadcast(broadcast.id),
    getRelatedNotices(broadcast.member_id, broadcast.broadcast_date),
  ]);

  const isLive = broadcast.status === "live";
  const chartData = snapshots.data.map((s) => ({ t: s.recorded_at, viewers: s.viewers }));
  const [yy, mm, dd] = broadcast.broadcast_date.split("-");

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <MemberAvatar
              name={broadcast.member?.name ?? "?"}
              imageUrl={broadcast.member?.profile_image_url}
              color={broadcast.member?.color}
              size="lg"
            />
            <span className="min-w-0">
              <span className="block truncate">{broadcast.title ?? "제목 없음"}</span>
              <span className="mt-0.5 flex items-center gap-2 text-xs font-normal text-fg-muted">
                {broadcast.member ? (
                  <SmartLink
                    href={`/members/${broadcast.member.slug ?? broadcast.member.id}`}
                    className="transition-colors hover:text-fg"
                  >
                    {broadcast.member.name}
                  </SmartLink>
                ) : null}
                {isLive ? <LiveBadge /> : null}
              </span>
            </span>
          </span>
        }
        description={
          <span className="tnum">
            <SmartLink href={`/calendar/${yy}/${mm}/${dd}`} className="hover:text-fg">
              {formatDate(broadcast.started_at)}
            </SmartLink>{" "}
            · {formatTime(broadcast.started_at)}
            {broadcast.ended_at ? ` ~ ${formatTime(broadcast.ended_at)}` : " ~ 진행 중"} ·{" "}
            {formatDuration(broadcast.duration_seconds)}
          </span>
        }
        actions={
          broadcast.vod_url ? (
            <SmartLink
              href={broadcast.vod_url}
              external
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              VOD 보기
              <ExternalLink className="size-3" />
            </SmartLink>
          ) : null
        }
      />

      {result.error ? <ErrorState description={result.error} /> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="평균 시청자"
          value={formatNumber(broadcast.avg_viewers)}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="최고 시청자"
          value={formatNumber(broadcast.peak_viewers)}
          tone="accent"
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          label="조회수"
          value={formatNumber(broadcast.views)}
          icon={<Eye className="size-3.5" />}
        />
        <StatCard
          label="팔로워 증가"
          value={`+${formatNumber(broadcast.followers_gained)}`}
          tone={broadcast.followers_gained > 0 ? "up" : "neutral"}
          icon={<UserPlus className="size-3.5" />}
        />
      </div>

      <Section title="시청자 변화" description="viewer_snapshots 기준">
        <Card>
          <CardContent className="pt-4">
            {chartData.length === 0 ? (
              <EmptyState title="시청자 스냅샷이 없습니다" className="border-0" />
            ) : (
              <ViewerAreaChart data={chartData} height={260} />
            )}
          </CardContent>
        </Card>
      </Section>

      <Section
        title={`이 방송의 캐치 ${catches.data.length}개`}
        href={broadcast.member ? `/catches?member=${broadcast.member.slug ?? broadcast.member.id}` : undefined}
      >
        {catches.data.length === 0 ? (
          <EmptyState title="캐치가 없습니다" icon={<Heart className="size-5" />} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {catches.data.map((c) => (
              <CatchCard key={c.id} item={c} />
            ))}
          </div>
        )}
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section title="관련 공지" href="/notices">
          {notices.data.length === 0 ? (
            <EmptyState title="관련 공지가 없습니다" />
          ) : (
            <div className="space-y-2">
              {notices.data.map((n) => (
                <NoticeCard key={n.id} notice={n} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
