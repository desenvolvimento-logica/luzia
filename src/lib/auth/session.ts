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
}

export type HubSession =
  | { state: "anonimo" }
  | { state: "sem_cadastro"; email: string | null }
  | { state: "desativado"; name: string }
  | { state: "ativo"; user: CurrentUser };

/** Lê identidade (validada no Auth via getUser) e o cadastro do hub, uma vez por requisição. */
export const getHubSession = cache(async (): Promise<HubSession> => {
  const supabase = await serverSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { state: "anonimo" };

  const { data: row } = await supabase
    .from("users")
    .select("user_id, user_name, user_email, user_role, is_admin, access_status, user_dpto")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!row) return { state: "sem_cadastro", email: auth.user.email ?? null };
  if (row.access_status !== "ativo") return { state: "desativado", name: row.user_name };

  let dptoName: string | null = null;
  let dptoKind: DptoKind | null = null;
  if (row.user_dpto !== null) {
    const { data: d } = await supabase.from("dpto").select("dpto_name, dpto_kind").eq("dpto_id", row.user_dpto).maybeSingle();
    dptoName = d?.dpto_name ?? null;
    dptoKind = d?.dpto_kind ?? null;
  }
  const collaborator: Collaborator = {
    userId: row.user_id,
    dptoId: row.user_dpto,
    role: row.user_role,
    isAdmin: row.is_admin,
    status: "ativo",
  };
  return {
    state: "ativo",
    user: {
      userId: row.user_id,
      name: row.user_name,
      email: row.user_email,
      dptoName,
      dptoKind,
      collaborator,
      canSeeReports: canSeeReports(collaborator),
      isAdmin: isAdmin(collaborator),
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
