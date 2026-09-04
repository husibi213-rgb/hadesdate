import Link from "next/link";
import { AlertTriangle, Database, History, Megaphone, Radio, RefreshCw, Scissors, Users } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import { getAdminOverview, getRecentErrorCount } from "@/lib/admin/queries";
import { loadAdmin } from "@/lib/admin/load";
import { triggerBackfill, triggerSync, triggerVods } from "@/lib/admin/actions";
import { LoginScreen } from "@/components/admin/login-screen";
import { Button, FormNotice, Input } from "@/components/admin/form";
import { ErrorState } from "@/components/ui/states";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils/dates";
import { formatNumber } from "@/lib/utils/format";

export const metadata = { title: "개요" };

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const gate = await adminGate();
  const sp = await searchParams;

  if (!gate.ok) return <LoginScreen reason={gate.reason} error={sp.error} />;

  const loaded = await loadAdmin(
    {
      members: 0,
      broadcasts: 0,
      liveBroadcasts: 0,
      viewerSnapshots: 0,
      catches: 0,
      notices: 0,
      lastSnapshotAt: null,
      lastBroadcastAt: null,
      snapshotAgeMinutes: null,
    },
    getAdminOverview
  );
  const overview = loaded.data;
  const snapshotAge = overview.snapshotAgeMinutes;
  const errorsLoaded = await loadAdmin(0, getRecentErrorCount);

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">개요</h1>
        <p className="text-xs text-fg-muted">데이터 현황과 수집 실행</p>
      </div>

      <FormNotice ok={sp.ok} error={sp.error} />

      {loaded.error ? (
        <ErrorState
          title="데이터를 불러오지 못했습니다"
          description={`${loaded.error} — Supabase 연결과 마이그레이션(001~006) 적용 여부를 확인해 주세요.`}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard
          label="멤버"
          value={formatNumber(overview.members)}
          icon={<Users className="size-3.5" />}
        />
        <StatCard
          label="방송"
          value={formatNumber(overview.broadcasts)}
          icon={<Radio className="size-3.5" />}
        />
        <StatCard
          label="LIVE"
          value={formatNumber(overview.liveBroadcasts)}
          tone={overview.liveBroadcasts > 0 ? "live" : "neutral"}
        />
        <StatCard
          label="시청자 스냅샷"
          value={formatNumber(overview.viewerSnapshots)}
          icon={<Database className="size-3.5" />}
        />
        <StatCard
          label="캐치"
          value={formatNumber(overview.catches)}
          icon={<Scissors className="size-3.5" />}
        />
        <StatCard
          label="공지"
          value={formatNumber(overview.notices)}
          icon={<Megaphone className="size-3.5" />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>수집 실행</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <form action={triggerSync}>
                <Button type="submit" className="inline-flex items-center gap-1.5">
                  <RefreshCw className="size-3.5" />
                  방송 상태 수집
                </Button>
              </form>
              <form action={triggerVods}>
                <Button variant="ghost" type="submit" className="inline-flex items-center gap-1.5">
                  <Scissors className="size-3.5" />
                  다시보기·클립·캐치 수집
                </Button>
              </form>
            </div>
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-fg-muted">
                <History className="size-3.5" />
                지난 방송 백필
              </div>
              <form action={triggerBackfill} className="flex flex-wrap items-center gap-2">
                <Input
                  type="date"
                  name="from"
                  defaultValue="2026-08-01"
                  required
                  className="w-auto"
                  aria-label="시작일"
                />
                <span className="text-xs text-fg-dim">~</span>
                <Input
                  type="date"
                  name="to"
                  defaultValue="2026-08-31"
                  required
                  className="w-auto"
                  aria-label="종료일"
                />
                <Button variant="ghost" type="submit">
                  백필 실행
                </Button>
              </form>
              <p className="text-[11px] leading-relaxed text-fg-dim">
                다시보기 목록으로 과거 방송 기록을 되살립니다. 방송 날짜·제목·방송시간·조회수는
                채워지지만, 평균/최고 시청자는 방송 중 스냅샷이 있어야만 알 수 있어 0 으로 남습니다.
                같은 구간을 다시 돌려도 이미 들어간 방송은 건너뜁니다.
              </p>
            </div>

            <p className="text-[11px] leading-relaxed text-fg-dim">
              여기서 한 번 돌려보고, 실제 운영에서는{" "}
              <code className="text-fg-muted">node scripts/collect.mjs</code> 를 스케줄러에
              걸어 두는 것을 권합니다. 방송 상태는 1~3분, 게시물 수집은 30분~1시간 간격이
              적당합니다.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>수집 상태</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Row
              label="마지막 시청자 스냅샷"
              value={
                overview.lastSnapshotAt
                  ? `${formatDateTime(overview.lastSnapshotAt)} (${snapshotAge}분 전)`
                  : "아직 없음"
              }
              tone={
                snapshotAge === null
                  ? "dim"
                  : overview.liveBroadcasts > 0 && snapshotAge > 10
                    ? "warn"
                    : "normal"
              }
            />
            <Row
              label="마지막 방송 시작"
              value={
                overview.lastBroadcastAt ? formatDateTime(overview.lastBroadcastAt) : "아직 없음"
              }
            />
            <Row
              label="최근 24시간 오류"
              value={errorsLoaded.data > 0 ? `${formatNumber(errorsLoaded.data)}회` : "없음"}
              tone={errorsLoaded.data > 0 ? "warn" : "dim"}
            />
            {errorsLoaded.data > 0 ? (
              <Link
                href="/admin/errors"
                className="inline-flex items-center gap-1 text-[11px] text-warn transition-colors hover:text-fg"
              >
                <AlertTriangle className="size-3" />
                오류 로그 보기
              </Link>
            ) : null}
            {overview.liveBroadcasts > 0 && snapshotAge !== null && snapshotAge > 10 ? (
              <p className="rounded-md border border-warn/40 bg-warn/5 px-2.5 py-2 text-[11px] text-warn">
                LIVE 방송이 있는데 스냅샷이 {snapshotAge}분째 갱신되지 않았습니다. 수집기가
                돌고 있는지 확인해 주세요.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { href: "/admin/members", label: "멤버 관리" },
          { href: "/admin/broadcasts", label: "방송 관리" },
          { href: "/admin/catches", label: "캐치 관리" },
          { href: "/admin/notices", label: "공지 관리" },
          { href: "/admin/errors", label: "오류 로그" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md border border-border bg-surface/60 px-3 py-1.5 font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn" | "dim";
}) {
  const toneClass = { normal: "text-fg", warn: "text-warn", dim: "text-fg-dim" }[tone];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-fg-muted">{label}</span>
      <span className={`tnum ${toneClass}`}>{value}</span>
    </div>
  );
}
