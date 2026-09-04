import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Section({
  title,
  description,
  action,
  href,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-fg">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-fg-muted">{description}</p>
          ) : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 text-xs text-fg-muted transition-colors hover:text-fg"
          >
            전체 보기
            <ChevronRight className="size-3.5" />
          </Link>
        ) : (
          action
        )}
      </div>
      {children}
    </section>
  );
}
