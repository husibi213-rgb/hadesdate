import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc, guard, type QueryResult } from "@/lib/queries/result";
import type { SearchResultRow } from "@/types/database";

/**
 * 통합 검색.
 * 한국어는 PostgreSQL 기본 전문검색 사전이 없어 pg_trgm 부분일치를 쓴다.
 * 종류별로 상한을 두고 DB 에서 잘라 오므로 결과가 무한정 커지지 않는다.
 */
export async function searchAll(
  query: string,
  perKind = 8
): Promise<QueryResult<SearchResultRow[]>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return { data: [], error: null, notConfigured: false };

  return guard<SearchResultRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<SearchResultRow[]>(supabase, "search_all", {
      p_query: trimmed,
      p_limit: perKind,
    });
  });
}
