"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  createAdminClient,
  deleteRows,
  insertReturning,
  insertRows,
  updateRows,
} from "@/lib/supabase/admin";
import {
  assertAdmin,
  endAdminSession,
  startAdminSession,
  verifyPassword,
} from "@/lib/admin/session";
import { runSync } from "@/lib/collect/run-sync";
import { runVodsCollect } from "@/lib/collect/run-vods";
import { runBackfill } from "@/lib/collect/run-backfill";
import { fromDateTimeInput } from "@/lib/utils/datetime-input";
import {
  checked,
  integer,
  optionalInteger,
  required,
  stringList,
  text,
} from "@/lib/admin/form-data";
import type { MemberNoticeRow } from "@/types/database";

/** 액션 결과를 쿼리스트링으로 알린다 (?ok= / ?error=) */
function back(path: string, message: string, isError = false): never {
  const param = isError ? "error" : "ok";
  redirect(`${path}?${param}=${encodeURIComponent(message)}`);
}

async function run(path: string, label: string, task: () => Promise<string>): Promise<never> {
  let message: string;
  try {
    await assertAdmin();
    message = await task();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    back(path, `${label} 실패: ${detail}`, true);
  }
  revalidatePath(path);
  back(path, message);
}

/* ------------------------------ 로그인 ------------------------------ */

export async function signIn(form: FormData): Promise<never> {
  const password = text(form, "password");
  if (!password || !verifyPassword(password)) {
    back("/admin", "비밀번호가 올바르지 않습니다.", true);
  }
  await startAdminSession();
  redirect("/admin");
}

export async function signOut(): Promise<never> {
  await endAdminSession();
  redirect("/admin");
}

/* ------------------------------- 멤버 ------------------------------- */

const MEMBERS_PATH = "/admin/members";

export async function saveMember(form: FormData): Promise<never> {
  return run(MEMBERS_PATH, "멤버 저장", async () => {
    const supabase = createAdminClient();
    const id = text(form, "id");

    const values = {
      name: required(form, "name", "이름"),
      slug: text(form, "slug"),
      channel_id: text(form, "channel_id"),
      channel_url: text(form, "channel_url"),
      profile_image_url: text(form, "profile_image_url"),
      color: text(form, "color"),
      is_active: checked(form, "is_active"),
    };

    if (id) {
      await updateRows(supabase, "members", values, { id });
      return `${values.name} 수정됨`;
    }
    await insertRows(supabase, "members", [values]);
    return `${values.name} 추가됨`;
  });
}

export async function deleteMember(form: FormData): Promise<never> {
  return run(MEMBERS_PATH, "멤버 삭제", async () => {
    const supabase = createAdminClient();
    const id = required(form, "id", "멤버");
    await deleteRows(supabase, "members", { id });
    return "멤버 삭제됨 (연결된 방송·캐치도 함께 삭제됨)";
  });
}

/* ------------------------------- 방송 ------------------------------- */

const BROADCASTS_PATH = "/admin/broadcasts";

export async function saveBroadcast(form: FormData): Promise<never> {
  return run(BROADCASTS_PATH, "방송 저장", async () => {
    const supabase = createAdminClient();
    const id = text(form, "id");

    const startedAt = fromDateTimeInput(form.get("started_at"));
    if (!startedAt) throw new Error("방송 시작 시각은 필수입니다.");

    const values = {
      member_id: required(form, "member_id", "멤버"),
      title: text(form, "title"),
      started_at: startedAt,
      ended_at: fromDateTimeInput(form.get("ended_at")),
      avg_viewers: integer(form, "avg_viewers"),
      peak_viewers: integer(form, "peak_viewers"),
      views: integer(form, "views"),
      followers_gained: integer(form, "followers_gained"),
      vod_url: text(form, "vod_url"),
      thumbnail_url: text(form, "thumbnail_url"),
      status: text(form, "status") ?? "ended",
    };

    if (values.ended_at && values.ended_at < values.started_at) {
      throw new Error("종료 시각이 시작 시각보다 앞설 수 없습니다.");
    }

    if (id) {
      await updateRows(supabase, "broadcasts", values, { id });
      return "방송 수정됨";
    }
    await insertRows(supabase, "broadcasts", [values]);
    return "방송 추가됨";
  });
}

export async function deleteBroadcast(form: FormData): Promise<never> {
  return run(BROADCASTS_PATH, "방송 삭제", async () => {
    const supabase = createAdminClient();
    await deleteRows(supabase, "broadcasts", { id: required(form, "id", "방송") });
    return "방송 삭제됨 (스냅샷·캐치 연결도 함께 정리됨)";
  });
}

/* ------------------------------- 캐치 ------------------------------- */

const CATCHES_PATH = "/admin/catches";

export async function saveCatch(form: FormData): Promise<never> {
  return run(CATCHES_PATH, "캐치 저장", async () => {
    const supabase = createAdminClient();
    const id = text(form, "id");

    const values = {
      member_id: required(form, "member_id", "멤버"),
      broadcast_id: text(form, "broadcast_id"),
      title: text(form, "title"),
      description: text(form, "description"),
      catch_url: required(form, "catch_url", "원본 링크"),
      thumbnail_url: text(form, "thumbnail_url"),
      broadcast_timestamp: optionalInteger(form, "broadcast_timestamp"),
      views: integer(form, "views"),
      likes: integer(form, "likes"),
      published_at: fromDateTimeInput(form.get("published_at")),
    };

    if (id) {
      await updateRows(supabase, "catches", values, { id });
      return "캐치 수정됨";
    }
    await insertRows(supabase, "catches", [values]);
    return "캐치 추가됨";
  });
}

export async function deleteCatch(form: FormData): Promise<never> {
  return run(CATCHES_PATH, "캐치 삭제", async () => {
    const supabase = createAdminClient();
    await deleteRows(supabase, "catches", { id: required(form, "id", "캐치") });
    return "캐치 삭제됨";
  });
}

/* ------------------------------- 공지 ------------------------------- */

const NOTICES_PATH = "/admin/notices";

export async function saveNotice(form: FormData): Promise<never> {
  return run(NOTICES_PATH, "공지 저장", async () => {
    const supabase = createAdminClient();
    const id = text(form, "id");

    const values = {
      source: text(form, "source") ?? "other",
      title: required(form, "title", "제목"),
      summary: text(form, "summary"),
      url: text(form, "url"),
      published_at: fromDateTimeInput(form.get("published_at")) ?? new Date().toISOString(),
    };

    let noticeId = id;
    if (noticeId) {
      await updateRows(supabase, "notices", values, { id: noticeId });
    } else {
      const inserted = await insertReturning<{ id: string }>(
        supabase,
        "notices",
        [values],
        "id"
      );
      noticeId = inserted[0]?.id ?? null;
    }

    if (!noticeId) throw new Error("공지 저장 후 id 를 확인할 수 없습니다.");

    // 멤버 연결을 전부 교체한다.
    const memberIds = stringList(form, "member_ids");
    await deleteRows(supabase, "member_notices", { notice_id: noticeId });
    if (memberIds.length) {
      const links: Pick<MemberNoticeRow, "member_id" | "notice_id">[] = memberIds.map(
        (memberId) => ({ member_id: memberId, notice_id: noticeId as string })
      );
      await insertRows(supabase, "member_notices", links);
    }

    return id ? "공지 수정됨" : "공지 추가됨";
  });
}

export async function deleteNotice(form: FormData): Promise<never> {
  return run(NOTICES_PATH, "공지 삭제", async () => {
    const supabase = createAdminClient();
    await deleteRows(supabase, "notices", { id: required(form, "id", "공지") });
    return "공지 삭제됨";
  });
}

/* ------------------------------ 수집 실행 ----------------------------- */

export async function triggerSync(): Promise<never> {
  return run("/admin", "방송 상태 수집", async () => {
    const result = await runSync();
    const errors = result.results.filter((r) => r.status === "error");
    const detail = errors.length ? ` · 오류 ${errors.length}건` : "";
    return `방송 상태 수집 완료 — LIVE ${result.liveCount}명${detail}`;
  });
}

export async function triggerVods(): Promise<never> {
  return run("/admin", "게시물 수집", async () => {
    const result = await runVodsCollect(2);
    const inserted = result.results.reduce((sum, r) => sum + r.catchesInserted, 0);
    const updated = result.results.reduce((sum, r) => sum + r.catchesUpdated, 0);
    const linked = result.results.reduce((sum, r) => sum + r.vodsLinked, 0);
    const unclassified = Array.from(
      new Set(result.results.flatMap((r) => r.unclassified))
    );
    const note = unclassified.length ? ` · 미분류 ${unclassified.join(", ")}` : "";
    return `게시물 수집 완료 — 캐치 +${inserted}/갱신 ${updated} · VOD 연결 ${linked}${note}`;
  });
}

/**
 * 지난 방송 백필. 폼에서 기간(YYYY-MM-DD)을 받는다.
 * 같은 구간을 여러 번 돌려도 이미 들어간 방송은 건너뛴다.
 */
export async function triggerBackfill(form: FormData): Promise<never> {
  const from = text(form, "from") ?? "";
  const to = text(form, "to") ?? "";

  return run("/admin", "지난 방송 백필", async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new Error("기간은 YYYY-MM-DD 형식으로 입력해 주세요.");
    }
    if (from > to) throw new Error("시작일이 종료일보다 뒤입니다.");

    const result = await runBackfill(from, to, 6);
    const inserted = result.results.reduce((sum, r) => sum + r.inserted, 0);
    const skipped = result.results.reduce((sum, r) => sum + r.skipped, 0);
    const missing = result.results.reduce((sum, r) => sum + r.missingDuration, 0);
    const failed = result.results.filter((r) => r.error);

    const note = [
      skipped ? `이미 있음 ${skipped}` : null,
      missing ? `방송시간 없음 ${missing}` : null,
      failed.length ? `실패 ${failed.map((r) => r.channelId).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    return `백필 완료 (${from} ~ ${to}) — 방송 +${inserted}${note ? ` · ${note}` : ""}`;
  });
}

/* ------------------------------ 오류 로그 ----------------------------- */

export async function clearErrorLogs(): Promise<never> {
  return run("/admin/errors", "오류 로그 삭제", async () => {
    const supabase = createAdminClient();
    // 전체 삭제 — id 는 1부터 시작하므로 이 조건이 모든 행을 덮는다.
    await deleteAll(supabase);
    return "오류 로그를 모두 지웠습니다";
  });
}

interface DeleteAllCapable {
  from: (table: string) => {
    delete: () => {
      gt: (column: string, value: unknown) => Promise<{ error: { message: string } | null }>;
    };
  };
}

async function deleteAll(client: unknown): Promise<void> {
  const { error } = await (client as DeleteAllCapable).from("error_logs").delete().gt("id", 0);
  if (error) throw new Error(error.message);
}
