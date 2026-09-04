import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  title = "데이터가 없습니다",
  description,
  icon,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center",
        className
      )}
    >
      <div className="text-fg-dim">{icon ?? <Inbox className="size-5" />}</div>
      <p className="text-sm font-medium text-fg-muted">{title}</p>
      {description ? <p className="text-xs text-fg-dim">{description}</p> : null}
    </div>
  );
}

export function ErrorState({
  title = "데이터를 불러오지 못했습니다",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-down/30 bg-down/5 px-6 py-10 text-center",
        className
      )}
    >
      <AlertTriangle className="size-5 text-down" />
      <p className="text-sm font-medium text-down">{title}</p>
      {description ? (
        <p className="max-w-md text-xs break-words text-fg-muted">{description}</p>
      ) : null}
    </div>
  );
}
