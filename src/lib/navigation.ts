// Navegação do hub. Mostrar/esconder itens é conveniência de interface; a autorização efetiva fica nas
// páginas (requirePage), nas ações (requireAction) e no banco.

export type NavIcon = "apps" | "reports" | "news" | "people" | "departments" | "manage" | "announce" | "audit";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Prefixos adicionais que também marcam o item como ativo. */
  alsoActive?: string[];
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export interface Crumb {
  label: string;
  href?: string;
}

export function navGroups(p: { canSeeReports: boolean; isAdmin: boolean }): NavGroup[] {
  const main: NavItem[] = [{ href: "/", label: "Aplicações", icon: "apps", alsoActive: ["/aplicacoes/"] }];
  if (p.canSeeReports) main.push({ href: "/relatorios", label: "Relatórios", icon: "reports" });
  const groups: NavGroup[] = [{ items: main }];
  if (p.isAdmin) {
    groups.push({
      label: "Administração",
      items: [
        { href: "/admin/colaboradores", label: "Colaboradores", icon: "people" },
        { href: "/admin/departamentos", label: "Departamentos", icon: "departments" },
        { href: "/admin/aplicacoes", label: "Gerenciar aplicações", icon: "manage" },
        { href: "/admin/novidades", label: "Publicar novidades", icon: "announce" },
        { href: "/admin/auditoria", label: "Auditoria", icon: "audit" },
      ],
    });
  }
  return groups;
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/" || (item.alsoActive ?? []).some((p) => pathname.startsWith(p));
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const ADMIN_LABELS: Record<string, string> = {
  colaboradores: "Colaboradores",
  departamentos: "Departamentos",
  aplicacoes: "Gerenciar aplicações",
  novidades: "Publicar novidades",
  auditoria: "Auditoria",
};

/** Trilha padrão por rota; páginas com nome dinâmico (ex.: aplicação aberta) refinam via SetBreadcrumb. */
export function defaultCrumbs(pathname: string): Crumb[] {
  if (pathname === "/") return [{ label: "Seu espaço de trabalho" }];
  if (pathname.startsWith("/aplicacoes/")) return [{ label: "Aplicações", href: "/" }, { label: "Aplicação" }];
  if (pathname === "/novidades") return [{ label: "Início", href: "/" }, { label: "Novidades" }];
  if (pathname === "/relatorios") return [{ label: "Início", href: "/" }, { label: "Relatórios", href: "/relatorios" }, { label: "Relatórios de acesso" }];
  if (pathname.startsWith("/relatorios/atividades")) {
    return [{ label: "Início", href: "/" }, { label: "Relatórios", href: "/relatorios" }, { label: "Atividades" }];
  }
  if (pathname.startsWith("/admin/")) {
    const [, , section, detail] = pathname.split("/");
    const label = ADMIN_LABELS[section ?? ""] ?? "Administração";
    const crumbs: Crumb[] = [{ label: "Administração" }, { label, href: detail ? `/admin/${section}` : undefined }];
    if (detail) crumbs.push({ label: detail === "nova" ? "Nova" : "Detalhe" });
    return crumbs;
  }
  if (pathname === "/acesso-negado") return [{ label: "Acesso negado" }];
  return [{ label: "Luz.IA" }];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
