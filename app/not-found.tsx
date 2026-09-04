import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <p className="text-xs tracking-[0.3em] text-fg-dim">404</p>
      <h1 className="text-lg font-semibold text-fg">페이지를 찾을 수 없습니다</h1>
      <Link
        href="/"
        className="mt-2 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
      >
        대시보드로 이동
      </Link>
    </div>
  );
}
