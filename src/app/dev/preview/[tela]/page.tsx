import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell, type ShellUser } from "@/components/app-shell";
import { LoginView } from "@/app/login/login-view";
import { OpenAppView } from "@/features/apps/open-app-view";
import { CatalogView } from "@/features/catalog/catalog-view";
import { PREVIEW_ADMIN, PREVIEW_APPS, PREVIEW_COLLABORATOR, PREVIEW_NEWS } from "@/features/preview/fixtures";
import { previewEnabled } from "@/features/preview/gate";
import { MENU_COOKIE, parseTheme, THEME_COOKIE } from "@/lib/theme";

export const metadata = { title: "Pré-visualização", robots: { index: false } };

// Pré-visualização de interface com dados sintéticos para comparar com mockups/. Sem sessão e sem banco.
const SCREENS: Record<string, { user: ShellUser; path: string; bare?: boolean; render: () => React.ReactNode }> = {
  login: { user: PREVIEW_COLLABORATOR, path: "/login", bare: true, render: () => <LoginView errorMessage={null} next="/" year={2026} /> },
  "login-erro": {
    user: PREVIEW_COLLABORATOR,
    path: "/login",
    bare: true,
    render: () => <LoginView errorMessage="O login foi cancelado. Você pode tentar novamente quando quiser." next="/" year={2026} />,
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
    render: () => <CatalogView departmentName="Tributário" pendingDepartment={false} isAdmin={false} apps={PREVIEW_APPS} news={PREVIEW_NEWS} />,
  },
  "catalogo-vazio": {
    user: { ...PREVIEW_COLLABORATOR, dptoName: "Não atribuído" },
    path: "/",
    render: () => <CatalogView departmentName="Não atribuído" pendingDepartment isAdmin={false} apps={[]} news={[]} />,
  },
  "catalogo-admin": {
    user: PREVIEW_ADMIN,
    path: "/",
    render: () => <CatalogView departmentName="Administração" pendingDepartment={false} isAdmin apps={PREVIEW_APPS} news={PREVIEW_NEWS} />,
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
      hasRecentNews
      pathnameOverride={screen.path}
    >
      {screen.render()}
    </AppShell>
  );
}
