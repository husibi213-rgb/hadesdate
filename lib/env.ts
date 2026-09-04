/**
 * 환경변수 접근 지점.
 *
 * .env.example 을 그대로 복사하면 값이 **빈 문자열**로 들어온다.
 * `process.env.X ?? fallback` 은 빈 문자열에서 폴백하지 않으므로
 * 반드시 이 헬퍼를 거쳐 읽는다.
 */

/** 값이 없거나 공백뿐이면 undefined */
export function envValue(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

export function envValueOr(name: string, fallback: string): string {
  return envValue(name) ?? fallback;
}

export const SUPABASE_URL = envValue("NEXT_PUBLIC_SUPABASE_URL") ?? "";
export const SUPABASE_ANON_KEY = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "";

/** Supabase 가 연결되었는지 (연결 전에는 빈 화면 대신 안내를 띄운다) */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

export function requireServiceRoleKey(): string {
  const key = envValue("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. 서버 전용 환경변수입니다."
    );
  }
  return key;
}

export function hasServiceRoleKey(): boolean {
  return envValue("SUPABASE_SERVICE_ROLE_KEY") !== undefined;
}
