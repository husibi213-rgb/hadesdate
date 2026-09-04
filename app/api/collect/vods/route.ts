import { NextResponse } from "next/server";

import { runVodsCollect } from "@/lib/collect/run-vods";
import { isCollectAuthorized } from "@/lib/collect/auth";
import { logError, toLogInput } from "@/lib/monitor/log-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/collect/vods            (헤더: x-collect-secret)
 * POST /api/collect/vods?pages=3    가져올 페이지 수 (기본 2, 최대 10)
 *
 * 로직은 lib/collect/run-vods.ts
 */
export async function POST(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pages = Number(new URL(request.url).searchParams.get("pages")) || 2;

  try {
    return NextResponse.json({ ok: true, ...(await runVodsCollect(pages)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void logError(toLogInput("collect", error, new URL(request.url).pathname));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
