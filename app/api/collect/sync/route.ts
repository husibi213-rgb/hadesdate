import { NextResponse } from "next/server";

import { runSync } from "@/lib/collect/run-sync";
import { isCollectAuthorized } from "@/lib/collect/auth";
import { logError, toLogInput } from "@/lib/monitor/log-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/collect/sync  (헤더: x-collect-secret) — 로직은 lib/collect/run-sync.ts */
export async function POST(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await runSync()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void logError(toLogInput("collect", error, new URL(request.url).pathname));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
