"use server";

import { logError } from "@/lib/monitor/log-error";

/**
 * 클라이언트(브라우저)에서 발생한 오류를 남긴다.
 *
 * 공개 경로이므로 방어적으로 다룬다:
 *  - 길이를 자르고
 *  - source 를 "client" 로 고정하며
 *  - logError 의 지문 중복 제거로 같은 오류가 쏟아지지 않게 한다.
 */
export async function reportClientError(input: {
  message: string;
  digest?: string;
  path?: string;
}): Promise<void> {
  const message = String(input.message ?? "").slice(0, 500) || "알 수 없는 클라이언트 오류";
  const digest = input.digest ? String(input.digest).slice(0, 100) : null;

  await logError({
    source: "client",
    message,
    detail: digest ? `digest: ${digest}` : null,
    path: input.path ? String(input.path).slice(0, 300) : null,
  });
}
