import { NextResponse } from "next/server";

import { runBackfill } from "@/lib/collect/run-backfill";
import { isCollectAuthorized } from "@/lib/collect/auth";
import { logError, toLogInput } from "@/lib/monitor/log-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 지난 방송 백필 (다시보기 목록 → 방송 레코드).
 *
 *   POST /api/collect/backfill?from=2026-08-01&to=2026-08-31
 *   POST /api/collect/backfill?from=...&to=...&pages=8
 *
 * 같은 구간을 여러 번 돌려도 이미 들어간 방송은 건너뛴다.
 * 로직은 lib/collect/run-backfill.ts
 */
export async function POST(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");

  if (!from || !to || !DATE.test(from) || !DATE.test(to)) {
    return NextResponse.json(
      { error: "from / to 는 YYYY-MM-DD 형식이어야 합니다" },
      { status: 400 }
    );
  }
  if (from > to) {
    return NextResponse.json({ error: "from 이 to 보다 뒤입니다" }, { status: 400 });
  }

  const pages = Number(params.get("pages")) || 6;

  try {
    return NextResponse.json({ ok: true, ...(await runBackfill(from, to, pages)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void logError(toLogInput("collect", error, new URL(request.url).pathname));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
