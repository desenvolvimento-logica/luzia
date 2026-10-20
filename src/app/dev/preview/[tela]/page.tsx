import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell, type ShellUser } from "@/components/app-shell";
import { LoginView } from "@/app/login/login-view";
import { OpenAppView } from "@/features/apps/open-app-view";
import { CatalogView } from "@/features/catalog/catalog-view";
import {
  PREVIEW_ADMIN, PREVIEW_APPS, PREVIEW_COLLABORATOR, PREVIEW_FILTER_OPTIONS, PREVIEW_METRICS, PREVIEW_NEWS, PREVIEW_REPORT_ROWS,
} from "@/features/preview/fixtures";
import { ReportsView } from "@/features/reports/reports-view";
import { AppsAdminView } from "@/features/admin/apps/apps-admin-view";
import { previewEnabled } from "@/features/preview/gate";
import { MENU_COOKIE, parseTheme, THEME_COOKIE } from "@/lib/theme";

export const metadata = { title: "Pré-visualização", robots: { index: false } };

const PREVIEW_ADMIN_APPS = [
  ["Fisco Check", "🧾", true, "Fiscal", [2]],
  ["Mensagens (e-CAC)", "✉️", true, "Tributário", [4]],
  ["Boas-vindas", "🤝", true, "Tributário", [4]],
  ["PERDCOMP", "📄", true, "Tributário", [4]],
  ["contcheck", "📊", true, "Contábil", [3]],
  ["CPA Tax Planner", "🧮", false, "Tributário", [4]],
].map(([name, icon, active, label, ids], i) => {
  const id = `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
  return {
    id,
    name: name as string,
    icon: icon as string,
    active: active as boolean,
    audienceLabel: label as string,
    drawer: {
      id,
      name: name as string,
      description: name === "PERDCOMP" ? "Sistema para apuração e gerenciamento de créditos de PIS e COFINS (PER/DCOMP)." : null,
      url: "https://perdcomp-pilot.lovable.app/",
      icon: icon as string,
      active: active as boolean,
      audience: "selected_departments" as const,
      departmentIds: ids as number[],
    },
  };
});

// Pré-visualização de interface com dados sintéticos para comparar com mockups/. Sem sessão e sem banco.
const SCREENS: Record<string, { user: ShellUser; path: string; bare?: boolean; render: () => React.ReactNode }> = {
  login: { user: PREVIEW_COLLABORATOR, path: "/login", bare: true, render: () => <LoginView errorMessage={null} next="/" year={2026} /> },
  "login-erro": {
    user: PREVIEW_COLLABORATOR,
    path: "/login",
    bare: true,
    render: () => <LoginView errorMessage="O login foi cancelado. Você pode tentar novamente quando quiser." next="/" year={2026} />,
  },
  relatorios: {
    user: PREVIEW_ADMIN,
    path: "/relatorios",
    render: () => (
      <ReportsView
        period={{ from: "2026-10-01", to: "2026-10-20", adjusted: false }}
        filters={{ from: "2026-10-01", to: "2026-10-20", appId: null, userId: null, dptoId: null }}
        options={PREVIEW_FILTER_OPTIONS}
        metrics={PREVIEW_METRICS}
        rows={PREVIEW_REPORT_ROWS}
        total={1284}
        page={1}
        pageSize={25}
        sort="opened_at"
        dir="desc"
      />
    ),
  },
  "admin-aplicacoes": {
    user: PREVIEW_ADMIN,
    path: "/admin/aplicacoes",
    render: () => (
      <AppsAdminView apps={PREVIEW_ADMIN_APPS} departments={PREVIEW_FILTER_OPTIONS.dptos} allowedOrigins={["https://perdcomp-pilot.lovable.app"]} readOnly={false} editingId={null} creating={false} savedName={null} />
    ),
  },
  "admin-aplicacao-editar": {
    user: PREVIEW_ADMIN,
    path: "/admin/aplicacoes",
    render: () => (
      <AppsAdminView
        apps={PREVIEW_ADMIN_APPS}
        departments={PREVIEW_FILTER_OPTIONS.dptos}
        allowedOrigins={["https://perdcomp-pilot.lovable.app"]}
        readOnly={false}
        editingId={PREVIEW_ADMIN_APPS[3]!.id}
        creating={false}
        savedName={null}
      />
    ),
  },
  aplicacao: {
    user: PREVIEW_ADMIN,
    path: "/aplicacoes/00000000-0000-4000-8000-000000000003",
    render: () => (
      <OpenAppView
        app={{ id: PREVIEW_APPS[2]!.id, name: "PERDCOMP", icon: PREVIEW_APPS[2]!.icon }}
        departmentName="Tributário"
        src="about:blank"
        origin="https://perdcomp.exemplo.test"
        openId="00000000-0000-4000-8000-0000000000ff"
        simulate
      />
    ),
  },
  catalogo: {
    user: PREVIEW_COLLABORATOR,
    path: "/",
    render: () => <CatalogView departmentName="Tributário" pendingDepartment={false} isAdmin={false} apps={PREVIEW_APPS} />,
  },
  "catalogo-vazio": {
    user: { ...PREVIEW_COLLABORATOR, dptoName: "Não atribuído" },
    path: "/",
    render: () => <CatalogView departmentName="Não atribuído" pendingDepartment isAdmin={false} apps={[]} />,
  },
  "catalogo-admin": {
    user: PREVIEW_ADMIN,
    path: "/",
    render: () => <CatalogView departmentName="Administração" pendingDepartment={false} isAdmin apps={PREVIEW_APPS} />,
  },
};

export default async function PreviewPage({ params }: PageProps<"/dev/preview/[tela]">) {
  if (!previewEnabled()) notFound();
  const screen = SCREENS[(await params).tela];
  if (!screen) notFound();
  const store = await cookies();
  if (screen.bare) return screen.render();
  return (
    <AppShell
      user={screen.user}
      theme={parseTheme(store.get(THEME_COOKIE)?.value)}
      menuCollapsed={store.get(MENU_COOKIE)?.value === "recolhido"}
      news={{ items: PREVIEW_NEWS, recent: true }}
      pathnameOverride={screen.path}
    >
      {screen.render()}
    </AppShell>
  );
}
