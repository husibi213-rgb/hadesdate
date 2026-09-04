import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createAdminClient, insertRows } from "@/lib/supabase/admin";
import { envValueOr } from "@/lib/env";
import { logError, toLogInput } from "@/lib/monitor/log-error";
import type { ClickTargetType } from "@/types/database";

export const runtime = "nodejs";

const TARGET_TYPES: ClickTargetType[] = [
  "broadcast",
  "member",
  "catch",
  "vod",
  "profile",
  "notice",
  "external",
];

interface Payload {
  targetType?: string;
  targetId?: string | null;
  broadcastId?: string | null;
  memberId?: string | null;
  /** 브라우저 탭 단위 무작위 값. 서버에서 다시 해시한다. */
  sessionId?: string | null;
}

/**
 * 익명 클릭 수집.
 * 개인정보(IP/닉네임/계정)를 저장하지 않는다.
 * session_hash 는 요청 헤더 + 일자 + 서버 시크릿으로 만든 단방향 해시이며 복원할 수 없다.
 */
export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const targetType = body.targetType as ClickTargetType;
  if (!TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: "invalid targetType" }, { status: 400 });
  }

  // 세션 해시: 클라이언트가 보낸 무작위 세션 id + 날짜 + 서버 솔트의 단방향 해시.
  // 세션 id 를 못 받으면(스토리지 차단 등) UA/언어로 대체하되, 그 경우 세션 구분은 거칠어진다.
  const salt = envValueOr("CLICK_HASH_SALT", "hades-data");
  const day = new Date().toISOString().slice(0, 10);
  const seed =
    typeof body.sessionId === "string" && body.sessionId.length > 0
      ? body.sessionId
      : `${request.headers.get("user-agent") ?? ""}|${request.headers.get("accept-language") ?? ""}`;
  const sessionHash = createHash("sha256")
    .update(`${seed}|${day}|${salt}`)
    .digest("hex")
    .slice(0, 32);

  try {
    const supabase = createAdminClient();
    await insertRows(supabase, "click_events", [
      {
        broadcast_id: body.broadcastId ?? null,
        member_id: body.memberId ?? null,
        target_type: targetType,
        target_id: body.targetId ?? null,
        session_hash: sessionHash,
      },
    ]);
  } catch (error) {
    void logError(toLogInput("api", error, "/api/clicks"));
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
