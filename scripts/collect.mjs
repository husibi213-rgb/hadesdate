#!/usr/bin/env node
/**
 * 수집 실행기.
 *
 *   node scripts/collect.mjs              방송 상태 동기화 (1~3분 간격 권장)
 *   node scripts/collect.mjs vods         다시보기/클립/캐치 수집 (30분~1시간 간격 권장)
 *   node scripts/collect.mjs vods 3       페이지 수 지정
 *   node scripts/collect.mjs rollup       클릭 일일 집계 (하루 1회 권장)
 *
 * 환경변수
 *   COLLECT_BASE_URL  기본값 http://localhost:3000
 *   COLLECT_SECRET    서버의 COLLECT_SECRET 과 동일한 값
 */

const base = (process.env.COLLECT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.COLLECT_SECRET ?? "";

const arg = process.argv[2];
const mode = arg === "vods" || arg === "rollup" ? arg : "sync";
const pages = Number(process.argv[3]) || null;

const url = {
  vods: `${base}/api/collect/vods${pages ? `?pages=${pages}` : ""}`,
  rollup: `${base}/api/collect/rollup`,
  sync: `${base}/api/collect/sync`,
}[mode];

try {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(secret ? { "x-collect-secret": secret } : {}),
    },
  });

  const body = await response.json();

  if (!response.ok) {
    console.error(`[collect:${mode}] ${response.status}`, body);
    process.exit(1);
  }

  const results = body.results ?? [];
  const errors = results.filter((r) => r.error || r.status === "error");

  if (mode === "rollup") {
    for (const day of body.days ?? []) {
      console.log(
        `[collect:rollup] ${day.date} · ${day.rows}행` + (day.error ? ` · 오류 ${day.error}` : "")
      );
    }
  } else if (mode === "sync") {
    const live = results.filter((r) => r.status === "live");
    console.log(
      `[collect:sync] ${body.syncedAt} · LIVE ${live.length}명` +
        (live.length ? ` (${live.map((r) => `${r.channelId} ${r.viewers}`).join(", ")})` : "")
    );
  } else {
    for (const r of results) {
      if (r.error) continue;
      console.log(
        `[collect:vods] ${r.channelId} · 게시물 ${r.fetched} · 캐치 +${r.catchesInserted}/~${r.catchesUpdated} · VOD 연결 ${r.vodsLinked}` +
          (r.unclassified?.length ? ` · 미분류 ${r.unclassified.join(", ")}` : "")
      );
    }
  }

  for (const e of errors) {
    console.error(`[collect:${mode}] ERROR ${e.channelId}: ${e.message ?? e.error}`);
  }
} catch (error) {
  console.error(`[collect:${mode}] 요청 실패:`, error.message);
  process.exit(1);
}
