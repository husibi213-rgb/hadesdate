import { Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MemberCard } from "@/components/members/member-card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";
import { FilterTabs } from "@/components/ui/filter-tabs";

import { getMembers } from "@/lib/queries/members";
import { getMemberComparison } from "@/lib/queries/analytics";
import { getLiveBroadcasts } from "@/lib/queries/broadcasts";
import { buildPeriodTabs, periodRange } from "@/lib/utils/period";

export const metadata = { title: "멤버" };

export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const range = periodRange(period);

  const [members, comparison, live] = await Promise.all([
    getMembers(),
    getMemberComparison(range.from, range.to),
    getLiveBroadcasts(),
  ]);

  if (members.notConfigured) {
    return (
      <>
        <PageHeader title="멤버" />
        <SetupNotice />
      </>
    );
  }

  const statsByMember = new Map(comparison.data.map((row) => [row.member_id, row]));
  const liveMemberIds = new Set(live.data.map((b) => b.member_id));

  return (
    <>
      <PageHeader
        title="멤버"
        description={`하데스 멤버 ${members.data.length}명 · ${range.label} 기준 통계`}
        actions={<FilterTabs items={buildPeriodTabs("/members", range.key)} activeKey={range.key} />}
      />

      {members.error ? <ErrorState description={members.error} /> : null}

      {members.data.length === 0 ? (
        <EmptyState
          title="등록된 멤버가 없습니다"
          description="Supabase members 테이블에 멤버를 추가해 주세요."
          icon={<Users className="size-5" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {members.data.map((member) => {
            const stats = statsByMember.get(member.id);
            return (
              <MemberCard
                key={member.id}
                member={member}
                isLive={liveMemberIds.has(member.id)}
                stats={{
                  broadcastCount: stats?.broadcast_count ?? 0,
                  totalDurationSeconds: stats?.total_duration_seconds ?? 0,
                  avgViewers: stats?.avg_viewers ?? 0,
                  peakViewers: stats?.peak_viewers ?? 0,
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
