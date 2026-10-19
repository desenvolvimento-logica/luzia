// Matriz de autorização do hub. A aplicação efetiva fica no banco (private.visible_user_ids,
// private.can_open_app e políticas RLS); este módulo espelha as mesmas regras para a interface
// e para validação antecipada no servidor. tests/db/authorization.test.ts compara os dois.

export const CARGOS = ["usuario", "lider", "coordenador", "gerente", "diretor"] as const;
export type Cargo = (typeof CARGOS)[number];

export const CARGO_LABEL: Record<Cargo, string> = {
  usuario: "Usuário",
  lider: "Líder",
  coordenador: "Coordenador",
  gerente: "Gerente",
  diretor: "Diretor",
};

export type AccessStatus = "ativo" | "desativado";
export type DptoKind = "normal" | "provisionamento";
export type Audience = "todos" | "selecionados";

export interface Collaborator {
  userId: number;
  dptoId: number | null;
  role: Cargo;
  isAdmin: boolean;
  status: AccessStatus;
}

export interface AppAccessInfo {
  appId: number;
  active: boolean;
  audience: Audience;
  dptoIds: readonly number[];
}

export function isCargo(value: unknown): value is Cargo {
  return typeof value === "string" && (CARGOS as readonly string[]).includes(value);
}

export function isActive(me: Collaborator | null | undefined): me is Collaborator {
  return !!me && me.status === "ativo";
}

export function isAdmin(me: Collaborator | null | undefined): boolean {
  return isActive(me) && me.isAdmin;
}

/** Telas gerenciais (relatórios). Cargo e administração são independentes. */
export function canSeeReports(me: Collaborator | null | undefined): boolean {
  return isActive(me) && (me.isAdmin || me.role !== "usuario");
}

/** Escopo gerencial: quem `me` enxerga em relatórios. Não inclui o próprio registro para líder/coordenador. */
export function canViewInReports(me: Collaborator | null | undefined, target: Pick<Collaborator, "dptoId" | "role">): boolean {
  if (!isActive(me)) return false;
  if (me.isAdmin || me.role === "gerente" || me.role === "diretor") return true;
  const sameDpto = me.dptoId !== null && target.dptoId === me.dptoId;
  if (me.role === "coordenador") return sameDpto && (target.role === "usuario" || target.role === "lider");
  if (me.role === "lider") return sameDpto && target.role === "usuario";
  return false;
}

export function canOpenApp(
  me: Collaborator | null | undefined,
  app: AppAccessInfo,
  dptoKindOf: (dptoId: number | null) => DptoKind | null,
): boolean {
  if (!isActive(me) || !app.active) return false;
  if (me.isAdmin) return true;
  if (dptoKindOf(me.dptoId) !== "normal") return false;
  if (app.audience === "todos") return true;
  return me.dptoId !== null && app.dptoIds.includes(me.dptoId);
}
