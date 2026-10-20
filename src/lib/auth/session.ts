import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { serverSupabase, type HubSupabase } from "../supabase/server";
import { canSeeReports, type Collaborator, type DptoKind, isAdmin } from "./matrix";

export interface CurrentUser {
  userId: number;
  name: string;
  email: string;
  dptoName: string | null;
  dptoKind: DptoKind | null;
  collaborator: Collaborator;
  canSeeReports: boolean;
  isAdmin: boolean;
  /** Na coexistência a administração no hub novo é somente leitura (fonte: hub antigo). */
  adminReadOnly: boolean;
}

export type HubSession =
  | { state: "anonimo" }
  | { state: "sem_cadastro"; email: string | null }
  | { state: "desativado"; name: string }
  | { state: "ativo"; user: CurrentUser };

/** Lê identidade (validada no Auth via getUser) e o perfil luzia_, uma vez por requisição. */
export const getHubSession = cache(async (): Promise<HubSession> => {
  const supabase = await serverSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { state: "anonimo" };

  const { data } = await supabase.rpc("luzia_my_profile");
  const p = data?.[0];
  if (!p) return { state: "sem_cadastro", email: auth.user.email ?? null };
  if (p.access_status !== "active") return { state: "desativado", name: p.name };

  const collaborator: Collaborator = {
    userId: p.collaborator_id,
    dptoId: p.department_id,
    role: p.role,
    isAdmin: p.is_admin,
    status: "ativo",
  };
  return {
    state: "ativo",
    user: {
      userId: p.collaborator_id,
      name: p.name,
      email: p.email,
      dptoName: p.department_name,
      dptoKind: p.department_kind === "provisioning" ? "provisionamento" : p.department_kind === "regular" ? "normal" : null,
      collaborator,
      canSeeReports: canSeeReports(collaborator),
      isAdmin: isAdmin(collaborator),
      adminReadOnly: p.phase !== "primary",
    },
  };
});

export type Requirement = "ativo" | "relatorios" | "admin";

function satisfies(user: CurrentUser, req: Requirement): boolean {
  if (req === "admin") return user.isAdmin;
  if (req === "relatorios") return user.canSeeReports;
  return true;
}

/** Para páginas: redireciona para login ou mostra a página de acesso negado. */
export async function requirePage(req: Requirement = "ativo"): Promise<{ user: CurrentUser; supabase: HubSupabase }> {
  const session = await getHubSession();
  if (session.state === "anonimo") redirect("/login");
  if (session.state !== "ativo") redirect("/");
  if (!satisfies(session.user, req)) redirect("/acesso-negado");
  return { user: session.user, supabase: await serverSupabase() };
}

export class AuthorizationError extends Error {
  constructor(message = "Operação não autorizada.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Para Server Actions e rotas: revalida no servidor a cada chamada. O banco revalida de novo (RLS). */
export async function requireAction(req: Requirement = "ativo"): Promise<{ user: CurrentUser; supabase: HubSupabase }> {
  const session = await getHubSession();
  if (session.state !== "ativo" || !satisfies(session.user, req)) throw new AuthorizationError();
  return { user: session.user, supabase: await serverSupabase() };
}
