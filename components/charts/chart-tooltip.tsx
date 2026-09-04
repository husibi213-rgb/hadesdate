"use client";

import { CHART } from "@/components/charts/chart-theme";
import { formatNumber } from "@/lib/utils/format";

interface Payload {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v: number) => formatNumber(v),
}: {
  active?: boolean;
  payload?: Payload[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className="rounded-lg border px-2.5 py-2 text-xs shadow-lg"
      style={{ background: CHART.tooltipBg, borderColor: CHART.tooltipBorder }}
    >
      {label !== undefined ? (
        <div className="mb-1 text-[11px] text-fg-dim">
          {labelFormatter ? labelFormatter(label) : String(label)}
        </div>
      ) : null}
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="size-1.5 rounded-full"
            style={{ background: entry.color ?? CHART.line }}
          />
          <span className="text-fg-muted">{entry.name}</span>
          <span className="tnum ml-auto font-medium text-fg">
            {typeof entry.value === "number" ? valueFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
