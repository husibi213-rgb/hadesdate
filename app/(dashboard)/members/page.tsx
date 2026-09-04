import { Users } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { MemberCard } from "@/components/members/member-card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SetupNotice } from "@/components/ui/setup-notice";

import { getMembers } from "@/lib/queries/members";
import { getLiveBroadcasts } from "@/lib/queries/broadcasts";

export const metadata = { title: "멤버" };

/**
 * 멤버 목록 = 멤버를 고르는 화면.
 * 수치는 여기서 나란히 보여주지 않고, 각 멤버 상세에서 본다.
 */
export default async function MembersPage() {
  const [members, live] = await Promise.all([getMembers(), getLiveBroadcasts()]);

  if (members.notConfigured) {
    return (
      <>
        <PageHeader title="멤버" />
        <SetupNotice />
      </>
    );
  }

  const liveMemberIds = new Set(live.data.map((b) => b.member_id));

  return (
    <>
      <PageHeader
        title="멤버"
        description={`하데스 멤버 ${members.data.length}명 · 멤버를 선택하면 방송 기록과 통계를 볼 수 있습니다`}
      />

      {members.error ? <ErrorState description={members.error} /> : null}

      {members.data.length === 0 ? (
        <EmptyState
          title="등록된 멤버가 없습니다"
          description="Supabase members 테이블에 멤버를 추가해 주세요."
          icon={<Users className="size-5" />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {members.data.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isLive={liveMemberIds.has(member.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
