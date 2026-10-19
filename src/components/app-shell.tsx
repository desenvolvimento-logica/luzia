import { Bell, ChartColumn, LayoutGrid, Settings } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CurrentUser } from "@/lib/auth/session";
import { CARGO_LABEL } from "@/lib/auth/matrix";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import { Brand } from "./brand";
import { NavLink } from "./nav-link";
import { ThemeToggle } from "./theme-toggle";

export async function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-chumbo text-on-chumbo">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-on-chumbo no-underline" aria-label="Luz.IA — catálogo de aplicações">
            <Brand />
          </Link>
          <nav aria-label="Principal" className="order-3 w-full sm:order-none sm:w-auto">
            <ul className="flex flex-wrap gap-1">
              <li>
                <NavLink href="/" exact icon={<LayoutGrid aria-hidden className="size-4" />}>
                  Aplicações
                </NavLink>
              </li>
              <li>
                <NavLink href="/novidades" icon={<Bell aria-hidden className="size-4" />}>
                  Novidades
                </NavLink>
              </li>
              {user.canSeeReports ? (
                <li>
                  <NavLink href="/relatorios" icon={<ChartColumn aria-hidden className="size-4" />}>
                    Relatórios
                  </NavLink>
                </li>
              ) : null}
              {user.isAdmin ? (
                <li>
                  <NavLink href="/admin" icon={<Settings aria-hidden className="size-4" />}>
                    Administração
                  </NavLink>
                </li>
              ) : null}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle initial={theme} />
            <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-2 hover:bg-white/10">
                <span
                  aria-hidden
                  className="inline-flex size-8 items-center justify-center rounded-full bg-brand font-semibold text-on-brand"
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="sr-only">Menu do usuário: </span>
                <span className="hidden max-w-40 truncate text-sm sm:inline">{user.name}</span>
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-border bg-surface p-4 text-text shadow-lg">
                <p className="font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted">{user.email}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">Departamento</dt>
                  <dd>{user.dptoName ?? "—"}</dd>
                  <dt className="text-muted">Cargo</dt>
                  <dd>{CARGO_LABEL[user.collaborator.role]}</dd>
                  {user.isAdmin ? (
                    <>
                      <dt className="text-muted">Perfil</dt>
                      <dd>Administrador</dd>
                    </>
                  ) : null}
                </dl>
                <form action="/auth/sair" method="post" className="mt-4">
                  <button type="submit" className="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-surface-2">
                    Sair
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
