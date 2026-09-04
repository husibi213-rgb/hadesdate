import "server-only";

import { logError, toLogInput } from "@/lib/monitor/log-error";

export interface AdminLoad<T> {
  data: T;
  error: string | null;
}

/**
 * 관리자 페이지 데이터 로딩 래퍼.
 * DB 오류로 화면 전체가 500 이 되지 않게 하고, 화면 안에서 원인을 보여준다.
 * (공개 페이지의 lib/queries/result.ts:guard 와 같은 역할)
 */
export async function loadAdmin<T>(fallback: T, run: () => Promise<T>): Promise<AdminLoad<T>> {
  try {
    return { data: await run(), error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void logError(toLogInput("admin", error));
    return { data: fallback, error: message };
  }
}
