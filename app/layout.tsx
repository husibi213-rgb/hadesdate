import type { Metadata, Viewport } from "next";
import "./globals.css";

import { siteUrl } from "@/lib/site";

const description = "SOOP 하데스 멤버 방송 데이터 아카이브 — 날짜별 / 멤버별 / 방송별 기록";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "HADES DATA",
    template: "%s · HADES DATA",
  },
  description,
  openGraph: {
    type: "website",
    siteName: "HADES DATA",
    title: "HADES DATA",
    description,
    locale: "ko_KR",
  },
  twitter: { card: "summary", title: "HADES DATA", description },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
