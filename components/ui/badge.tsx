import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none",
  {
    variants: {
      variant: {
        neutral: "border-border bg-surface-2 text-fg-muted",
        live: "border-live/40 bg-live/10 text-live",
        up: "border-up/40 bg-up/10 text-up",
        down: "border-down/40 bg-down/10 text-down",
        warn: "border-warn/40 bg-warn/10 text-warn",
        accent: "border-accent/40 bg-accent/10 text-accent",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge variant="live" className={className}>
      <span className="live-dot size-1.5 rounded-full bg-live" />
      LIVE
    </Badge>
  );
}
