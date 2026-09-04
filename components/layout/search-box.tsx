"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * 상단 검색창.
 * 제출하면 /search?q= 로 이동한다 — 결과는 서버에서 렌더하므로
 * 타이핑 중 요청을 보내지 않는다.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (query.length === 0) return;
        router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
      className={cn("relative", className)}
    >
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-dim" />
      <input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="멤버 · 방송 · 캐치 · 공지 검색"
        aria-label="검색"
        className="w-full rounded-md border border-border bg-surface-2/70 py-1.5 pr-2.5 pl-8 text-xs text-fg outline-none transition-colors placeholder:text-fg-dim focus:border-accent/60"
      />
    </form>
  );
}
