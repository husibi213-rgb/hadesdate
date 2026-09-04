import "server-only";

import { envValue } from "@/lib/env";

/**
 * 수집 API 인증.
 * COLLECT_SECRET 이 설정되어 있으면 x-collect-secret 헤더가 일치해야만 실행한다.
 * (설정되어 있지 않으면 로컬 개발 편의를 위해 통과시키되, 배포 환경에서는 반드시 설정한다)
 */
export function isCollectAuthorized(request: Request): boolean {
  const secret = envValue("COLLECT_SECRET");
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-collect-secret") === secret;
}
