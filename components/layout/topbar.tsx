import Link from "next/link";
import { Radio } from "lucide-react";
import { LiveBadge } from "@/components/ui/badge";
import { SearchBox } from "@/components/layout/search-box";

export function Topbar({ liveCount }: { liveCount: number }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-2 lg:hidden">
          <span className="text-sm font-bold tracking-[0.18em]">HADES</span>
          <span className="text-[11px] tracking-[0.3em] text-fg-dim">DATA</span>
        </Link>
        <SearchBox className="hidden w-full max-w-xs sm:block" />

        <div className="ml-auto flex items-center gap-2">
          {liveCount > 0 ? (
            <>
              <LiveBadge />
              <span className="tnum text-xs font-medium text-fg-muted">
                {liveCount}명 방송중
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-fg-dim">
              <Radio className="size-3.5" />
              현재 방송 없음
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
