/**
 * Supabase 응답 언랩.
 *
 * supabase-js 의 생성 타입은 스키마 정의가 조금만 달라도 select 결과를 `never[]` 로
 * 좁혀 버린다. 그 내부 구조에 의존하지 않도록 캐스팅을 이 함수 하나로 격리하고,
 * 반환 타입은 types/database.ts 로 강제한다.
 */
export function unwrapRows<R>(res: {
  data: unknown;
  error: { message: string } | null;
}): R[] {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as R[];
}
