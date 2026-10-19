import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AccountState } from "@/components/account-state";
import { AppShell } from "@/components/app-shell";
import { getHubSession } from "@/lib/auth/session";

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
  return <AppShell user={session.user}>{children}</AppShell>;
}
