"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * LIVE 상태 실시간 갱신.
 *
 * broadcasts 테이블 변경을 구독해서 화면을 다시 그린다.
 * Realtime 이 꺼져 있거나 연결이 실패하면 60초 폴링으로 조용히 대체한다.
 * (수집기가 1~3분 간격으로 도는 것을 고려하면 폴링만으로도 충분히 따라간다)
 *
 * 화면 전체를 매번 새로 그리지 않도록 refresh 는 5초에 한 번으로 묶는다.
 */
export function LiveRefresher({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const MIN_INTERVAL = 5000;

    const refresh = () => {
      const now = Date.now();
      const wait = Math.max(0, MIN_INTERVAL - (now - lastRefresh.current));

      if (timer.current) return; // 이미 예약됨
      timer.current = setTimeout(() => {
        timer.current = null;
        lastRefresh.current = Date.now();
        router.refresh();
      }, wait);
    };

    let fallback: ReturnType<typeof setInterval> | null = null;
    const startFallback = () => {
      if (fallback) return;
      fallback = setInterval(refresh, 60_000);
    };

    let cleanup = () => {};

    try {
      const supabase = createClient();
      const channel = supabase
        .channel("hades-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "broadcasts" },
          refresh
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            startFallback();
          }
        });

      cleanup = () => {
        void supabase.removeChannel(channel);
      };
    } catch {
      startFallback();
    }

    return () => {
      cleanup();
      if (fallback) clearInterval(fallback);
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [enabled, router]);

  return null;
}
