import Link from "next/link";
import { EmptyState } from "@/components/ui/states";

export default function BroadcastNotFound() {
  return (
    <div className="space-y-4 py-10">
      <EmptyState title="방송을 찾을 수 없습니다" description="삭제되었거나 잘못된 주소입니다." />
      <div className="flex justify-center">
        <Link
          href="/broadcasts"
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
        >
          방송 목록으로
        </Link>
      </div>
    </div>
  );
}
