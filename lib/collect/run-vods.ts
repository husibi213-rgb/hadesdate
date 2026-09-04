import "server-only";

import { createAdminClient, insertRows, unwrapAdmin, updateRows } from "@/lib/supabase/admin";
import { fetchVodItems, type SoopVodItem } from "@/lib/soop/vods";
import {
  matchBroadcastForPost,
  maxDateKey,
  minDateKey,
  offsetFromBroadcastStart,
  shiftDateKey,
} from "@/lib/collect/match";
import { toDateKey } from "@/lib/utils/dates";
import { logError, toLogInput } from "@/lib/monitor/log-error";
import type { BroadcastRow, CatchRow, MemberRow } from "@/types/database";

type MemberBrief = Pick<MemberRow, "id" | "name" | "slug" | "channel_id">;
type BroadcastBrief = Pick<
  BroadcastRow,
  "id" | "started_at" | "ended_at" | "broadcast_date" | "vod_url" | "views"
>;

export interface VodsMemberResult {
  channelId: string;
  fetched: number;
  catchesInserted: number;
  catchesUpdated: number;
  vodsLinked: number;
  /** 분류되지 않은 board_type/bbs_name 조합 — 매핑 표 보완용 */
  unclassified: string[];
  error?: string;
}

export interface VodsResult {
  collectedAt: string;
  pages: number;
  results: VodsMemberResult[];
}

/**
 * 다시보기 / 클립 / 캐치 수집.
 *
 *  - clip / catch 게시물 → catches 테이블에 upsert (external_id = title_no)
 *  - replay 게시물       → 등록 시각이 걸치는 방송에 vod_url / views 를 채운다
 *
 * 방송 상태 동기화보다 훨씬 드물게(예: 30분~1시간) 돌리면 된다.
 */
export async function runVodsCollect(pages = 2): Promise<VodsResult> {
  const safePages = Math.min(10, Math.max(1, pages));
  const supabase = createAdminClient();

  const members = unwrapAdmin<MemberBrief>(
    await supabase.from("members").select("id, name, slug, channel_id").eq("is_active", true)
  );

  const results: VodsMemberResult[] = [];

  for (const member of members) {
    const channelId = member.channel_id;
    if (!channelId) continue;

    const base: VodsMemberResult = {
      channelId,
      fetched: 0,
      catchesInserted: 0,
      catchesUpdated: 0,
      vodsLinked: 0,
      unclassified: [],
    };

    try {
      results.push(await collectForMember(supabase, member, channelId, safePages, base));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logError(toLogInput("collect", error, `vods:${channelId}`));
      results.push({ ...base, error: message });
    }
  }

  return { collectedAt: new Date().toISOString(), pages: safePages, results };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function collectForMember(
  supabase: AdminClient,
  member: MemberBrief,
  channelId: string,
  pages: number,
  result: VodsMemberResult
): Promise<VodsMemberResult> {
  const { items } = await fetchVodItems(channelId, pages);
  result.fetched = items.length;

  const unclassified = new Set<string>();
  const clips: SoopVodItem[] = [];
  const replays: SoopVodItem[] = [];

  for (const item of items) {
    if (item.kind === "clip" || item.kind === "catch") clips.push(item);
    else if (item.kind === "replay") replays.push(item);
    else unclassified.add(`${item.boardType ?? "?"}:${item.bbsName ?? "?"}`);
  }
  result.unclassified = Array.from(unclassified);

  // 관련 방송을 한 번에 읽어온다 (게시물 날짜 ±1일 범위)
  const dateKeys = items
    .map((item) => (item.registeredAt ? toDateKey(item.registeredAt) : null))
    .filter((key): key is string => key !== null);

  const broadcasts = dateKeys.length
    ? unwrapAdmin<BroadcastBrief>(
        await supabase
          .from("broadcasts")
          .select("id, started_at, ended_at, broadcast_date, vod_url, views")
          .eq("member_id", member.id)
          .gte("broadcast_date", shiftDateKey(minDateKey(dateKeys), -1))
          .lte("broadcast_date", maxDateKey(dateKeys))
          .order("started_at", { ascending: false })
          .limit(500)
      )
    : [];

  // ---------- 클립 / 캐치 ----------
  if (clips.length) {
    const existing = unwrapAdmin<Pick<CatchRow, "id" | "external_id">>(
      await supabase
        .from("catches")
        .select("id, external_id")
        .eq("member_id", member.id)
        .in(
          "external_id",
          clips.map((c) => c.titleNo)
        )
    );
    const existingByExternal = new Map(existing.map((row) => [row.external_id, row.id]));

    const toInsert: Record<string, unknown>[] = [];

    for (const clip of clips) {
      const match = matchBroadcastForPost(broadcasts, clip.registeredAt);
      const views = clip.playCount > 0 ? clip.playCount : clip.readCount;
      const offset = match ? offsetFromBroadcastStart(match.started_at, clip.registeredAt) : null;

      const existingId = existingByExternal.get(clip.titleNo);
      if (existingId) {
        // 조회수/좋아요는 계속 늘어나므로 갱신한다.
        await updateRows(
          supabase,
          "catches",
          {
            title: clip.title,
            kind: clip.kind,
            thumbnail_url: clip.thumbnailUrl,
            views,
            likes: clip.likeCount,
            ...(match ? { broadcast_id: match.id, broadcast_timestamp: offset } : {}),
          },
          { id: existingId }
        );
        result.catchesUpdated += 1;
        continue;
      }

      toInsert.push({
        member_id: member.id,
        broadcast_id: match?.id ?? null,
        external_id: clip.titleNo,
        title: clip.title,
        kind: clip.kind,
        catch_url: clip.url,
        thumbnail_url: clip.thumbnailUrl,
        broadcast_timestamp: offset,
        views,
        likes: clip.likeCount,
        published_at: clip.registeredAt,
      });
    }

    if (toInsert.length) {
      await insertRows(supabase, "catches", toInsert);
      result.catchesInserted = toInsert.length;
    }
  }

  // ---------- 다시보기 → 방송에 VOD 링크 ----------
  for (const replay of replays) {
    const match = matchBroadcastForPost(broadcasts, replay.registeredAt);
    if (!match) continue;

    const nextViews = Math.max(match.views, replay.playCount, replay.readCount);
    if (match.vod_url === replay.url && match.views === nextViews) continue;

    await updateRows(
      supabase,
      "broadcasts",
      { vod_url: replay.url, views: nextViews },
      { id: match.id }
    );
    result.vodsLinked += 1;
  }

  return result;
}
