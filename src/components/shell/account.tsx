"use client";

import { ChevronUp, LogOut } from "lucide-react";
import { initials } from "@/lib/navigation";

export interface AccountSummary {
  name: string;
  email: string;
  departmentName: string | null;
  roleLabel: string;
  isAdmin: boolean;
}

export function Avatar({ name, className = "size-9 text-sm" }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-on-brand ${className}`}>
      {initials(name)}
    </span>
  );
}

export function AccountDetails({ account }: { account: AccountSummary }) {
  return (
    <>
      <p className="font-medium">{account.name}</p>
      <p className="truncate text-xs text-muted">{account.email}</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted">Departamento</dt>
        <dd>{account.departmentName ?? "—"}</dd>
        <dt className="text-muted">Cargo</dt>
        <dd>{account.roleLabel}</dd>
        {account.isAdmin ? (
          <>
            <dt className="text-muted">Perfil</dt>
            <dd>Administrador</dd>
          </>
        ) : null}
      </dl>
      <form action="/auth/sair" method="post" className="mt-4">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] border border-control px-3 text-sm hover:bg-surface-2"
        >
          <LogOut aria-hidden className="size-4" />
          Sair
        </button>
      </form>
    </>
  );
}

/** Conta no rodapé do menu lateral; abre para cima. */
export function AccountMenu({ account, collapsed }: { account: AccountSummary; collapsed: boolean }) {
  return (
    <details className="group relative">
      <summary
        className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 hover:bg-sidebar-active [&::-webkit-details-marker]:hidden"
        aria-label={`Conta de ${account.name}`}
      >
        <Avatar name={account.name} />
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-on-sidebar">{account.name}</span>
              <span className="block truncate text-xs text-on-sidebar-muted">{account.departmentName ?? "Sem departamento"}</span>
            </span>
            <ChevronUp aria-hidden className="size-4 text-on-sidebar-muted transition-transform group-open:rotate-180" />
          </>
        )}
      </summary>
      <div className="absolute bottom-full left-0 z-30 mb-2 w-72 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-text shadow-lg">
        <AccountDetails account={account} />
      </div>
    </details>
  );
}
