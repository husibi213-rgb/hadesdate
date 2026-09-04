import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Film,
  LayoutDashboard,
  Megaphone,
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
  { href: "/catches", label: "캐치", icon: Scissors, mobile: true },
  { href: "/clips", label: "유저클립", icon: Film, mobile: true },
  { href: "/notices", label: "공지", icon: Megaphone },
  { href: "/search", label: "검색", icon: Search },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
