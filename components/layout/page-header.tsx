import * as React from "react";

export function PageHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? (
          <div className="mt-1 text-xs text-fg-muted">{description}</div>
        ) : null}
        {meta}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
