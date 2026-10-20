"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { isNavActive, type NavGroup } from "@/lib/navigation";
import { MENU_COOKIE } from "@/lib/theme";
import { Brand } from "../brand";
import { type AccountSummary, AccountMenu } from "./account";
import { NAV_ICONS } from "./nav-icons";

export function NavList({
  groups,
  collapsed,
  onNavigate,
  pathnameOverride,
}: {
  groups: NavGroup[];
  collapsed: boolean;
  onNavigate?: () => void;
  pathnameOverride?: string;
}) {
  const current = usePathname();
  const pathname = pathnameOverride ?? current;
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className="flex flex-col gap-1">
          {g.label ? (
            collapsed ? (
              <hr className="mx-2 mb-1 border-white/10" />
            ) : (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-on-sidebar-muted">{g.label}</p>
            )
          ) : null}
          <ul className="flex flex-col gap-1">
            {g.items.map((item) => {
              const Icon = NAV_ICONS[item.icon];
              const active = isNavActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm no-underline transition-colors ${
                      active
                        ? "bg-sidebar-active font-medium text-on-sidebar shadow-[inset_3px_0_0_var(--brand)]"
                        : "text-on-sidebar-muted hover:bg-sidebar-active hover:text-on-sidebar"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon aria-hidden className={`size-5 shrink-0 ${active ? "text-brand" : ""}`} />
                    {collapsed ? null : <span className="truncate">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Menu lateral (≥768 px). Recolhe para 64 px; na aplicação aberta começa recolhido para priorizar o iframe. */
export function Sidebar({
  groups,
  account,
  initialCollapsed,
  pathnameOverride,
}: {
  groups: NavGroup[];
  account: AccountSummary;
  initialCollapsed: boolean;
  pathnameOverride?: string;
}) {
  const current = usePathname();
  const pathname = pathnameOverride ?? current;
  const [preference, setPreference] = useState<boolean | null>(null);
  const collapsed = preference ?? (initialCollapsed || pathname.startsWith("/aplicacoes/"));

  function toggle() {
    const next = !collapsed;
    setPreference(next);
    document.cookie = `${MENU_COOKIE}=${next ? "recolhido" : "expandido"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col bg-sidebar text-on-sidebar transition-[width] duration-200 md:flex ${collapsed ? "w-16" : "w-56"}`}
      aria-label="Menu principal"
    >
      <div className={`flex h-16 items-center ${collapsed ? "justify-center" : "px-5"}`}>
        <Link href="/" className="text-on-sidebar no-underline" aria-label="Luz.IA — catálogo de aplicações">
          <Brand collapsed={collapsed} />
        </Link>
      </div>
      <nav aria-label="Principal" className={`flex-1 overflow-y-auto py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <NavList groups={groups} collapsed={collapsed} pathnameOverride={pathnameOverride} />
      </nav>
      <div className={`border-t border-white/10 py-2 ${collapsed ? "px-2" : "px-3"}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-on-sidebar-muted hover:bg-sidebar-active hover:text-on-sidebar ${collapsed ? "justify-center px-0" : ""}`}
        >
          {collapsed ? <PanelLeftOpen aria-hidden className="size-5" /> : <PanelLeftClose aria-hidden className="size-5" />}
          {collapsed ? null : <span>Recolher menu</span>}
        </button>
        <AccountMenu account={account} collapsed={collapsed} />
      </div>
    </aside>
  );
}
