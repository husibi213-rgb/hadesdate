import type { MemberRow } from "@/types/database";
import type { FilterTabItem } from "@/components/ui/filter-tabs";

/**
 * 멤버 선택 유틸.
 *
 * 이 사이트는 "전체 멤버 비교" 대신 "한 멤버씩 보기" 구조라서,
 * 통계 / 클릭처럼 한 명을 골라야 하는 페이지가 여럿이다.
 * 선택 규칙(URL 파라미터 -> slug -> id -> 첫 멤버)을 한 곳에 모아 둔다.
 */

/** 멤버를 고유하게 가리키는 값. slug 가 없으면 id 로 떨어진다. */
export function memberKey(member: MemberRow): string {
  return member.slug ?? member.id;
}

/**
 * URL 파라미터로 멤버를 고른다.
 * 값이 없거나 못 찾으면 첫 번째 멤버로 떨어뜨린다 (빈 화면을 피하기 위해).
 * 멤버가 하나도 없으면 null.
 */
export function resolveMember(
  members: MemberRow[],
  value: string | undefined | null
): MemberRow | null {
  if (members.length === 0) return null;
  if (!value) return members[0];
  return (
    members.find((m) => m.slug === value) ?? members.find((m) => m.id === value) ?? members[0]
  );
}

/** 멤버 선택 탭. 기간 등 다른 필터는 query 로 함께 유지한다. */
export function buildMemberTabs(
  basePath: string,
  members: MemberRow[],
  extraQuery?: string
): FilterTabItem[] {
  return members.map((member) => {
    const key = memberKey(member);
    return {
      key,
      label: member.name,
      href: `${basePath}?member=${encodeURIComponent(key)}${extraQuery ? `&${extraQuery}` : ""}`,
    };
  });
}
