"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { ErrorState } from "@/components/ui/states";
import { reportClientError } from "@/lib/monitor/report";
import { Button } from "@/components/admin/form";

export default function AdminError({
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
      <ErrorState
        title="관리자 작업 중 오류가 발생했습니다"
        description={error.message}
      />
      <div className="flex flex-col items-center gap-2">
        <Button variant="ghost" type="button" onClick={reset}>
          다시 시도
        </Button>
        <p className="max-w-md text-center text-[11px] leading-relaxed text-fg-dim">
          Supabase URL·키가 올바른지, 마이그레이션(001~006)이 모두 적용됐는지 확인해 주세요.
        </p>
      </div>
    </div>
  );
}
