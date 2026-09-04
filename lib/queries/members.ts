import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc, guard, unwrap, type QueryResult } from "@/lib/queries/result";
import type { MemberDailyPoint, MemberRow, MemberStats } from "@/types/database";

const MEMBER_FIELDS =
  "id, name, slug, channel_id, channel_url, profile_image_url, color, is_active, created_at, updated_at";

export async function getMembers(): Promise<QueryResult<MemberRow[]>> {
  return guard<MemberRow[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("members")
        .select(MEMBER_FIELDS)
        .eq("is_active", true)
        .order("name", { ascending: true })
    );
  });
}

/** uuid 또는 slug 로 멤버 조회 */
export async function getMember(idOrSlug: string): Promise<QueryResult<MemberRow | null>> {
  return guard<MemberRow | null>(null, async () => {
    const supabase = await createClient();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const query = supabase.from("members").select(MEMBER_FIELDS).limit(1);
    const res = isUuid ? await query.eq("id", idOrSlug) : await query.eq("slug", idOrSlug);
    const rows = unwrap<MemberRow[]>(res);
    return rows[0] ?? null;
  });
}

const EMPTY_STATS: MemberStats = {
  broadcast_count: 0,
  total_duration_seconds: 0,
  avg_viewers: 0,
  peak_viewers: 0,
  total_views: 0,
  total_followers: 0,
  catch_count: 0,
};

export async function getMemberStats(
  memberId: string,
  from: string | null,
  to: string | null
): Promise<QueryResult<MemberStats>> {
  return guard<MemberStats>(EMPTY_STATS, async () => {
    const supabase = await createClient();
    const rows = await callRpc<MemberStats[]>(supabase, "member_stats", {
      p_member_id: memberId,
      p_from: from,
      p_to: to,
    });
    return rows[0] ?? EMPTY_STATS;
  });
}

export async function getMemberDailySeries(
  memberId: string,
  from: string,
  to: string
): Promise<QueryResult<MemberDailyPoint[]>> {
  return guard<MemberDailyPoint[]>([], async () => {
    const supabase = await createClient();
    return callRpc<MemberDailyPoint[]>(supabase, "member_daily_series", {
      p_member_id: memberId,
      p_from: from,
      p_to: to,
    });
  });
}
