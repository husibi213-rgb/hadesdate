import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";

import { isAdminSession } from "@/lib/admin/session";
import { signOut } from "@/lib/admin/actions";
import { Button } from "@/components/admin/form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { default: "관리자", template: "%s · 관리자 · HADES DATA" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "개요" },
  { href: "/admin/members", label: "멤버" },
  { href: "/admin/broadcasts", label: "방송" },
  { href: "/admin/catches", label: "캐치" },
  { href: "/admin/notices", label: "공지" },
  { href: "/admin/errors", label: "오류" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdminSession();

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border bg-surface/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="text-sm font-bold tracking-[0.18em]">HADES</span>
            <span className="text-[11px] tracking-[0.25em] text-fg-dim">ADMIN</span>
          </Link>

          {authed ? (
            <nav className="flex flex-wrap items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs text-fg-muted transition-colors hover:text-fg"
            >
              <ArrowLeft className="size-3.5" />
              사이트로
            </Link>
            {authed ? (
              <form action={signOut}>
                <Button variant="ghost" type="submit" className="inline-flex items-center gap-1">
                  <LogOut className="size-3.5" />
                  로그아웃
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 lg:px-6">
        {children}
      </main>
    </div>
  );
}
