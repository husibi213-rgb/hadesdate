import "server-only";

import { createClient } from "@/lib/supabase/server";
import { guard, unwrap, type QueryResult } from "@/lib/queries/result";
import { PAGE_SIZE } from "@/lib/constants";
import type {
  BroadcastRow,
  MemberRow,
  ViewerSnapshotRow,
} from "@/types/database";

const BROADCAST_FIELDS = `
  id, member_id, title, started_at, ended_at, duration_seconds,
  avg_viewers, peak_viewers, views, followers_gained,
  vod_url, thumbnail_url, status, external_id,
  created_at, updated_at, broadcast_date
`;

const WITH_MEMBER = `${BROADCAST_FIELDS}, member:members!inner(id, name, slug, profile_image_url, color)`;

export type MemberBrief = Pick<
  MemberRow,
  "id" | "name" | "slug" | "profile_image_url" | "color"
>;

export interface BroadcastWithMember extends BroadcastRow {
  member: MemberBrief | null;
}

export async function getLiveBroadcasts(): Promise<QueryResult<BroadcastWithMember[]>> {
  return guard<BroadcastWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("broadcasts")
        .select(WITH_MEMBER)
        .eq("status", "live")
        .order("started_at", { ascending: true })
    );
  });
}

export async function getRecentBroadcasts(
  limit = 10
): Promise<QueryResult<BroadcastWithMember[]>> {
  return guard<BroadcastWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("broadcasts")
        .select(WITH_MEMBER)
        .neq("status", "cancelled")
        .order("started_at", { ascending: false })
        .limit(limit)
    );
  });
}

export interface BroadcastListParams {
  page?: number;
  pageSize?: number;
  memberId?: string | null;
  date?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface BroadcastPage {
  rows: BroadcastWithMember[];
  hasNext: boolean;
}

export async function getBroadcastsPage(
  params: BroadcastListParams = {}
): Promise<QueryResult<BroadcastPage>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? PAGE_SIZE;

  return guard<BroadcastPage>({ rows: [], hasNext: false }, async () => {
    const supabase = await createClient();
    let query = supabase
      .from("broadcasts")
      .select(WITH_MEMBER)
      .neq("status", "cancelled")
      .order("started_at", { ascending: false })
      // hasNext 판단용으로 1건 더 가져온다.
      .range((page - 1) * pageSize, page * pageSize);

    if (params.memberId) query = query.eq("member_id", params.memberId);
    if (params.date) query = query.eq("broadcast_date", params.date);
    if (params.from) query = query.gte("broadcast_date", params.from);
    if (params.to) query = query.lte("broadcast_date", params.to);

    const rows = unwrap<BroadcastWithMember[]>(await query);
    return { rows: rows.slice(0, pageSize), hasNext: rows.length > pageSize };
  });
}

export async function getBroadcast(
  id: string
): Promise<QueryResult<BroadcastWithMember | null>> {
  return guard<BroadcastWithMember | null>(null, async () => {
    const supabase = await createClient();
    const rows = unwrap<BroadcastWithMember[]>(
      await supabase.from("broadcasts").select(WITH_MEMBER).eq("id", id).limit(1)
    );
    return rows[0] ?? null;
  });
}

/** 날짜(KST) 기준 그날의 모든 방송 */
export async function getBroadcastsForDate(
  dateKey: string
): Promise<QueryResult<BroadcastWithMember[]>> {
  return guard<BroadcastWithMember[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("broadcasts")
        .select(WITH_MEMBER)
        .eq("broadcast_date", dateKey)
        .neq("status", "cancelled")
        .order("started_at", { ascending: true })
    );
  });
}

/** 방송 시청자 시계열. 포인트가 너무 많으면 균등 샘플링한다. */
export async function getViewerSnapshots(
  broadcastId: string,
  maxPoints = 300
): Promise<QueryResult<Pick<ViewerSnapshotRow, "recorded_at" | "viewers">[]>> {
  return guard<Pick<ViewerSnapshotRow, "recorded_at" | "viewers">[]>([], async () => {
    const supabase = await createClient();
    const rows = unwrap<Pick<ViewerSnapshotRow, "recorded_at" | "viewers">[]>(
      await supabase
        .from("viewer_snapshots")
        .select("recorded_at, viewers")
        .eq("broadcast_id", broadcastId)
        .order("recorded_at", { ascending: true })
        .limit(5000)
    );

    if (rows.length <= maxPoints) return rows;
    const step = Math.ceil(rows.length / maxPoints);
    return rows.filter((_, i) => i % step === 0 || i === rows.length - 1);
  });
}


export interface DaySummary {
  dateKey: string;
  broadcastCount: number;
  durationSeconds: number;
  peakViewers: number;
}

/** 캘린더용 월 단위 요약. 가벼운 컬럼만 가져와 서버에서 집계한다. */
export async function getBroadcastDaySummaries(
  from: string,
  to: string
): Promise<QueryResult<DaySummary[]>> {
  return guard<DaySummary[]>([], async () => {
    const supabase = await createClient();
    const rows = unwrap<
      Pick<BroadcastRow, "broadcast_date" | "duration_seconds" | "peak_viewers">[]
    >(
      await supabase
        .from("broadcasts")
        .select("broadcast_date, duration_seconds, peak_viewers")
        .gte("broadcast_date", from)
        .lte("broadcast_date", to)
        .neq("status", "cancelled")
        .limit(2000)
    );

    const map = new Map<string, DaySummary>();
    for (const row of rows) {
      const current = map.get(row.broadcast_date) ?? {
        dateKey: row.broadcast_date,
        broadcastCount: 0,
        durationSeconds: 0,
        peakViewers: 0,
      };
      current.broadcastCount += 1;
      current.durationSeconds += row.duration_seconds ?? 0;
      current.peakViewers = Math.max(current.peakViewers, row.peak_viewers);
      map.set(row.broadcast_date, current);
    }
    return Array.from(map.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  });
}
