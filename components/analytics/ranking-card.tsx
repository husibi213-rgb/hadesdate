import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface RankingEntry {
  id: string;
  slug: string;
  name: string;
  value: number;
  display: string;
}

export function RankingCard({
  title,
  entries,
  limit = 5,
}: {
  title: string;
  entries: RankingEntry[];
  limit?: number;
}) {
  const rows = [...entries].sort((a, b) => b.value - a.value).slice(0, limit);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="py-3 text-center text-xs text-fg-dim">데이터 없음</p>
        ) : (
          rows.map((row, index) => (
            <div key={row.id} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "tnum w-4 shrink-0 text-center font-semibold",
                    index === 0 ? "text-accent" : "text-fg-dim"
                  )}
                >
                  {index + 1}
                </span>
                <Link
                  href={`/members/${row.slug}`}
                  className="truncate text-fg-muted transition-colors hover:text-fg"
                >
                  {row.name}
                </Link>
                <span className="tnum ml-auto font-medium text-fg">{row.display}</span>
              </div>
              <div className="ml-6 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${(row.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
