"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/lib/nav";
import { cn } from "@/lib/utils/cn";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-border bg-surface/60 backdrop-blur-sm lg:flex">
      <Link href="/" className="flex flex-col gap-0.5 px-5 py-5">
        <span className="text-sm font-bold tracking-[0.18em] text-fg">HADES</span>
        <span className="text-[11px] font-medium tracking-[0.3em] text-fg-dim">DATA</span>
      </Link>

      <nav className="flex-1 space-y-0.5 px-2.5 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-surface-3 text-fg"
                  : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] leading-relaxed text-fg-dim">
        SOOP 하데스 방송 데이터 아카이브
      </div>
    </aside>
  );
}
