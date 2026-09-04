import "server-only";

import { createClient } from "@/lib/supabase/server";
import { callRpc, guard, type QueryResult } from "@/lib/queries/result";
import type {
  ClickBreakdownRow,
  ClickHourlyRow,
  DailySummary,
  DailyTotalRow,
  MonthSummary,
  MonthlyTotalRow,
  ViewerSeriesPoint,
} from "@/types/database";

const EMPTY_SUMMARY: DailySummary = {
  member_count: 0,
  broadcast_count: 0,
  total_duration_seconds: 0,
  avg_viewers: 0,
  peak_viewers: 0,
  total_views: 0,
  catch_count: 0,
  click_count: 0,
  notice_count: 0,
};

export async function getDailySummary(dateKey: string): Promise<QueryResult<DailySummary>> {
  return guard<DailySummary>(EMPTY_SUMMARY, async () => {
    const supabase = await createClient();
    const rows = await callRpc<DailySummary[]>(supabase, "daily_summary", {
      p_date: dateKey,
    });
    return rows[0] ?? EMPTY_SUMMARY;
  });
}

export async function getViewerSeriesForDate(
  dateKey: string
): Promise<QueryResult<ViewerSeriesPoint[]>> {
  return guard<ViewerSeriesPoint[]>([], async () => {
    const supabase = await createClient();
    return callRpc<ViewerSeriesPoint[]>(supabase, "viewer_series_for_date", { p_date: dateKey });
  });
}

export async function getClickBreakdown(
  from: string | null,
  to: string | null
): Promise<QueryResult<ClickBreakdownRow[]>> {
  return guard<ClickBreakdownRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<ClickBreakdownRow[]>(supabase, "click_breakdown", { p_from: from, p_to: to });
  });
}

/** 한 멤버의 타겟별 클릭 (멤버별 보기 전용) */
export async function getMemberClickBreakdown(
  memberId: string,
  from: string | null,
  to: string | null
): Promise<QueryResult<ClickBreakdownRow[]>> {
  return guard<ClickBreakdownRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<ClickBreakdownRow[]>(supabase, "member_click_breakdown", {
      p_member_id: memberId,
      p_from: from,
      p_to: to,
    });
  });
}

export async function getClickHourly(
  from: string | null,
  to: string | null
): Promise<QueryResult<ClickHourlyRow[]>> {
  return guard<ClickHourlyRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<ClickHourlyRow[]>(supabase, "click_hourly", { p_from: from, p_to: to });
  });
}

/** 한 멤버의 시간대별 클릭 (KST) */
export async function getMemberClickHourly(
  memberId: string,
  from: string | null,
  to: string | null
): Promise<QueryResult<ClickHourlyRow[]>> {
  return guard<ClickHourlyRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<ClickHourlyRow[]>(supabase, "member_click_hourly", {
      p_member_id: memberId,
      p_from: from,
      p_to: to,
    });
  });
}

/* ------------------------- 일간 / 월간 종합 ------------------------- */

const EMPTY_MONTH: MonthSummary = {
  active_days: 0,
  member_count: 0,
  broadcast_count: 0,
  total_duration_seconds: 0,
  avg_viewers: 0,
  peak_viewers: 0,
  total_views: 0,
  catch_count: 0,
  click_count: 0,
  notice_count: 0,
};

/** 기간 내 하루 단위 종합 (월 페이지 일별 그래프) */
export async function getDailyTotals(
  from: string,
  to: string
): Promise<QueryResult<DailyTotalRow[]>> {
  return guard<DailyTotalRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<DailyTotalRow[]>(supabase, "daily_totals", { p_from: from, p_to: to });
  });
}

/** 기간 내 한 달 단위 종합 (연간 추이 / 월 목록) */
export async function getMonthlyTotals(
  from: string,
  to: string
): Promise<QueryResult<MonthlyTotalRow[]>> {
  return guard<MonthlyTotalRow[]>([], async () => {
    const supabase = await createClient();
    return callRpc<MonthlyTotalRow[]>(supabase, "monthly_totals", { p_from: from, p_to: to });
  });
}

/** 특정 월 한 줄 요약 */
export async function getMonthSummary(
  from: string,
  to: string
): Promise<QueryResult<MonthSummary>> {
  return guard<MonthSummary>(EMPTY_MONTH, async () => {
    const supabase = await createClient();
    const rows = await callRpc<MonthSummary[]>(supabase, "month_summary", {
      p_from: from,
      p_to: to,
    });
    return rows[0] ?? EMPTY_MONTH;
  });
}
