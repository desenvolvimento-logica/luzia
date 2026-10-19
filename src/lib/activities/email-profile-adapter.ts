import type { ActivityAdapter, ActivityResult, ActivitySourceId, NormalizedActivity, ScopeUser } from "./types";

/**
 * Mapeamento de uma aplicação cujo perfil local é conciliado por e-mail (compatibilidade legada, RN-03).
 * Todos os nomes de tabela/coluna precisam vir do schema real verificado — não inferir.
 */
export interface EmailProfileMapping {
  profileTable: string;
  profileIdColumn: string;
  profileEmailColumn: string;
  activityTable: string;
  activityIdColumn: string;
  activityProfileColumn: string;
  activityDateColumn: string;
  activityTypeColumn: string | null;
  activitySummaryColumn: string;
  defaultType: string;
}

const EMAIL_CHUNK = 100;
const IDENT = /^[a-z_][a-z0-9_]{0,62}$/;

function validMapping(m: EmailProfileMapping): boolean {
  const cols = [m.profileTable, m.profileIdColumn, m.profileEmailColumn, m.activityTable, m.activityIdColumn, m.activityProfileColumn, m.activityDateColumn, m.activitySummaryColumn];
  if (m.activityTypeColumn) cols.push(m.activityTypeColumn);
  return cols.every((c) => IDENT.test(c));
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function createEmailProfileAdapter(id: ActivitySourceId, label: string, mapping: EmailProfileMapping | null, pendingReason: string): ActivityAdapter {
  return {
    id,
    label,
    async fetch(scope, query, client): Promise<ActivityResult> {
      if (!mapping || !validMapping(mapping)) return { status: "nao_suportado", message: pendingReason };
      if (!client) return { status: "indisponivel", message: "Integração não configurada no servidor." };
      if (scope.length === 0) return { status: "vazio" };

      const byEmail = new Map<string, ScopeUser>(scope.map((u) => [u.email.toLowerCase(), u]));
      const emails = [...byEmail.keys()];
      const profileToUser = new Map<string, ScopeUser>();
      try {
        // Consulta restrita aos e-mails do escopo — nunca carga irrestrita seguida de filtro em memória.
        for (let i = 0; i < emails.length; i += EMAIL_CHUNK) {
          const chunk = emails.slice(i, i + EMAIL_CHUNK);
          const { data, error } = await client
            .from(mapping.profileTable)
            .select(`${mapping.profileIdColumn}, ${mapping.profileEmailColumn}`)
            .in(mapping.profileEmailColumn, chunk);
          if (error) return { status: "indisponivel", message: "A aplicação não respondeu à consulta de perfis." };
          for (const row of (data ?? []) as Record<string, unknown>[]) {
            const user = byEmail.get(str(row[mapping.profileEmailColumn]).toLowerCase());
            if (user) profileToUser.set(str(row[mapping.profileIdColumn]), user);
          }
        }
        if (profileToUser.size === 0) return { status: "vazio" };

        const cols = [mapping.activityIdColumn, mapping.activityProfileColumn, mapping.activityDateColumn, mapping.activitySummaryColumn];
        if (mapping.activityTypeColumn) cols.push(mapping.activityTypeColumn);
        const offset = (query.page - 1) * query.pageSize;
        const { data, error, count } = await client
          .from(mapping.activityTable)
          .select(cols.join(", "), { count: "exact" })
          .in(mapping.activityProfileColumn, [...profileToUser.keys()])
          .gte(mapping.activityDateColumn, query.fromUtc)
          .lt(mapping.activityDateColumn, query.toUtcExclusive)
          .order(mapping.activityDateColumn, { ascending: false })
          .range(offset, offset + query.pageSize - 1);
        if (error) return { status: "indisponivel", message: "A aplicação não respondeu à consulta de atividades." };

        const items: NormalizedActivity[] = [];
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          const user = profileToUser.get(str(row[mapping.activityProfileColumn]));
          if (!user) continue; // defesa extra: nunca retornar fora do escopo
          items.push({
            source: id,
            id: str(row[mapping.activityIdColumn]),
            userId: user.userId,
            userName: user.name,
            dptoId: user.dptoId,
            type: mapping.activityTypeColumn ? str(row[mapping.activityTypeColumn]) || mapping.defaultType : mapping.defaultType,
            summary: str(row[mapping.activitySummaryColumn]).slice(0, 280),
            occurredAt: str(row[mapping.activityDateColumn]),
          });
        }
        if (items.length === 0 && offset === 0) return { status: "vazio" };
        return { status: "ok", items, total: count ?? items.length };
      } catch {
        return { status: "indisponivel", message: "Falha de comunicação com a integração." };
      }
    },
  };
}
