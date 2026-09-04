import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export interface FilterTabItem {
  key: string;
  label: string;
  href: string;
}

/**
 * 링크 기반 필터. 상태를 URL 에 두므로 서버 컴포넌트에서 그대로 필터링할 수 있다.
 * (클라이언트 fetch 를 만들지 않기 위한 선택)
 */
export function FilterTabs({
  items,
  activeKey,
  className,
}: {
  items: FilterTabItem[];
  activeKey: string;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-wrap items-center gap-1", className)}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Link
            key={item.key}
            href={item.href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-border-strong bg-surface-3 text-fg"
                : "border-border bg-surface/60 text-fg-muted hover:border-border-strong hover:text-fg"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
