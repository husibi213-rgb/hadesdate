import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function StatCard({
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  tone?: "neutral" | "live" | "up" | "down" | "warn" | "accent";
  icon?: React.ReactNode;
  className?: string;
}) {
  const toneClass = {
    neutral: "text-fg",
    live: "text-live",
    up: "text-up",
    down: "text-down",
    warn: "text-warn",
    accent: "text-accent",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface/70 px-4 py-3.5 transition-colors hover:border-border-strong",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-fg-muted uppercase">
          {label}
        </span>
        {icon ? <span className="text-fg-dim">{icon}</span> : null}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn("tnum text-2xl font-semibold tracking-tight", toneClass)}>
          {value}
        </span>
        {unit ? <span className="text-xs text-fg-muted">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-fg-dim">{hint}</div> : null}
    </div>
  );
}
