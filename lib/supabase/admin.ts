import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { SUPABASE_URL, requireServiceRoleKey } from "@/lib/env";

/**
 * Service Role 클라이언트. RLS 를 우회한다.
 * 절대로 브라우저 번들에 포함되면 안 된다. (수집기 / 관리자 API 전용)
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(SUPABASE_URL, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * 관리자 INSERT 헬퍼.
 * supabase-js 의 생성 타입 내부 구조에 의존하지 않도록 캐스팅을 이 한 곳으로 격리하고,
 * 입력 타입은 types/database.ts 의 Row 로 강제한다.
 */
interface InsertCapable {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
  };
}

export async function insertRows<T extends object>(
  client: unknown,
  table: keyof Database["public"]["Tables"],
  rows: T[]
): Promise<void> {
  const { error } = await (client as InsertCapable).from(table as string).insert(rows);
  if (error) throw new Error(error.message);
}

/** INSERT 후 생성된 행을 돌려받는다. */
interface InsertReturningCapable {
  from: (table: string) => {
    insert: (rows: unknown) => {
      select: (columns: string) => Promise<{
        data: unknown;
        error: { message: string } | null;
      }>;
    };
  };
}

export async function insertReturning<R, T extends object = object>(
  client: unknown,
  table: keyof Database["public"]["Tables"],
  rows: T[],
  columns: string
): Promise<R[]> {
  const res = await (client as InsertReturningCapable)
    .from(table as string)
    .insert(rows)
    .select(columns);
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as R[];
}

/** Supabase 응답 언랩 (관리자 클라이언트용). */
export function unwrapAdmin<R>(res: {
  data: unknown;
  error: { message: string } | null;
}): R[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as R[];
}

/** 관리자 UPDATE 헬퍼. insertRows 와 같은 이유로 캐스팅을 여기 한 곳에 격리한다. */
interface UpdateCapable {
  from: (table: string) => {
    update: (values: unknown) => {
      match: (filter: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export async function updateRows<T extends object>(
  client: unknown,
  table: keyof Database["public"]["Tables"],
  values: T,
  match: Record<string, unknown>
): Promise<void> {
  const { error } = await (client as UpdateCapable)
    .from(table as string)
    .update(values)
    .match(match);
  if (error) throw new Error(error.message);
}

/** 관리자 DELETE 헬퍼. */
interface DeleteCapable {
  from: (table: string) => {
    delete: () => {
      match: (filter: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    };
  };
}

export async function deleteRows(
  client: unknown,
  table: keyof Database["public"]["Tables"],
  match: Record<string, unknown>
): Promise<void> {
  const { error } = await (client as DeleteCapable).from(table as string).delete().match(match);
  if (error) throw new Error(error.message);
}
