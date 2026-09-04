import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** 모바일에서는 가로 스크롤로 처리한다. */
export function TableWrap({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "-mx-1 overflow-x-auto rounded-xl border border-border bg-surface/70 px-1",
        className
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table className={cn("w-full min-w-[640px] border-collapse text-sm", className)} {...props} />
  );
}

export function Th({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-border px-3 py-2.5 text-left text-[11px] font-medium tracking-wide text-fg-muted uppercase whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      className={cn("border-b border-border/60 px-3 py-2.5 whitespace-nowrap", className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-2/60", className)} {...props} />;
}
