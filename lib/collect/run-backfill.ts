import "server-only";

import { createAdminClient, insertRows, unwrapAdmin } from "@/lib/supabase/admin";
import { fetchVodItems, type SoopVodItem } from "@/lib/soop/vods";
import { logError, toLogInput } from "@/lib/monitor/log-error";
import { toDateKey } from "@/lib/utils/dates";
import type { BroadcastRow, MemberRow } from "@/types/database";

/**
 * 지난 방송 백필.
 *
 * SOOP 은 지난 방송의 "방송 기록" API 를 따로 주지 않지만,
 * 다시보기(VOD) 게시물이 방송 하나에 하나씩 남는다. 그래서 다시보기 목록으로
 * 과거 방송 레코드를 되살릴 수 있다.
 *
 *   reg_date            = 다시보기가 올라온 시각 ≒ 방송 종료 시각
 *   total_file_duration = 영상 길이 ≒ 방송시간
 *   started_at          = reg_date − 방송시간
 *
 * 실제로 station API 의 broad_start(16:00:56) + 길이(2시간58분) 가
 * reg_date(18:59:38) 와 맞아떨어지는 것을 확인하고 이 방식으로 정했다.
 *
 * 한계: 평균/최고 시청자는 방송 중에 스냅샷을 찍어야만 알 수 있는 값이라
 * 백필로는 채울 수 없다. 그래서 0 으로 남고, 화면에도 0 으로 보인다.
 */

type MemberBrief = Pick<MemberRow, "id" | "name" | "slug" | "channel_id">;

export interface BackfillMemberResult {
  channelId: string;
  name: string;
  /** 조회한 다시보기 수 (기간 필터 전) */
  scanned: number;
  /** 기간에 들어온 다시보기 수 */
  matched: number;
  inserted: number;
  /** 이미 있어서 건너뛴 수 */
  skipped: number;
  /** 길이를 못 구해 방송시간이 빈 채로 들어간 수 */
  missingDuration: number;
  error?: string;
}

export interface BackfillResult {
  from: string;
  to: string;
  ranAt: string;
  results: BackfillMemberResult[];
}

/** 백필로 만든 방송임을 알 수 있게 접두어를 붙인다 (실시간 수집분과 안 겹치게). */
export function backfillExternalId(titleNo: string): string {
  return `vod:${titleNo}`;
}

interface PlannedBroadcast {
  member_id: string;
  title: string | null;
  started_at: string;
  ended_at: string;
  duration_seconds: number | null;
  views: number;
  vod_url: string;
  thumbnail_url: string | null;
  status: "ended";
  external_id: string;
}

/** 다시보기 하나를 방송 레코드로 바꾼다. 시각을 못 구하면 null. */
export function planBroadcastFromReplay(
  memberId: string,
  replay: SoopVodItem
): PlannedBroadcast | null {
  if (!replay.registeredAt) return null;

  const endedMs = new Date(replay.registeredAt).getTime();
  if (Number.isNaN(endedMs)) return null;

  const duration = replay.durationSeconds && replay.durationSeconds > 0 ? replay.durationSeconds : null;
  // 길이를 모르면 시작 = 종료로 두어 시간 순서 제약(ended_at >= started_at)을 지킨다.
  const startedMs = duration ? endedMs - duration * 1000 : endedMs;

  return {
    member_id: memberId,
    title: replay.title,
    started_at: new Date(startedMs).toISOString(),
    ended_at: new Date(endedMs).toISOString(),
    duration_seconds: duration,
    views: Math.max(replay.playCount, replay.readCount),
    vod_url: replay.url,
    thumbnail_url: replay.thumbnailUrl,
    status: "ended",
    external_id: backfillExternalId(replay.titleNo),
  };
}

/**
 * from ~ to (KST 날짜, 양끝 포함) 사이의 지난 방송을 채운다.
 * 이미 같은 external_id 가 있으면 건드리지 않는다 (여러 번 돌려도 안전).
 */
export async function runBackfill(
  from: string,
  to: string,
  pages = 6
): Promise<BackfillResult> {
  const safePages = Math.min(20, Math.max(1, pages));
  const supabase = createAdminClient();

  const members = unwrapAdmin<MemberBrief>(
    await supabase.from("members").select("id, name, slug, channel_id").eq("is_active", true)
  );

  const results: BackfillMemberResult[] = [];

  for (const member of members) {
    const channelId = member.channel_id;
    if (!channelId) continue;

    const base: BackfillMemberResult = {
      channelId,
      name: member.name,
      scanned: 0,
      matched: 0,
      inserted: 0,
      skipped: 0,
      missingDuration: 0,
    };

    try {
      results.push(await backfillMember(supabase, member, channelId, from, to, safePages, base));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logError(toLogInput("collect", error, `backfill:${channelId}`));
      results.push({ ...base, error: message });
    }
  }

  return { from, to, ranAt: new Date().toISOString(), results };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function backfillMember(
  supabase: AdminClient,
  member: MemberBrief,
  channelId: string,
  from: string,
  to: string,
  pages: number,
  result: BackfillMemberResult
): Promise<BackfillMemberResult> {
  const { items } = await fetchVodItems(channelId, pages, 60);
  result.scanned = items.length;

  // 기간 판정은 화면과 같은 축(KST 날짜)으로 맞춘다.
  const inRange = items.filter((item) => {
    if (item.kind !== "replay" || !item.registeredAt) return false;
    const key = toDateKey(item.registeredAt);
    return key >= from && key <= to;
  });
  result.matched = inRange.length;
  if (inRange.length === 0) return result;

  const planned = inRange
    .map((replay) => planBroadcastFromReplay(member.id, replay))
    .filter((row): row is PlannedBroadcast => row !== null);

  if (planned.length === 0) return result;

  // 이미 들어간 것은 제외 (재실행 안전)
  const existing = unwrapAdmin<Pick<BroadcastRow, "external_id">>(
    await supabase
      .from("broadcasts")
      .select("external_id")
      .eq("member_id", member.id)
      .in(
        "external_id",
        planned.map((row) => row.external_id)
      )
  );
  const already = new Set(existing.map((row) => row.external_id));

  const toInsert = planned.filter((row) => !already.has(row.external_id));
  result.skipped = planned.length - toInsert.length;
  result.missingDuration = toInsert.filter((row) => row.duration_seconds === null).length;

  if (toInsert.length > 0) {
    await insertRows(supabase, "broadcasts", toInsert);
    result.inserted = toInsert.length;
  }

  return result;
}
