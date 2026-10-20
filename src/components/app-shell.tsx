import type { ReactNode } from "react";
import { CARGO_LABEL, type Cargo } from "@/lib/auth/matrix";
import { navGroups } from "@/lib/navigation";
import type { ThemePreference } from "@/lib/theme";
import type { AccountSummary } from "./shell/account";
import { BreadcrumbProvider } from "./shell/breadcrumbs";
import { MainArea } from "./shell/main-area";
import { Sidebar } from "./shell/sidebar";
import { Topbar } from "./shell/topbar";

export interface ShellUser {
  name: string;
  email: string;
  dptoName: string | null;
  role: Cargo;
  isAdmin: boolean;
  canSeeReports: boolean;
}

export function AppShell({
  user,
  theme,
  menuCollapsed,
  hasRecentNews,
  pathnameOverride,
  children,
}: {
  user: ShellUser;
  theme: ThemePreference;
  menuCollapsed: boolean;
  hasRecentNews: boolean;
  /** Só para a pré-visualização: caminho simulado para menu ativo e trilha. */
  pathnameOverride?: string;
  children: ReactNode;
}) {
  const groups = navGroups({ canSeeReports: user.canSeeReports, isAdmin: user.isAdmin });
  const account: AccountSummary = {
    name: user.name,
    email: user.email,
    departmentName: user.dptoName,
    roleLabel: CARGO_LABEL[user.role],
    isAdmin: user.isAdmin,
  };
  return (
    <BreadcrumbProvider>
      <div className="flex min-h-dvh">
        <Sidebar groups={groups} account={account} initialCollapsed={menuCollapsed} pathnameOverride={pathnameOverride} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar groups={groups} account={account} theme={theme} hasRecentNews={hasRecentNews} pathnameOverride={pathnameOverride} />
          <MainArea pathnameOverride={pathnameOverride}>{children}</MainArea>
        </div>
      </div>
    </BreadcrumbProvider>
  );
}
