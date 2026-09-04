import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/env";
import { createStaticClient } from "@/lib/supabase/static";
import { unwrapRows } from "@/lib/supabase/unwrap";
import { addDaysToKey, todayKey } from "@/lib/utils/dates";

export const revalidate = 3600;

/**
 * 사이트맵.
 *
 * 정적 생성 경로이므로 쿠키를 쓰지 않는 클라이언트로 조회한다.
 * 방송이 매우 많아질 수 있어 개별 방송 URL 은 넣지 않고
 * 목록·멤버·최근 90일 날짜 페이지까지만 노출한다.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const today = todayKey();

  const staticPages: MetadataRoute.Sitemap = [
    "",
    "/members",
    "/broadcasts",
    "/calendar",
    "/catches",
    "/clips",
    "/notices",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "hourly" : "daily",
    priority: path === "" ? 1 : 0.7,
  }));

  // 최근 3개월 월 종합
  const monthPages: MetadataRoute.Sitemap = Array.from({ length: 3 }, (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - index);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return {
      url: `${base}/calendar/${y}/${m}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.6,
    };
  });

  if (!isSupabaseConfigured) return [...staticPages, ...monthPages];

  try {
    const supabase = createStaticClient();

    const [membersRes, broadcastsRes] = await Promise.all([
      supabase.from("members").select("id, slug, updated_at").eq("is_active", true),
      supabase
        .from("broadcasts")
        .select("broadcast_date")
        .gte("broadcast_date", addDaysToKey(today, -90))
        .lte("broadcast_date", today)
        .limit(2000),
    ]);

    const members = unwrapRows<{ id: string; slug: string | null; updated_at: string }>(
      membersRes
    );
    const broadcasts = unwrapRows<{ broadcast_date: string }>(broadcastsRes);

    const memberPages: MetadataRoute.Sitemap = members.map((member) => ({
      url: `${base}/members/${member.slug ?? member.id}`,
      lastModified: new Date(member.updated_at),
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const dateKeys = Array.from(new Set(broadcasts.map((row) => row.broadcast_date)));

    const dayPages: MetadataRoute.Sitemap = dateKeys.map((dateKey) => {
      const [y, m, d] = dateKey.split("-");
      return {
        url: `${base}/calendar/${y}/${m}/${d}`,
        lastModified: new Date(`${dateKey}T23:59:59+09:00`),
        changeFrequency: "weekly",
        priority: 0.5,
      };
    });

    return [...staticPages, ...memberPages, ...monthPages, ...dayPages];
  } catch (error) {
    // 사이트맵 때문에 빌드가 깨지지 않게 한다.
    console.error("[hades-data] sitemap 생성 실패:", error);
    return [...staticPages, ...monthPages];
  }
}
