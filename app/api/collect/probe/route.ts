import { NextResponse } from "next/server";

import { fetchStation } from "@/lib/soop/station";
import { fetchVodPage } from "@/lib/soop/vods";
import { isCollectAuthorized } from "@/lib/collect/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * SOOP API 응답 확인용.
 *
 *   GET /api/collect/probe?bj=ldrboo                 방송국 파싱 결과
 *   GET /api/collect/probe?bj=ldrboo&raw=1           원본 JSON 포함
 *   GET /api/collect/probe?bj=ldrboo&kind=vods       게시물 목록의 board_type / bbs_name 분포
 *   GET /api/collect/probe?bj=ldrboo&kind=vods&raw=1 게시물 파싱 결과까지
 *
 * 필드 위치나 board_type 분류가 어긋날 때 실제 값을 눈으로 확인하기 위한 라우트다.
 * (분류 표는 lib/soop/vods.ts 상단에 모여 있다)
 */
export async function GET(request: Request) {
  if (!isCollectAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const channelId = url.searchParams.get("bj");
  const withRaw = url.searchParams.get("raw") === "1";

  if (!channelId) {
    return NextResponse.json({ error: "bj 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    if (url.searchParams.get("kind") === "vods") {
      const page = await fetchVodPage(channelId, 1, 50);

      // board_type / bbs_name 조합별 건수 — 분류 표를 보완할 때 이 값을 보면 된다.
      const distribution = new Map<string, { count: number; kind: string }>();
      for (const item of page.items) {
        const key = `${item.boardType ?? "?"} · ${item.bbsName ?? "?"}`;
        const entry = distribution.get(key) ?? { count: 0, kind: item.kind };
        entry.count += 1;
        distribution.set(key, entry);
      }

      return NextResponse.json({
        channelId,
        total: page.total,
        lastPage: page.lastPage,
        sampled: page.items.length,
        boardTypes: Array.from(distribution.entries()).map(([key, value]) => ({
          boardType: key,
          kind: value.kind,
          count: value.count,
        })),
        ...(withRaw ? { items: page.items } : { sample: page.items.slice(0, 3) }),
      });
    }

    const station = await fetchStation(channelId);
    const { raw, ...parsed } = station;
    return NextResponse.json(withRaw ? { parsed, raw } : { parsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
