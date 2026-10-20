import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountState } from "@/components/account-state";
import { AppShell } from "@/components/app-shell";
import { bellNews } from "@/features/news/queries";
import { getHubSession } from "@/lib/auth/session";
import { serverSupabase } from "@/lib/supabase/server";
import { MENU_COOKIE, parseTheme, THEME_COOKIE } from "@/lib/theme";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const session = await getHubSession();
  if (session.state === "anonimo") redirect("/login");
  if (session.state === "sem_cadastro") {
    return (
      <AccountState title="Acesso ainda não liberado">
        Sua conta {session.email ? <strong>{session.email}</strong> : null} entrou, mas não há cadastro ativo no hub. Procure a
        administração do Luz.IA.
      </AccountState>
    );
  }
  if (session.state === "desativado") {
    return (
      <AccountState title="Acesso desativado">
        O acesso de {session.name} ao hub está desativado. Se isso não era esperado, procure a administração do Luz.IA.
      </AccountState>
    );
  }

  const store = await cookies();
  const news = await bellNews(await serverSupabase());
  const u = session.user;

  return (
    <AppShell
      user={{ name: u.name, email: u.email, dptoName: u.dptoName, role: u.collaborator.role, isAdmin: u.isAdmin, canSeeReports: u.canSeeReports }}
      theme={parseTheme(store.get(THEME_COOKIE)?.value)}
      menuCollapsed={store.get(MENU_COOKIE)?.value === "recolhido"}
      news={news}
    >
      {children}
    </AppShell>
  );
}
