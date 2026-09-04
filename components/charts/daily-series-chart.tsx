"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_PROPS, CHART } from "@/components/charts/chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatCompact } from "@/lib/utils/format";

export interface DailyPoint {
  date: string;
  hours: number;
  avgViewers: number;
  peakViewers: number;
}

/** 일별 방송시간(막대) + 평균/최고 시청자(선) */
export function DailySeriesChart({ data, height = 260 }: { data: DailyPoint[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            {...AXIS_PROPS}
            tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
            minTickGap={24}
          />
          <YAxis yAxisId="left" {...AXIS_PROPS} width={40} tickFormatter={(v: number) => `${v}h`} />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...AXIS_PROPS}
            width={44}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            cursor={{ fill: "#ffffff08" }}
            content={<ChartTooltip labelFormatter={(v) => String(v)} />}
          />
          <Bar yAxisId="left" dataKey="hours" name="방송시간(h)" fill={CHART.bar} radius={[3, 3, 0, 0]} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgViewers"
            name="평균 시청자"
            stroke={CHART.line}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="peakViewers"
            name="최고 시청자"
            stroke={CHART.peak}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
