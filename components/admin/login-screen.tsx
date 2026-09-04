import { KeyRound, ShieldAlert } from "lucide-react";

import { signIn } from "@/lib/admin/actions";
import { Button, Field, Input } from "@/components/admin/form";
import { SetupNotice } from "@/components/ui/setup-notice";
import type { AdminGateReason } from "@/lib/admin/session";

export function LoginScreen({
  reason,
  error,
}: {
  reason: AdminGateReason;
  error?: string;
}) {
  if (reason === "supabase-missing") {
    return (
      <div className="mx-auto max-w-lg space-y-3">
        <SetupNotice />
        <p className="text-[11px] leading-relaxed text-fg-dim">
          관리자 페이지는 쓰기 작업을 하므로{" "}
          <code className="text-fg-muted">SUPABASE_SERVICE_ROLE_KEY</code> 도 함께 필요합니다.
        </p>
      </div>
    );
  }

  if (reason === "not-configured") {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-warn/30 bg-warn/5 px-5 py-6">
        <div className="flex items-center gap-2 text-warn">
          <ShieldAlert className="size-4" />
          <p className="text-sm font-semibold">관리자 비밀번호가 설정되지 않았습니다</p>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">
          <code className="text-fg">.env.local</code> 에{" "}
          <code className="text-fg">ADMIN_PASSWORD</code> 를 넣고 서버를 다시 시작하세요.
          설정되지 않은 동안 관리자 페이지는 잠겨 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-xl border border-border bg-surface/70 px-5 py-6">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-fg-muted" />
          <h1 className="text-sm font-semibold">관리자 로그인</h1>
        </div>

        <form action={signIn} className="mt-4 space-y-3">
          <Field label="비밀번호">
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </Field>
          {error ? (
            <p className="rounded-md border border-down/40 bg-down/5 px-2.5 py-2 text-xs text-down">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full">
            로그인
          </Button>
        </form>
      </div>

      <p className="mt-3 text-center text-[11px] text-fg-dim">
        세션은 12시간 후 만료됩니다.
      </p>
    </div>
  );
}
