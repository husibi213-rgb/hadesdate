/**
 * Supabase 스키마 타입.
 * supabase/migrations/*.sql 과 1:1로 대응한다.
 * (`supabase gen types typescript` 로 재생성해도 동일한 형태가 되도록 유지한다)
 */

export type BroadcastStatus = "live" | "ended" | "cancelled";
export type NoticeSource = "cafe" | "broadcast_station" | "other";
export type ClickTargetType =
  | "broadcast"
  | "member"
  | "catch"
  | "vod"
  | "profile"
  | "notice"
  | "external";

export interface MemberRow {
  id: string;
  name: string;
  slug: string | null;
  channel_id: string | null;
  channel_url: string | null;
  profile_image_url: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BroadcastRow {
  id: string;
  member_id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  avg_viewers: number;
  peak_viewers: number;
  views: number;
  followers_gained: number;
  vod_url: string | null;
  thumbnail_url: string | null;
  status: BroadcastStatus;
  external_id: string | null;
  created_at: string;
  updated_at: string;
  broadcast_date: string;
}

export interface ViewerSnapshotRow {
  id: number;
  broadcast_id: string;
  recorded_at: string;
  viewers: number;
  clicks: number | null;
  followers: number | null;
}

export interface CatchRow {
  id: string;
  broadcast_id: string | null;
  member_id: string;
  title: string | null;
  description: string | null;
  catch_url: string;
  thumbnail_url: string | null;
  broadcast_timestamp: number | null;
  views: number;
  likes: number;
  external_id: string | null;
  published_at: string | null;
  created_at: string;
  /** 캐치 발생 날짜(KST). generated column. */
  catch_date: string;
}

export interface ClickEventRow {
  id: number;
  broadcast_id: string | null;
  member_id: string | null;
  target_type: ClickTargetType;
  target_id: string | null;
  session_hash: string | null;
  clicked_at: string;
}

export interface NoticeRow {
  id: string;
  source: NoticeSource;
  external_id: string | null;
  title: string;
  summary: string | null;
  content: string | null;
  url: string | null;
  published_at: string | null;
  created_at: string;
}

export interface MemberNoticeRow {
  member_id: string;
  notice_id: string;
}

export interface ErrorLogRow {
  id: number;
  occurred_at: string;
  first_seen: string;
  source: string;
  fingerprint: string;
  message: string;
  detail: string | null;
  path: string | null;
  count: number;
  created_at: string;
}

export interface DailyClickStatRow {
  stat_date: string;
  member_id: string | null;
  broadcast_id: string | null;
  target_type: ClickTargetType;
  click_count: number;
  unique_sessions: number;
  updated_at: string;
}

/* ------------------------- RPC 반환 타입 ------------------------- */

export interface MemberStats {
  broadcast_count: number;
  total_duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  total_views: number;
  total_followers: number;
  catch_count: number;
}

export interface MemberDailyPoint {
  stat_date: string;
  broadcast_count: number;
  duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  views: number;
}

export interface DailySummary {
  member_count: number;
  broadcast_count: number;
  total_duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  total_views: number;
  catch_count: number;
  click_count: number;
  notice_count: number;
}

export interface MemberComparisonRow {
  member_id: string;
  name: string;
  slug: string | null;
  profile_image_url: string | null;
  broadcast_count: number;
  total_duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  total_views: number;
  catch_count: number;
  click_count: number;
}

export interface ClickBreakdownRow {
  target_type: ClickTargetType;
  click_count: number;
  unique_sessions: number;
}

export interface ClickHourlyRow {
  hour: number;
  click_count: number;
}

export interface DailyTotalRow {
  stat_date: string;
  member_count: number;
  broadcast_count: number;
  duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  views: number;
  catch_count: number;
}

export interface MonthlyTotalRow {
  month_start: string;
  active_days: number;
  member_count: number;
  broadcast_count: number;
  duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  views: number;
  catch_count: number;
}

export interface MonthSummary {
  active_days: number;
  member_count: number;
  broadcast_count: number;
  total_duration_seconds: number;
  avg_viewers: number;
  peak_viewers: number;
  total_views: number;
  catch_count: number;
  click_count: number;
  notice_count: number;
}

export type SearchKind = "member" | "broadcast" | "catch" | "notice";

export interface SearchResultRow {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  member_name: string | null;
  member_slug: string | null;
  occurred_on: string | null;
  href: string;
  metric: number;
}

export interface ViewerSeriesPoint {
  bucket: string;
  total_viewers: number;
  live_count: number;
}

/* --------------------------- Database --------------------------- */

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  /** supabase-js 가 스키마 버전을 판별할 때 사용한다. */
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      members: TableDef<MemberRow>;
      broadcasts: TableDef<BroadcastRow>;
      viewer_snapshots: TableDef<ViewerSnapshotRow>;
      catches: TableDef<CatchRow>;
      click_events: TableDef<ClickEventRow>;
      notices: TableDef<NoticeRow>;
      member_notices: TableDef<MemberNoticeRow>;
      daily_click_stats: TableDef<DailyClickStatRow>;
      error_logs: TableDef<ErrorLogRow>;
    };
    Views: Record<never, never>;
    Functions: {
      member_stats: {
        Args: { p_member_id: string; p_from?: string | null; p_to?: string | null };
        Returns: MemberStats[];
      };
      member_daily_series: {
        Args: { p_member_id: string; p_from: string; p_to: string };
        Returns: MemberDailyPoint[];
      };
      daily_summary: { Args: { p_date: string }; Returns: DailySummary[] };
      member_comparison: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: MemberComparisonRow[];
      };
      click_breakdown: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: ClickBreakdownRow[];
      };
      click_hourly: {
        Args: { p_from?: string | null; p_to?: string | null };
        Returns: ClickHourlyRow[];
      };
      broadcast_click_breakdown: {
        Args: { p_broadcast_id: string };
        Returns: ClickBreakdownRow[];
      };
      viewer_series_for_date: { Args: { p_date: string }; Returns: ViewerSeriesPoint[] };
      daily_totals: { Args: { p_from: string; p_to: string }; Returns: DailyTotalRow[] };
      monthly_totals: { Args: { p_from: string; p_to: string }; Returns: MonthlyTotalRow[] };
      month_summary: { Args: { p_from: string; p_to: string }; Returns: MonthSummary[] };
      search_all: { Args: { p_query: string; p_limit?: number }; Returns: SearchResultRow[] };
      record_error: {
        Args: {
          p_source: string;
          p_fingerprint: string;
          p_message: string;
          p_detail?: string | null;
          p_path?: string | null;
        };
        Returns: number;
      };
      prune_error_logs: { Args: { p_days?: number }; Returns: number };
      rollup_click_stats: { Args: { p_date: string }; Returns: number };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
