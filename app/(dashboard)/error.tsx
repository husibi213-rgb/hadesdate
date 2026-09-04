"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorState } from "@/components/ui/states";
import { reportClientError } from "@/lib/monitor/report";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    void reportClientError({
      message: error.message,
      digest: error.digest,
      path: pathname,
    });
  }, [error, pathname]);

  return (
    <div className="space-y-4 py-6">
      <ErrorState description={error.message} />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
