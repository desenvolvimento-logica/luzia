import { Building2, ChartColumn, LayoutGrid, type LucideIcon, Megaphone, Newspaper, Package, ScrollText, Users } from "lucide-react";
import type { NavIcon } from "@/lib/navigation";

export const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  apps: LayoutGrid,
  reports: ChartColumn,
  news: Newspaper,
  people: Users,
  departments: Building2,
  manage: Package,
  announce: Megaphone,
  audit: ScrollText,
};
