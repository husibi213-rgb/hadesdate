/**
 * 환경변수 접근 지점.
 *
 * .env.example 을 그대로 복사하면 값이 **빈 문자열**로 들어온다.
 * `process.env.X ?? 기본값` 은 빈 문자열에서 폴백하지 않으므로
 * 반드시 blank() 를 거쳐 읽는다.
 *
 * NEXT_PUBLIC_ 값은 **반드시 정적 접근**(`process.env.NEXT_PUBLIC_FOO`)으로 읽어야 한다.
 * 번들러는 이 형태만 빌드 시점에 실제 값으로 치환한다. `process.env[name]` 처럼
 * 계산된 키로 읽으면 브라우저 번들에서 undefined 가 되어 클라이언트 Supabase 가 죽는다.
 */

/** 값이 없거나 공백뿐이면 undefined */
function blank(raw: string | undefined): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** 서버 전용 변수 읽기 (브라우저 번들에서는 쓰지 않는다) */
export function envValue(name: string): string | undefined {
  return blank(process.env[name]);
}

export function envValueOr(name: string, fallback: string): string {
  return envValue(name) ?? fallback;
}

/* --------------------- 공개 변수 (정적 접근 필수) --------------------- */

export const SUPABASE_URL = blank(process.env.NEXT_PUBLIC_SUPABASE_URL) ?? "";
export const SUPABASE_ANON_KEY = blank(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ?? "";
export const PUBLIC_SITE_URL = blank(process.env.NEXT_PUBLIC_SITE_URL);

/** Supabase 가 연결되었는지 (연결 전에는 빈 화면 대신 안내를 띄운다) */
export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/* --------------------------- 서버 전용 --------------------------- */

export function requireServiceRoleKey(): string {
  const key = blank(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다. 서버 전용 환경변수입니다."
    );
  }
  return key;
}

export function hasServiceRoleKey(): boolean {
  return blank(process.env.SUPABASE_SERVICE_ROLE_KEY) !== undefined;
}
