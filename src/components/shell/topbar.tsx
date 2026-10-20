"use client";

import { Bell, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { defaultCrumbs, type NavGroup } from "@/lib/navigation";
import type { ThemePreference } from "@/lib/theme";
import { Brand } from "../brand";
import { ThemeToggle } from "../theme-toggle";
import { AccountDetails, type AccountSummary, Avatar } from "./account";
import { Breadcrumbs } from "./breadcrumbs";
import { NavList } from "./sidebar";

const iconButton = "inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] text-text hover:bg-surface-2";

/** Atalho para Novidades. O ponto indica publicação nos últimos 7 dias — não há controle de leitura por pessoa. */
function NewsBell({ hasRecentNews }: { hasRecentNews: boolean }) {
  return (
    <Link
      href="/novidades"
      className={`${iconButton} relative no-underline`}
      aria-label={hasRecentNews ? "Novidades — há publicação nos últimos 7 dias" : "Novidades"}
      title="Novidades"
    >
      <Bell aria-hidden className="size-5" />
      {hasRecentNews ? <span aria-hidden className="absolute right-2.5 top-2.5 size-2 rounded-full bg-brand ring-2 ring-surface" /> : null}
    </Link>
  );
}

function MobileNav({ groups, account, pathnameOverride }: { groups: NavGroup[]; account: AccountSummary; pathnameOverride?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  return (
    <>
      <button type="button" className={`${iconButton} md:hidden`} aria-label="Abrir menu" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        <Menu aria-hidden className="size-6" />
      </button>
      <dialog
        ref={ref}
        aria-label="Menu"
        className="m-0 h-dvh max-h-dvh w-[min(20rem,88vw)] max-w-none bg-sidebar p-0 text-on-sidebar"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-4">
            <Brand />
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-[var(--radius-control)] hover:bg-sidebar-active"
              aria-label="Fechar menu"
              onClick={() => ref.current?.close()}
            >
              <X aria-hidden className="size-6" />
            </button>
          </div>
          <nav aria-label="Principal" className="flex-1 overflow-y-auto px-3 py-2">
            <NavList groups={groups} collapsed={false} onNavigate={() => ref.current?.close()} pathnameOverride={pathnameOverride} />
          </nav>
          <div className="m-3 rounded-[var(--radius-card)] bg-surface p-4 text-text">
            <AccountDetails account={account} />
          </div>
        </div>
      </dialog>
    </>
  );
}

export function Topbar({
  groups,
  account,
  theme,
  hasRecentNews,
  pathnameOverride,
}: {
  groups: NavGroup[];
  account: AccountSummary;
  theme: ThemePreference;
  hasRecentNews: boolean;
  pathnameOverride?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur md:px-8">
      <MobileNav groups={groups} account={account} pathnameOverride={pathnameOverride} />
      <Link href="/" className="text-text no-underline md:hidden" aria-label="Luz.IA — catálogo de aplicações">
        <Brand />
      </Link>
      <div className="hidden min-w-0 flex-1 md:block">
        <Breadcrumbs fallback={pathnameOverride ? defaultCrumbs(pathnameOverride) : undefined} />
      </div>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle initial={theme} />
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-border md:block" />
        <NewsBell hasRecentNews={hasRecentNews} />
        <span className="md:hidden">
          <Avatar name={account.name} className="ml-1 size-9 text-sm" />
        </span>
      </div>
    </header>
  );
}
