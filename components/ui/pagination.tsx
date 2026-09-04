import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Pagination({
  page,
  hasNext,
  buildHref,
  className,
}: {
  page: number;
  hasNext: boolean;
  buildHref: (page: number) => string;
  className?: string;
}) {
  const hasPrev = page > 1;

  return (
    <div className={cn("flex items-center justify-between gap-3 pt-1", className)}>
      <span className="tnum text-xs text-fg-dim">페이지 {page}</span>
      <div className="flex items-center gap-1">
        <PageLink href={buildHref(page - 1)} disabled={!hasPrev} label="이전">
          <ChevronLeft className="size-3.5" />
          이전
        </PageLink>
        <PageLink href={buildHref(page + 1)} disabled={!hasNext} label="다음">
          다음
          <ChevronRight className="size-3.5" />
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-0.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors";

  if (disabled) {
    return (
      <span
        aria-disabled
        className={cn(base, "cursor-not-allowed border-border text-fg-dim opacity-50")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        base,
        "border-border bg-surface/60 text-fg-muted hover:border-border-strong hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}
