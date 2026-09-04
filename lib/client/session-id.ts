"use client";

/**
 * 익명 세션 식별자.
 *
 * 브라우저 탭 단위로만 유지되는 무작위 값이다. (sessionStorage)
 * 닉네임·IP·계정 정보와 아무 관련이 없고, 서버에서 다시 해시되어 저장되므로
 * 저장된 값으로 방문자를 역추적할 수 없다. 목적은 "몇 명이 눌렀는지"를 세는 것뿐이다.
 */

const KEY = "hades_sid";

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;

    const created =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);

    window.sessionStorage.setItem(KEY, created);
    return created;
  } catch {
    // 스토리지가 막힌 브라우저(사생활 보호 모드 등)에서는 세션 구분 없이 집계된다.
    return null;
  }
}
