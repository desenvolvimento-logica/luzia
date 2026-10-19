// Formato normalizado de atividades das aplicações integradas (spec 6).

export type ActivitySourceId = "fiscocheck" | "tributario";

export interface NormalizedActivity {
  source: ActivitySourceId;
  id: string;
  userId: number;
  userName: string;
  dptoId: number | null;
  type: string;
  summary: string;
  occurredAt: string;
}

export type ActivityResult =
  | { status: "ok"; items: NormalizedActivity[]; total: number }
  | { status: "vazio" }
  | { status: "indisponivel"; message: string }
  | { status: "nao_suportado"; message: string };

/** Colaborador dentro do escopo gerencial do solicitante (resolvido no banco, com o RLS dele). */
export interface ScopeUser {
  userId: number;
  name: string;
  email: string;
  dptoId: number | null;
}

export interface ActivityQuery {
  /** Limites já convertidos para instantes UTC (dias civis de São Paulo). */
  fromUtc: string;
  toUtcExclusive: string;
  page: number;
  pageSize: number;
}

/** Subconjunto do cliente supabase-js usado pelos adaptadores (facilita teste com dublê). */
export interface QueryBuilder extends PromiseLike<{ data: unknown[] | null; error: unknown; count?: number | null }> {
  select(columns: string, options?: { count?: "exact" }): QueryBuilder;
  in(column: string, values: readonly (string | number)[]): QueryBuilder;
  gte(column: string, value: string): QueryBuilder;
  lt(column: string, value: string): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
}

export interface ServiceClientLike {
  from(table: string): QueryBuilder;
}

export interface ActivityAdapter {
  id: ActivitySourceId;
  label: string;
  fetch(scope: readonly ScopeUser[], query: ActivityQuery, client: ServiceClientLike | null): Promise<ActivityResult>;
}
