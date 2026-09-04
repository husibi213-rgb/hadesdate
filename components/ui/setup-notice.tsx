import { Database } from "lucide-react";

/** Supabase 미연결 상태 안내 (빈 화면 대신) */
export function SetupNotice() {
  return (
    <div className="rounded-xl border border-warn/30 bg-warn/5 px-5 py-6">
      <div className="flex items-center gap-2 text-warn">
        <Database className="size-4" />
        <p className="text-sm font-semibold">Supabase 가 아직 연결되지 않았습니다</p>
      </div>
      <ol className="mt-3 space-y-1.5 text-xs leading-relaxed text-fg-muted">
        <li>
          1. <code className="text-fg">.env.local</code> 에{" "}
          <code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
          <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> 를 입력합니다.
        </li>
        <li>
          2. Supabase SQL Editor 에서{" "}
          <code className="text-fg">supabase/all_migrations.sql</code> 을 실행합니다.
        </li>
        <li>
          3. (선택) <code className="text-fg">supabase/seed.dev.sql</code> 로 더미 데이터를 넣습니다.
        </li>
        <li>4. 개발 서버를 재시작합니다.</li>
      </ol>
    </div>
  );
}
