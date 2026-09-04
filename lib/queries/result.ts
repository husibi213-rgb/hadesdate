import "server-only";
import { isSupabaseConfigured } from "@/lib/env";
import { logError, toLogInput } from "@/lib/monitor/log-error";

export interface QueryResult<T> {
  data: T;
  error: string | null;
  /** Supabase 환경변수가 없어 아직 연결되지 않은 상태 */
  notConfigured: boolean;
}

export function ok<T>(data: T): QueryResult<T> {
  return { data, error: null, notConfigured: false };
}

export function fail<T>(fallback: T, error: unknown): QueryResult<T> {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "알 수 없는 오류";
  return { data: fallback, error: message, notConfigured: false };
}

/**
 * 모든 쿼리의 공통 래퍼.
 * - Supabase 미설정 시 즉시 fallback 반환 (빌드/미리보기가 깨지지 않도록)
 * - 예외를 삼키지 않고 error 문자열로 전달 -> 페이지에서 error 상태 렌더
 */
export async function guard<T>(
  fallback: T,
  run: () => Promise<T>
): Promise<QueryResult<T>> {
  if (!isSupabaseConfigured) {
    return { data: fallback, error: null, notConfigured: true };
  }
  try {
    return ok(await run());
  } catch (error) {
    void logError(toLogInput("query", error));
    return fail(fallback, error);
  }
}

/** Supabase 응답 언랩 */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

/**
 * RPC 호출 헬퍼.
 * supabase-js 의 생성 타입 내부 구조에 의존하지 않기 위해,
 * 캐스팅은 이 한 곳으로만 격리하고 반환 타입은 types/database.ts 로 강제한다.
 */
interface RpcCapable {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export async function callRpc<T>(
  supabase: unknown,
  fn: string,
  args: Record<string, unknown>
): Promise<T> {
  const res = await (supabase as RpcCapable).rpc(fn, args);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}
