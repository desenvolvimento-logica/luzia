import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppShell, type ShellUser } from "@/components/app-shell";
import { CatalogView } from "@/features/catalog/catalog-view";
import { PREVIEW_ADMIN, PREVIEW_APPS, PREVIEW_COLLABORATOR, PREVIEW_NEWS } from "@/features/preview/fixtures";
import { previewEnabled } from "@/features/preview/gate";
import { MENU_COOKIE, parseTheme, THEME_COOKIE } from "@/lib/theme";

export const metadata = { title: "Pré-visualização", robots: { index: false } };

// Pré-visualização de interface com dados sintéticos para comparar com mockups/. Sem sessão e sem banco.
const SCREENS: Record<string, { user: ShellUser; path: string; render: () => React.ReactNode }> = {
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
