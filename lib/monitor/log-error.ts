import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey, isSupabaseConfigured } from "@/lib/env";

/**
 * 자체 오류 로그.
 *
 * 원칙 세 가지:
 *  1. **절대 예외를 던지지 않는다.** 로깅 실패가 화면을 깨면 안 된다.
 *  2. **재귀하지 않는다.** DB 가 죽어서 난 오류를 DB 에 쓰려다 또 실패하는 고리를 끊는다.
 *  3. **개인정보를 담지 않는다.** 메시지·스택 요약·경로만 남긴다.
 */

export type ErrorSource = "query" | "admin" | "collect" | "api" | "client";

/** 같은 지문을 짧은 시간 안에 반복 기록하지 않기 위한 메모리 캐시 */
const recentlyLogged = new Map<string, number>();
const DEDUPE_WINDOW_MS = 60_000;
const MAX_CACHE = 200;

/** 로그 쓰기 자체가 실패한 뒤에는 잠시 시도하지 않는다 */
let backoffUntil = 0;
const BACKOFF_MS = 5 * 60_000;

interface RpcCapable {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ error: { message: string } | null }>;
}

export function fingerprintOf(source: string, message: string): string {
  // 메시지에 섞이는 uuid/숫자를 지워 같은 오류가 흩어지지 않게 한다.
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 500);
  return createHash("sha256").update(`${source}|${normalized}`).digest("hex").slice(0, 32);
}

function shouldSkip(fingerprint: string, now: number): boolean {
  const last = recentlyLogged.get(fingerprint);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return true;

  if (recentlyLogged.size >= MAX_CACHE) recentlyLogged.clear();
  recentlyLogged.set(fingerprint, now);
  return false;
}

export interface LogErrorInput {
  source: ErrorSource;
  message: string;
  detail?: string | null;
  path?: string | null;
}

export async function logError({
  source,
  message,
  detail,
  path,
}: LogErrorInput): Promise<void> {
  const now = Date.now();

  // 콘솔에는 항상 남긴다 — DB 저장은 부가 기능이다.
  console.error(`[hades-data:${source}] ${message}`);

  if (!isSupabaseConfigured || !hasServiceRoleKey()) return;
  if (now < backoffUntil) return;

  const fingerprint = fingerprintOf(source, message);
  if (shouldSkip(fingerprint, now)) return;

  try {
    const supabase = createAdminClient();
    const res = await (supabase as unknown as RpcCapable).rpc("record_error", {
      p_source: source,
      p_fingerprint: fingerprint,
      p_message: message,
      p_detail: detail ?? null,
      p_path: path ?? null,
    });

    if (res.error) {
      backoffUntil = now + BACKOFF_MS;
      console.error("[hades-data] error log write failed:", res.error.message);
    }
  } catch (error) {
    // 여기서 다시 logError 를 부르지 않는다 (재귀 방지).
    backoffUntil = now + BACKOFF_MS;
    console.error("[hades-data] error log write threw:", error);
  }
}

/** 예외 객체를 로그 입력으로 바꾼다. */
export function toLogInput(
  source: ErrorSource,
  error: unknown,
  path?: string | null
): LogErrorInput {
  if (error instanceof Error) {
    return {
      source,
      message: error.message,
      // 스택은 앞부분만 남긴다 — 원인 파악에는 충분하고 저장은 가볍다.
      detail: error.stack?.split("\n").slice(0, 6).join("\n") ?? null,
      path: path ?? null,
    };
  }
  return { source, message: String(error), detail: null, path: path ?? null };
}
