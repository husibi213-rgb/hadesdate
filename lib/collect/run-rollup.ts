import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysToKey, todayKey } from "@/lib/utils/dates";
import { logError } from "@/lib/monitor/log-error";

export interface RollupResult {
  ranAt: string;
  days: { date: string; rows: number; error?: string }[];
  /** 함께 정리한 오래된 오류 로그 수 */
  prunedErrorLogs: number;
}

interface RpcCapable {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * 원시 click_events → daily_click_stats 집계.
 *
 * 원시 이벤트는 계속 쌓이므로, 오래된 날짜는 집계 테이블만 보고 조회할 수 있게 한다.
 * 기본은 "어제와 오늘" — 자정 직후에 돌려도 전날 데이터가 확정된다.
 * 오늘 날짜는 하루 종일 값이 변하므로 매번 다시 계산한다 (RPC 가 해당 날짜를 지우고 다시 넣는다).
 */
export async function runRollup(dates?: string[]): Promise<RollupResult> {
  const supabase = createAdminClient();
  const today = todayKey();
  const targets = dates?.length ? dates : [addDaysToKey(today, -1), today];

  const days: RollupResult["days"] = [];

  for (const date of targets) {
    const res = await (supabase as unknown as RpcCapable).rpc("rollup_click_stats", {
      p_date: date,
    });

    if (res.error) {
      void logError({
        source: "collect",
        message: `rollup 실패: ${res.error.message}`,
        path: `rollup:${date}`,
      });
      days.push({ date, rows: 0, error: res.error.message });
      continue;
    }

    days.push({ date, rows: typeof res.data === "number" ? res.data : 0 });
  }

  // 오래된 오류 로그도 함께 정리한다 (30일 보관).
  let prunedErrorLogs = 0;
  const pruned = await (supabase as unknown as RpcCapable).rpc("prune_error_logs", {
    p_days: 30,
  });
  if (pruned.error) {
    console.error("[hades-data] prune_error_logs 실패:", pruned.error.message);
  } else if (typeof pruned.data === "number") {
    prunedErrorLogs = pruned.data;
  }

  return { ranAt: new Date().toISOString(), days, prunedErrorLogs };
}
