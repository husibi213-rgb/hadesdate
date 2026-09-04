import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { LiveRefresher } from "@/components/layout/live-refresher";
import { getLiveBroadcasts } from "@/lib/queries/broadcasts";
import { isSupabaseConfigured } from "@/lib/env";

// 방송 데이터는 항상 최신이어야 하므로 정적 프리렌더를 하지 않는다.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const live = await getLiveBroadcasts();

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar />
      <div className="lg:pl-56">
        <Topbar liveCount={live.data.length} />
        <main className="mx-auto w-full max-w-[1400px] space-y-8 px-4 pt-5 pb-24 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>
      <MobileNav />
      <LiveRefresher enabled={isSupabaseConfigured} />
    </div>
  );
}
