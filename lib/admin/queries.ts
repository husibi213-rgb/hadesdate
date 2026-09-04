import "server-only";

import { createAdminClient, unwrapAdmin } from "@/lib/supabase/admin";
import type { Database, ErrorLogRow, MemberRow, NoticeRow } from "@/types/database";
import type { BroadcastWithMember } from "@/lib/queries/broadcasts";
import type { CatchWithMember } from "@/lib/queries/catches";

export const ADMIN_PAGE_SIZE = 25;

/** 행 수만 세어 온다 (head 요청). 캐스팅은 여기 한 곳으로 격리. */
interface CountCapable {
  from: (table: string) => {
    select: (
      columns: string,
      options: { count: "exact"; head: true }
    ) => Promise<{ count: number | null; error: { message: string } | null }>;
  };
}

async function countRows(
  client: unknown,
  table: keyof Database["public"]["Tables"]
): Promise<number> {
  const res = await (client as CountCapable)
    .from(table as string)
    .select("*", { count: "exact", head: true });
  if (res.error) throw new Error(res.error.message);
  return res.count ?? 0;
}

export interface AdminOverview {
  members: number;
  broadcasts: number;
  liveBroadcasts: number;
  viewerSnapshots: number;
  catches: number;
  notices: number;
  /** 가장 최근 시청자 스냅샷 시각 — 수집기가 살아 있는지 판단용 */
  lastSnapshotAt: string | null;
  /** 가장 최근 방송 시작 시각 */
  lastBroadcastAt: string | null;
  /** 마지막 스냅샷이 몇 분 전인지 (없으면 null) */
  snapshotAgeMinutes: number | null;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const supabase = createAdminClient();

  const [members, broadcasts, viewerSnapshots, catches, notices] = await Promise.all([
    countRows(supabase, "members"),
    countRows(supabase, "broadcasts"),
    countRows(supabase, "viewer_snapshots"),
    countRows(supabase, "catches"),
    countRows(supabase, "notices"),
  ]);

  const live = unwrapAdmin<{ id: string }>(
    await supabase.from("broadcasts").select("id").eq("status", "live")
  );

  const lastSnapshot = unwrapAdmin<{ recorded_at: string }>(
    await supabase
      .from("viewer_snapshots")
      .select("recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1)
  );

  const lastBroadcast = unwrapAdmin<{ started_at: string }>(
    await supabase
      .from("broadcasts")
      .select("started_at")
      .order("started_at", { ascending: false })
      .limit(1)
  );

  const lastSnapshotAt = lastSnapshot[0]?.recorded_at ?? null;

  return {
    members,
    broadcasts,
    liveBroadcasts: live.length,
    viewerSnapshots,
    catches,
    notices,
    lastSnapshotAt,
    lastBroadcastAt: lastBroadcast[0]?.started_at ?? null,
    snapshotAgeMinutes: lastSnapshotAt
      ? Math.round((Date.now() - new Date(lastSnapshotAt).getTime()) / 60000)
      : null,
  };
}

/** 관리자용 멤버 목록 — 비활성 멤버까지 모두 */
export async function getAdminMembers(): Promise<MemberRow[]> {
  const supabase = createAdminClient();
  return unwrapAdmin<MemberRow>(
    await supabase
      .from("members")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true })
  );
}

export type MemberOption = Pick<MemberRow, "id" | "name" | "slug">;

export async function getMemberOptions(): Promise<MemberOption[]> {
  const supabase = createAdminClient();
  return unwrapAdmin<MemberOption>(
    await supabase.from("members").select("id, name, slug").order("name", { ascending: true })
  );
}

export interface AdminPage<T> {
  rows: T[];
  hasNext: boolean;
}

export async function getAdminBroadcasts(params: {
  page: number;
  memberId?: string | null;
}): Promise<AdminPage<BroadcastWithMember>> {
  const supabase = createAdminClient();
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;

  let query = supabase
    .from("broadcasts")
    .select("*, member:members(id, name, slug, profile_image_url, color)")
    .order("started_at", { ascending: false })
    .range(from, from + ADMIN_PAGE_SIZE);

  if (params.memberId) query = query.eq("member_id", params.memberId);

  const rows = unwrapAdmin<BroadcastWithMember>(await query);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasNext: rows.length > ADMIN_PAGE_SIZE };
}

export async function getAdminCatches(params: {
  page: number;
  memberId?: string | null;
}): Promise<AdminPage<CatchWithMember>> {
  const supabase = createAdminClient();
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;

  let query = supabase
    .from("catches")
    .select("*, member:members(id, name, slug, profile_image_url, color)")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + ADMIN_PAGE_SIZE);

  if (params.memberId) query = query.eq("member_id", params.memberId);

  const rows = unwrapAdmin<CatchWithMember>(await query);
  return { rows: rows.slice(0, ADMIN_PAGE_SIZE), hasNext: rows.length > ADMIN_PAGE_SIZE };
}

export interface AdminNotice extends NoticeRow {
  memberIds: string[];
}

export async function getAdminNotices(params: {
  page: number;
}): Promise<AdminPage<AdminNotice>> {
  const supabase = createAdminClient();
  const from = (params.page - 1) * ADMIN_PAGE_SIZE;

  const rows = unwrapAdmin<NoticeRow>(
    await supabase
      .from("notices")
      .select("*")
      .order("published_at", { ascending: false, nullsFirst: false })
      .range(from, from + ADMIN_PAGE_SIZE)
  );

  const pageRows = rows.slice(0, ADMIN_PAGE_SIZE);

  const links = pageRows.length
    ? unwrapAdmin<{ member_id: string; notice_id: string }>(
        await supabase
          .from("member_notices")
          .select("member_id, notice_id")
          .in(
            "notice_id",
            pageRows.map((r) => r.id)
          )
      )
    : [];

  const byNotice = new Map<string, string[]>();
  for (const link of links) {
    const list = byNotice.get(link.notice_id) ?? [];
    list.push(link.member_id);
    byNotice.set(link.notice_id, list);
  }

  return {
    rows: pageRows.map((row) => ({ ...row, memberIds: byNotice.get(row.id) ?? [] })),
    hasNext: rows.length > ADMIN_PAGE_SIZE,
  };
}

/** 캐치 편집 시 고를 수 있는 최근 방송 목록 */
export async function getRecentBroadcastOptions(
  memberId: string | null,
  limit = 60
): Promise<{ id: string; label: string }[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("broadcasts")
    .select("id, title, broadcast_date, member_id")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (memberId) query = query.eq("member_id", memberId);

  const rows = unwrapAdmin<{
    id: string;
    title: string | null;
    broadcast_date: string;
  }>(await query);

  return rows.map((row) => ({
    id: row.id,
    label: `${row.broadcast_date} · ${row.title ?? "제목 없음"}`,
  }));
}

/* ------------------------------ 오류 로그 ------------------------------ */

export async function getErrorLogs(limit = 50): Promise<ErrorLogRow[]> {
  const supabase = createAdminClient();
  return unwrapAdmin<ErrorLogRow>(
    await supabase
      .from("error_logs")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(limit)
  );
}

/** 최근 24시간 오류 건수 (개요 배지용) */
export async function getRecentErrorCount(): Promise<number> {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = unwrapAdmin<{ count: number }>(
    await supabase.from("error_logs").select("count").gte("occurred_at", since)
  );
  return rows.reduce((sum, row) => sum + (row.count ?? 0), 0);
}
