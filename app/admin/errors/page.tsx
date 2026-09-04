import { AlertTriangle } from "lucide-react";

import { adminGate } from "@/lib/admin/session";
import { getErrorLogs } from "@/lib/admin/queries";
import { loadAdmin } from "@/lib/admin/load";
import { clearErrorLogs } from "@/lib/admin/actions";
import { LoginScreen } from "@/components/admin/login-screen";
import { Button, FormNotice, RowEditor } from "@/components/admin/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { formatDateTime } from "@/lib/utils/dates";
import { formatNumber } from "@/lib/utils/format";
import type { ErrorLogRow } from "@/types/database";

export const metadata = { title: "오류" };

const SOURCE_LABELS: Record<string, string> = {
  query: "공개 페이지 조회",
  admin: "관리자 조회",
  collect: "수집",
  api: "API",
  client: "브라우저",
};

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const gate = await adminGate();
  const sp = await searchParams;
  if (!gate.ok) return <LoginScreen reason={gate.reason} error={sp.error} />;

  const loaded = await loadAdmin<ErrorLogRow[]>([], () => getErrorLogs(50));
  const logs = loaded.data;

  return (
    <>
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-lg font-semibold tracking-tight">오류</h1>
        <p className="text-xs text-fg-muted">
          같은 오류는 한 행으로 묶여 발생 횟수만 올라갑니다. 30일이 지나면 자동으로 정리됩니다.
        </p>
      </div>

      <FormNotice ok={sp.ok} error={sp.error} />

      {loaded.error ? <ErrorState description={loaded.error} /> : null}

      {logs.length === 0 ? (
        <EmptyState
          title="기록된 오류가 없습니다"
          description="정상입니다. 오류가 나면 발생 위치와 함께 여기에 쌓입니다."
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-fg-muted">
              최근 {formatNumber(logs.length)}종 · 총{" "}
              {formatNumber(logs.reduce((sum, log) => sum + log.count, 0))}회
            </p>
            <form action={clearErrorLogs}>
              <Button variant="ghost" type="submit">
                전체 지우기
              </Button>
            </form>
          </div>

          <div className="space-y-2">
            {logs.map((log) => (
              <RowEditor
                key={log.id}
                summary={
                  <>
                    <AlertTriangle
                      className={`size-3.5 shrink-0 ${log.count > 5 ? "text-down" : "text-warn"}`}
                    />
                    <Badge variant={log.count > 5 ? "down" : "warn"}>
                      {SOURCE_LABELS[log.source] ?? log.source}
                    </Badge>
                    <span className="truncate text-[13px] text-fg">{log.message}</span>
                    <span className="tnum ml-auto shrink-0 text-[11px] text-fg-dim">
                      {formatNumber(log.count)}회 · {formatDateTime(log.occurred_at)}
                    </span>
                  </>
                }
              >
                <dl className="space-y-2 text-xs">
                  <Row label="메시지" value={log.message} />
                  {log.path ? <Row label="위치" value={log.path} /> : null}
                  <Row label="처음 발생" value={formatDateTime(log.first_seen)} />
                  <Row label="마지막 발생" value={formatDateTime(log.occurred_at)} />
                  {log.detail ? (
                    <div>
                      <dt className="text-[11px] tracking-wide text-fg-dim uppercase">상세</dt>
                      <dd className="mt-1 overflow-x-auto rounded-md border border-border bg-surface-2 p-2.5">
                        <pre className="text-[11px] leading-relaxed whitespace-pre text-fg-muted">
                          {log.detail}
                        </pre>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </RowEditor>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-20 shrink-0 text-[11px] tracking-wide text-fg-dim uppercase">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-fg-muted">{value}</dd>
    </div>
  );
}
