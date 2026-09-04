import "server-only";

import { createClient } from "@/lib/supabase/server";
import { guard, unwrap, type QueryResult } from "@/lib/queries/result";
import { PAGE_SIZE } from "@/lib/constants";
import type { NoticeRow, NoticeSource } from "@/types/database";

const NOTICE_FIELDS =
  "id, source, external_id, title, summary, content, url, published_at, created_at";

export interface NoticePage {
  rows: NoticeRow[];
  hasNext: boolean;
}

export async function getNoticesPage(params: {
  page?: number;
  source?: NoticeSource | null;
}): Promise<QueryResult<NoticePage>> {
  const page = Math.max(1, params.page ?? 1);

  return guard<NoticePage>({ rows: [], hasNext: false }, async () => {
    const supabase = await createClient();
    let query = supabase
      .from("notices")
      .select(NOTICE_FIELDS)
      .order("published_at", { ascending: false, nullsFirst: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (params.source) query = query.eq("source", params.source);

    const rows = unwrap<NoticeRow[]>(await query);
    return { rows: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE };
  });
}

export async function getRecentNotices(limit = 5): Promise<QueryResult<NoticeRow[]>> {
  return guard<NoticeRow[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("notices")
        .select(NOTICE_FIELDS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(limit)
    );
  });
}

/** 해당 날짜에 발행된 공지 */
export async function getNoticesForDate(dateKey: string): Promise<QueryResult<NoticeRow[]>> {
  return guard<NoticeRow[]>([], async () => {
    const supabase = await createClient();
    return unwrap(
      await supabase
        .from("notices")
        .select(NOTICE_FIELDS)
        .gte("published_at", `${dateKey}T00:00:00+09:00`)
        .lte("published_at", `${dateKey}T23:59:59+09:00`)
        .order("published_at", { ascending: false })
    );
  });
}

/**
 * 방송 상세용 관련 공지:
 *  (1) 해당 멤버와 연결된 공지  또는  (2) 해당 방송일에 발행된 공지
 */
export async function getRelatedNotices(
  memberId: string,
  dateKey: string,
  limit = 5
): Promise<QueryResult<NoticeRow[]>> {
  return guard<NoticeRow[]>([], async () => {
    const supabase = await createClient();

    const linked = unwrap<{ notice: NoticeRow | null }[]>(
      await supabase
        .from("member_notices")
        .select(`notice:notices!inner(${NOTICE_FIELDS})`)
        .eq("member_id", memberId)
        .limit(limit)
    );

    const sameDay = unwrap<NoticeRow[]>(
      await supabase
        .from("notices")
        .select(NOTICE_FIELDS)
        .gte("published_at", `${dateKey}T00:00:00+09:00`)
        .lte("published_at", `${dateKey}T23:59:59+09:00`)
        .limit(limit)
    );

    const map = new Map<string, NoticeRow>();
    for (const row of linked) if (row.notice) map.set(row.notice.id, row.notice);
    for (const row of sameDay) map.set(row.id, row);

    return Array.from(map.values())
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
      .slice(0, limit);
  });
}
