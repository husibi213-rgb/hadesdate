"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_PROPS, CHART } from "@/components/charts/chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatCompact } from "@/lib/utils/format";

export function HourlyBarChart({
  data,
  height = 200,
}: {
  data: { hour: string; clicks: number }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="hour" {...AXIS_PROPS} interval={1} />
          <YAxis {...AXIS_PROPS} width={44} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip cursor={{ fill: "#ffffff08" }} content={<ChartTooltip />} />
          <Bar dataKey="clicks" name="클릭" fill={CHART.barActive} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
