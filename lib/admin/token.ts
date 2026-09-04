import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * 관리자 세션 토큰 (순수 함수).
 * 형식: `만료시각(ms).난수.HMAC-SHA256(만료시각.난수)`
 * 비밀번호 자체는 토큰에 들어가지 않는다.
 */

/** 문자열 비교를 상수 시간으로 처리한다. 길이가 달라도 비교 시간을 맞춘다. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createSessionToken(secret: string, ttlSeconds: number, now = Date.now()): string {
  const payload = `${now + ttlSeconds * 1000}.${randomBytes(8).toString("hex")}`;
  return `${payload}.${sign(secret, payload)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  now = Date.now()
): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expires, nonce, signature] = parts;
  if (!safeEqual(signature, sign(secret, `${expires}.${nonce}`))) return false;

  const expiresAt = Number(expires);
  return Number.isFinite(expiresAt) && expiresAt > now;
}
