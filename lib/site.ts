import { envValue } from "@/lib/env";

/**
 * 사이트 절대 URL.
 * NEXT_PUBLIC_SITE_URL 이 없으면 Vercel 이 넣어주는 값을 쓰고,
 * 그것도 없으면 로컬 주소로 떨어진다.
 */
export function siteUrl(): string {
  const explicit = envValue("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = envValue("VERCEL_PROJECT_PRODUCTION_URL") ?? envValue("VERCEL_URL");
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}
