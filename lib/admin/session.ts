import "server-only";

import { cookies } from "next/headers";

import { envValue, hasServiceRoleKey, isSupabaseConfigured } from "@/lib/env";
import { createSessionToken, safeEqual, verifySessionToken } from "@/lib/admin/token";

/**
 * 관리자 세션.
 *
 * 별도의 사용자 테이블을 두지 않고 ADMIN_PASSWORD 하나로 들어간다.
 * 쿠키에는 비밀번호를 넣지 않고 `만료시각.서명` 형태의 토큰만 저장하며,
 * 서명 키는 ADMIN_SESSION_SECRET (없으면 ADMIN_PASSWORD) 이다.
 *
 * 인증은 세 곳에서 각각 확인한다.
 *   1. app/admin/layout.tsx  — 화면 진입
 *   2. 각 admin 페이지 첫 줄 — 데이터 조회 전
 *   3. 모든 server action    — 쓰기 직전 (assertAdmin)
 * 화면 가드만 믿지 않는다.
 */

const COOKIE_NAME = "hades_admin";
const SESSION_HOURS = 12;

export function isAdminConfigured(): boolean {
  return envValue("ADMIN_PASSWORD") !== undefined;
}

/**
 * 세션 서명 키.
 * ADMIN_SESSION_SECRET 이 비어 있으면(=.env 를 그대로 복사한 경우)
 * ADMIN_PASSWORD 로 폴백한다. envValue 가 빈 문자열을 undefined 로 만들어 주므로
 * `??` 폴백이 의도대로 동작한다.
 */
function secret(): string {
  const value = envValue("ADMIN_SESSION_SECRET") ?? envValue("ADMIN_PASSWORD");
  if (!value) throw new Error("ADMIN_PASSWORD 가 설정되지 않았습니다.");
  return value;
}

export function verifyPassword(input: string): boolean {
  const expected = envValue("ADMIN_PASSWORD");
  if (!expected) return false;
  return safeEqual(input, expected);
}

export async function startAdminSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(secret(), SESSION_HOURS * 3600), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function endAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete({ name: COOKIE_NAME, path: "/admin" });
}

export async function isAdminSession(): Promise<boolean> {
  if (!isAdminConfigured()) return false;
  try {
    const store = await cookies();
    return verifySessionToken(store.get(COOKIE_NAME)?.value, secret());
  } catch (error) {
    // 설정 문제로 화면 전체가 500 이 되지 않게 한다.
    console.error("[hades-data] admin session check failed:", error);
    return false;
  }
}

export type AdminGateReason = "supabase-missing" | "not-configured" | "signed-out";

export type AdminGate = { ok: true } | { ok: false; reason: AdminGateReason };

/**
 * 페이지 첫 줄에서 호출한다. 데이터 조회는 ok 인 경우에만 한다.
 * 관리자 쓰기는 service role 키가 필요하므로 그것도 함께 확인한다.
 */
export async function adminGate(): Promise<AdminGate> {
  if (!isSupabaseConfigured || !hasServiceRoleKey()) {
    return { ok: false, reason: "supabase-missing" };
  }
  if (!isAdminConfigured()) return { ok: false, reason: "not-configured" };
  return (await isAdminSession()) ? { ok: true } : { ok: false, reason: "signed-out" };
}

/** server action 첫 줄에서 호출한다. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new Error("관리자 인증이 필요합니다.");
  }
}
