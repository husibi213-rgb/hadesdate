/**
 * 관리자 폼 입력 파싱.
 * 빈 문자열은 전부 null 로 바꾼다 — DB 에 "" 가 들어가면
 * 링크·이미지 필드에서 빈 값과 미설정을 구분할 수 없게 된다.
 */

export function text(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function required(form: FormData, key: string, label: string): string {
  const value = text(form, key);
  if (!value) throw new Error(`${label}은(는) 필수입니다.`);
  return value;
}

export function integer(form: FormData, key: string, fallback = 0): number {
  const value = text(form, key);
  if (value === null) return fallback;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

/** 값이 있을 때만 숫자로, 없으면 null (nullable 컬럼용) */
export function optionalInteger(form: FormData, key: string): number | null {
  return text(form, key) === null ? null : integer(form, key);
}

export function checked(form: FormData, key: string): boolean {
  return form.get(key) !== null;
}

export function stringList(form: FormData, key: string): string[] {
  return form.getAll(key).filter((value): value is string => typeof value === "string");
}
