import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { BroadcastCalendar } from "@/components/members/broadcast-calendar";
import { SetupNotice } from "@/components/ui/setup-notice";
import { ErrorState } from "@/components/ui/states";

import { getBroadcastDaySummaries } from "@/lib/queries/broadcasts";
import { todayKey } from "@/lib/utils/dates";

export const metadata = { title: "캘린더" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const { y, m } = await searchParams;
  const today = todayKey();
  const year = Number(y) || Number(today.slice(0, 4));
  const month = Number(m) || Number(today.slice(5, 7));

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = `${year}-${String(month).padStart(2, "0")}-31`;

  const result = await getBroadcastDaySummaries(from, to);

  if (result.notConfigured) {
    return (
      <>
        <PageHeader title="캘린더" />
        <SetupNotice />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="방송 캘린더"
        description="전체 멤버 기준 · 날짜를 누르면 그날의 아카이브로 이동합니다"
        actions={
          <Link
            href={`/calendar/${year}/${String(month).padStart(2, "0")}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            <BarChart3 className="size-3.5" />
            {year}년 {month}월 종합
          </Link>
        }
      />

      {result.error ? <ErrorState description={result.error} /> : null}

      <div className="max-w-xl">
        <BroadcastCalendar
          year={year}
          month={month}
          days={result.data}
          hrefForDate={(key) => {
            const [yy, mm, dd] = key.split("-");
            return `/calendar/${yy}/${mm}/${dd}`;
          }}
          hrefForMonth={(yy, mm) => `/calendar?y=${yy}&m=${mm}`}
        />
      </div>
    </>
  );
}
