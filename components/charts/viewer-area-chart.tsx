"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_PROPS, CHART } from "@/components/charts/chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatTime } from "@/lib/utils/dates";
import { formatCompact } from "@/lib/utils/format";

export interface ViewerPoint {
  t: string;
  viewers: number;
}

export function ViewerAreaChart({
  data,
  height = 220,
  label = "시청자",
}: {
  data: ViewerPoint[];
  height?: number;
  label?: string;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id="viewerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART.line} stopOpacity={0.35} />
              <stop offset="100%" stopColor={CHART.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" {...AXIS_PROPS} tickFormatter={(v: string) => formatTime(v)} minTickGap={32} />
          <YAxis {...AXIS_PROPS} width={48} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip
            cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }}
            content={<ChartTooltip labelFormatter={(v) => formatTime(String(v))} />}
          />
          <Area
            type="monotone"
            dataKey="viewers"
            name={label}
            stroke={CHART.line}
            strokeWidth={2}
            fill="url(#viewerFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
