import type { MemberDailyPoint } from "@/types/database";

/**
 * 멤버 일별 시계열을 월 단위로 묶는다.
 *
 * 월별 종합은 DB 에도 monthly_totals 가 있지만 그건 전 멤버 합산이다.
 * 멤버별 월 종합을 위해 RPC 를 하나 더 만드는 대신,
 * 이미 받아 온 일별 데이터를 재사용해 서버 컴포넌트 안에서 접는다.
 * (일별 포인트는 기간 상한이 걸려 있어 양이 크지 않다)
 */

export interface MemberMonthlyRow {
  /** YYYY-MM */
  monthKey: string;
  year: number;
  month: number;
  /** 방송이 있었던 날 수 */
  activeDays: number;
  broadcastCount: number;
  durationSeconds: number;
  /** 방송시간으로 가중한 평균 시청자 (짧은 방송이 평균을 흔들지 않도록) */
  avgViewers: number;
  peakViewers: number;
  views: number;
}

export function groupMemberSeriesByMonth(points: MemberDailyPoint[]): MemberMonthlyRow[] {
  const buckets = new Map<
    string,
    { row: MemberMonthlyRow; weightedViewers: number; weight: number; plainSum: number }
  >();

  for (const point of points) {
    const monthKey = point.stat_date.slice(0, 7);
    let bucket = buckets.get(monthKey);

    if (!bucket) {
      bucket = {
        row: {
          monthKey,
          year: Number(monthKey.slice(0, 4)),
          month: Number(monthKey.slice(5, 7)),
          activeDays: 0,
          broadcastCount: 0,
          durationSeconds: 0,
          avgViewers: 0,
          peakViewers: 0,
          views: 0,
        },
        weightedViewers: 0,
        weight: 0,
        plainSum: 0,
      };
      buckets.set(monthKey, bucket);
    }

    const { row } = bucket;
    if (point.broadcast_count > 0) row.activeDays += 1;
    row.broadcastCount += point.broadcast_count;
    row.durationSeconds += point.duration_seconds;
    row.views += point.views;
    row.peakViewers = Math.max(row.peakViewers, point.peak_viewers);

    bucket.weightedViewers += point.avg_viewers * point.duration_seconds;
    bucket.weight += point.duration_seconds;
    bucket.plainSum += point.avg_viewers;
  }

  return Array.from(buckets.values())
    .map(({ row, weightedViewers, weight, plainSum }) => ({
      ...row,
      avgViewers:
        weight > 0
          ? Math.round(weightedViewers / weight)
          : row.activeDays > 0
            ? Math.round(plainSum / row.activeDays)
            : 0,
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}
