import "server-only";

import { createClient } from "@/lib/supabase/server";
import { guard, unwrap, type QueryResult } from "@/lib/queries/result";
import { CATCH_PAGE_SIZE, type CatchSortKey } from "@/lib/constants";
import type { CatchKind, CatchRow } from "@/types/database";
import type { MemberBrief } from "@/lib/queries/broadcasts";

const CATCH_FIELDS = `
  id, broadcast_id, member_id, title, description, catch_url, thumbnail_url,
  broadcast_timestamp, views, likes, external_id, published_at, created_at, catch_date, kind
`;

const WITH_MEMBER = `${CATCH_FIELDS}, member:members!inner(id, name, slug, profile_image_url, color)`;

export interface CatchWithMember extends CatchRow {
  member: MemberBrief | null;
}

const SORT_COLUMN: Record<CatchSortKey, { column: string; ascending: boolean }> = {
  recent: { column: "catch_date", ascending: false },
  views: { column: "views", ascending: false },
  likes: { column: "likes", ascending: false },
};

export interface CatchListParams {
  page?: number;
  pageSize?: number;
  memberId?: string | null;
  sort?: CatchSortKey;
  from?: string | null;
  to?: string | null;
  /** 캐치 / 유저클립 구분. 없으면 종류를 가리지 않는다. */
  kind?: CatchKind | null;
}

export interface CatchPage {
  rows: CatchWithMember[];
  hasNext: boolean;
}

export async function getCatchesPage(
  params: CatchListParams = {}
): Promise<QueryResult<CatchPage>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? CATCH_PAGE_SIZE;
  const sort = SORT_COLUMN[params.sort ?? "recent"];

  return guard<CatchPage>({ rows: [], hasNext: false }, async () => {
    const supabase = await createClient();
    let query = supabase
      .from("catches")
      .select(WITH_MEMBER)
      .order(sort.column, { ascending: sort.ascending, nullsFirst: false })
      .range((page - 1) * pageSize, page * pageSize);

    if (params.kind) query = query.eq("kind", params.kind);
    if (params.memberId) query = query.eq("member_id", params.memberId);
    if (params.from) query = query.gte("catch_date", params.from);
    if (params.to) query = query.lte("catch_date", params.to);

    const rows = unwrap<CatchWithMember[]>(await query);
    return { rows: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
  });
}

export async function getRecentCatches(limit = 6): Promise<QueryResult<CatchWithMember[]>> {
  return guard<CatchWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("catches")
        .select(WITH_MEMBER)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit)
    );
  });
}

export async function getCatchesForBroadcast(
  broadcastId: string
): Promise<QueryResult<CatchWithMember[]>> {
  return guard<CatchWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("catches")
        .select(WITH_MEMBER)
        .eq("broadcast_id", broadcastId)
        .order("broadcast_timestamp", { ascending: true, nullsFirst: false })
    );
  });
}

/** 날짜 페이지용: 방송 id 목록에 대한 캐치 (개수 집계 포함) */
export async function getCatchesForBroadcastIds(
  broadcastIds: string[]
): Promise<QueryResult<CatchWithMember[]>> {
  if (broadcastIds.length === 0) return { data: [], error: null, notConfigured: false };
  return guard<CatchWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("catches")
        .select(WITH_MEMBER)
        .in("broadcast_id", broadcastIds)
        .order("views", { ascending: false })
        .limit(120)
    );
  });
}

/**
 * 날짜별 / 멤버별 묶어보기용 조회.
 * 날짜(최신순) → 조회수(내림차순) 순으로 정렬해서 가져오므로
 * 화면에서는 순서를 유지한 채로 그룹핑만 하면 된다.
 */
export async function getCatchesForGrouping(params: {
  from: string;
  to: string;
  memberId?: string | null;
  kind?: CatchKind | null;
  limit?: number;
}): Promise<QueryResult<CatchWithMember[]>> {
  return guard<CatchWithMember[]>([], async () => {
    const supabase = await createClient();
    let query = supabase
      .from("catches")
      .select(WITH_MEMBER)
      .gte("catch_date", params.from)
      .lte("catch_date", params.to)
      .order("catch_date", { ascending: false })
      .order("views", { ascending: false })
      .limit(params.limit ?? 200);

    if (params.kind) query = query.eq("kind", params.kind);
    if (params.memberId) query = query.eq("member_id", params.memberId);

    return unwrap<CatchWithMember[]>(await query);
  });
}

/** 인기 캐치 (기간 내 조회수 상위) */
export async function getTopCatches(
  from: string,
  to: string,
  limit = 12
): Promise<QueryResult<CatchWithMember[]>> {
  return guard<CatchWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap<CatchWithMember[]>(
      await supabase
        .from("catches")
        .select(WITH_MEMBER)
        .gte("catch_date", from)
        .lte("catch_date", to)
        .order("views", { ascending: false })
        .limit(limit)
    );
  });
}
