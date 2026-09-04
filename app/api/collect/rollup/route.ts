import { NextResponse } from "next/server";

import { runRollup } from "@/lib/collect/run-rollup";
import { isCollectAuthorized } from "@/lib/collect/auth";
import { logError, toLogInput } from "@/lib/monitor/log-error";
import { isValidDateKey } from "@/lib/utils/dates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/collect/rollup                    어제·오늘 집계
 * POST /api/collect/rollup?date=2026-09-01    특정 날짜만 (쉼표로 여러 개)
 *
 * 하루 한 번(예: 새벽) 돌리는 것을 전제로 한다.
 */
export async function POST(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("date");
  const dates = raw
    ? raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const invalid = dates.filter((date) => !isValidDateKey(date));
  if (invalid.length) {
    return NextResponse.json(
      { error: `날짜 형식이 올바르지 않습니다: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ ok: true, ...(await runRollup(dates)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void logError(toLogInput("collect", error, new URL(request.url).pathname));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
