import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  MousePointerClick,
  Radio,
  Scissors,
  Search,
  Users,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 하단 모바일 내비게이션에 노출할지 */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, mobile: true },
  { href: "/members", label: "멤버", icon: Users, mobile: true },
  { href: "/broadcasts", label: "방송", icon: Radio, mobile: true },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/analytics", label: "통계", icon: BarChart3, mobile: true },
  { href: "/catches", label: "캐치", icon: Scissors, mobile: true },
  { href: "/clicks", label: "클릭", icon: MousePointerClick },
  { href: "/notices", label: "공지", icon: Megaphone },
  { href: "/search", label: "검색", icon: Search },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
