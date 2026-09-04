import "server-only";

import {
  createAdminClient,
  insertReturning,
  insertRows,
  unwrapAdmin,
  updateRows,
} from "@/lib/supabase/admin";
import { fetchStation, profileImageUrlFor } from "@/lib/soop/station";
import { logError, toLogInput } from "@/lib/monitor/log-error";
import type { BroadcastRow, MemberRow, ViewerSnapshotRow } from "@/types/database";

type MemberBrief = Pick<MemberRow, "id" | "name" | "slug" | "channel_id" | "profile_image_url">;
type OpenBroadcast = Pick<BroadcastRow, "id" | "external_id" | "started_at" | "peak_viewers">;
type SnapshotBrief = Pick<ViewerSnapshotRow, "recorded_at" | "viewers">;

export interface SyncMemberResult {
  channelId: string;
  status: "live" | "ended" | "offline" | "error";
  broadcastId?: string;
  viewers?: number;
  message?: string;
}

export interface SyncResult {
  syncedAt: string;
  liveCount: number;
  results: SyncMemberResult[];
}

/**
 * 방송 상태 동기화.
 *
 * 활성 멤버마다 SOOP station API 를 호출해서
 *   1. 닉네임 / 프로필 이미지를 최신으로 맞추고
 *   2. 방송 중이면 방송 세션을 만들거나 이어가며 시청자 스냅샷을 남기고
 *   3. 방송이 꺼졌으면 열려 있던 세션을 닫고 평균/최고 시청자를 확정한다.
 *
 * 1~3분 간격 호출을 전제로 한다. (호출 간격 = 시청자 스냅샷 간격)
 */
export async function runSync(): Promise<SyncResult> {
  const supabase = createAdminClient();

  const members = unwrapAdmin<MemberBrief>(
    await supabase
      .from("members")
      .select("id, name, slug, channel_id, profile_image_url")
      .eq("is_active", true)
  );

  const results: SyncMemberResult[] = [];

  for (const member of members) {
    const channelId = member.channel_id;
    if (!channelId) {
      results.push({
        channelId: member.slug ?? member.id,
        status: "error",
        message: "channel_id 없음",
      });
      continue;
    }

    try {
      results.push(await syncMember(supabase, member, channelId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logError(toLogInput("collect", error, `sync:${channelId}`));
      results.push({ channelId, status: "error", message });
    }
  }

  return {
    syncedAt: new Date().toISOString(),
    liveCount: results.filter((r) => r.status === "live").length,
    results,
  };
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function syncMember(
  supabase: AdminClient,
  member: MemberBrief,
  channelId: string
): Promise<SyncMemberResult> {
  const station = await fetchStation(channelId);

  // 1. 프로필 최신화 — 최초 등록 시 name 이 channel_id 이므로 닉네임으로 교체된다.
  const nextName = station.nickname ?? member.name;
  const nextImage = station.profileImageUrl ?? profileImageUrlFor(channelId);
  if (nextName !== member.name || nextImage !== member.profile_image_url) {
    await updateRows(
      supabase,
      "members",
      { name: nextName, profile_image_url: nextImage },
      { id: member.id }
    );
  }

  // 2. 열려 있는 방송 세션
  const open = unwrapAdmin<OpenBroadcast>(
    await supabase
      .from("broadcasts")
      .select("id, external_id, started_at, peak_viewers")
      .eq("member_id", member.id)
      .eq("status", "live")
      .order("started_at", { ascending: false })
      .limit(1)
  )[0];

  // ---------- 방송 꺼짐 ----------
  if (!station.live) {
    if (!open) return { channelId, status: "offline" };
    await closeBroadcast(supabase, open.id);
    return { channelId, status: "ended", broadcastId: open.id };
  }

  // ---------- 방송 중 ----------
  const { broadNo, title, viewers, startedAt } = station.live;

  // 껐다 켠 경우: 이전 세션을 닫고 새 세션을 연다.
  if (open && open.external_id !== broadNo) {
    await closeBroadcast(supabase, open.id);
  }

  let broadcastId = open && open.external_id === broadNo ? open.id : null;

  if (broadcastId) {
    await updateRows(
      supabase,
      "broadcasts",
      { title, peak_viewers: Math.max(open?.peak_viewers ?? 0, viewers) },
      { id: broadcastId }
    );
  } else {
    // 같은 broad_no 가 이미 저장돼 있으면(종료 처리 후 재개) 그 세션을 되살린다.
    const existing = unwrapAdmin<Pick<BroadcastRow, "id">>(
      await supabase
        .from("broadcasts")
        .select("id")
        .eq("member_id", member.id)
        .eq("external_id", broadNo)
        .limit(1)
    )[0];

    if (existing) {
      broadcastId = existing.id;
      await updateRows(
        supabase,
        "broadcasts",
        { status: "live", ended_at: null, title },
        { id: existing.id }
      );
    } else {
      const inserted = await insertReturning<Pick<BroadcastRow, "id">>(
        supabase,
        "broadcasts",
        [
          {
            member_id: member.id,
            external_id: broadNo,
            title,
            started_at: startedAt ?? new Date().toISOString(),
            status: "live",
            avg_viewers: viewers,
            peak_viewers: viewers,
          },
        ],
        "id"
      );
      broadcastId = inserted[0]?.id ?? null;
    }
  }

  if (!broadcastId) throw new Error("방송 세션 생성 실패");

  // 3. 시청자 스냅샷
  await insertRows(supabase, "viewer_snapshots", [
    { broadcast_id: broadcastId, recorded_at: new Date().toISOString(), viewers },
  ]);

  return { channelId, status: "live", broadcastId, viewers };
}

/** 방송 종료 처리: 스냅샷에서 평균/최고를 확정하고 종료 시각을 채운다. */
async function closeBroadcast(supabase: AdminClient, broadcastId: string): Promise<void> {
  const snapshots = unwrapAdmin<SnapshotBrief>(
    await supabase
      .from("viewer_snapshots")
      .select("recorded_at, viewers")
      .eq("broadcast_id", broadcastId)
      .order("recorded_at", { ascending: false })
      .limit(5000)
  );

  const viewers = snapshots.map((s) => s.viewers);
  const endedAt = snapshots[0]?.recorded_at ?? new Date().toISOString();

  await updateRows(
    supabase,
    "broadcasts",
    {
      status: "ended",
      ended_at: endedAt,
      // duration_seconds 는 DB 트리거가 계산한다.
      avg_viewers: viewers.length
        ? Math.round(viewers.reduce((a, b) => a + b, 0) / viewers.length)
        : 0,
      peak_viewers: viewers.length ? Math.max(...viewers) : 0,
    },
    { id: broadcastId }
  );
}
