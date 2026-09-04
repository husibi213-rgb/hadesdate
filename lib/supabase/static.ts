import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * 쿠키를 쓰지 않는 익명 클라이언트.
 *
 * sitemap.ts / robots.ts 처럼 **정적으로 생성되는 파일**에서 쓴다.
 * lib/supabase/server.ts 는 cookies() 를 읽기 때문에 그 경로에서 쓰면
 * "Route couldn't be rendered statically because it used cookies" 로 떨어진다.
 */
export function createStaticClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
