// AC-12 com dublê do cliente service role. Schemas reais das aplicações: pendentes (X-06).
import { describe, expect, it } from "vitest";
import { createEmailProfileAdapter, type EmailProfileMapping } from "@/lib/activities/email-profile-adapter";
import { ACTIVITY_ADAPTERS } from "@/lib/activities/registry";
import { narrowScope } from "@/lib/activities/scope";
import type { QueryBuilder, ScopeUser, ServiceClientLike } from "@/lib/activities/types";

type Row = Record<string, unknown>;

/** Dublê mínimo do PostgREST que registra as consultas para provar que o filtro acontece na fonte. */
function fakeClient(tables: Record<string, Row[]>, opts: { failTable?: string } = {}) {
  const log: { table: string; inColumn?: string; inValues?: readonly (string | number)[] }[] = [];
  const client: ServiceClientLike = {
    from(table) {
      let rows = [...(tables[table] ?? [])];
      const entry: (typeof log)[number] = { table };
      log.push(entry);
      let range: [number, number] | null = null;
      const total = () => rows.length;
      const qb: QueryBuilder = {
        select: () => qb,
        in: (col, values) => {
          entry.inColumn = col;
          entry.inValues = values;
          rows = rows.filter((r) => values.map(String).includes(String(r[col])));
          return qb;
        },
        gte: (col, v) => ((rows = rows.filter((r) => String(r[col]) >= v)), qb),
        lt: (col, v) => ((rows = rows.filter((r) => String(r[col]) < v)), qb),
        order: (col, o) => ((rows = rows.sort((a, b) => (String(a[col]) < String(b[col]) ? 1 : -1) * (o.ascending ? -1 : 1))), qb),
        range: (a, b) => ((range = [a, b]), qb),
        then: (resolve, reject) => {
          if (opts.failTable === table) return Promise.resolve({ data: null, error: { message: "boom" }, count: null }).then(resolve, reject);
          const count = total();
          const data = range ? rows.slice(range[0], range[1] + 1) : rows;
          return Promise.resolve({ data, error: null, count }).then(resolve, reject);
        },
      };
      return qb;
    },
  };
  return { client, log };
}

const mapping: EmailProfileMapping = {
  profileTable: "perfis_sinteticos",
  profileIdColumn: "id",
  profileEmailColumn: "email",
  activityTable: "acoes_sinteticas",
  activityIdColumn: "id",
  activityProfileColumn: "perfil_id",
  activityDateColumn: "criado_em",
  activityTypeColumn: "tipo",
  activitySummaryColumn: "resumo",
  defaultType: "Ação",
};

const scope: ScopeUser[] = [
  { userId: 1, name: "Ugo", email: "ugo.usuario@exemplo.test", dptoId: 10 },
  { userId: 2, name: "Úrsula", email: "ursula.usuaria@exemplo.test", dptoId: 10 },
];
const tables = {
  perfis_sinteticos: [
    { id: "p1", email: "ugo.usuario@exemplo.test" },
    { id: "p2", email: "ursula.usuaria@exemplo.test" },
    { id: "p9", email: "gina.gerente@exemplo.test" },
  ],
  acoes_sinteticas: [
    { id: "a1", perfil_id: "p1", criado_em: "2026-10-05T12:00:00.000Z", tipo: "Comparação", resumo: "ok" },
    { id: "a2", perfil_id: "p2", criado_em: "2026-10-06T12:00:00.000Z", tipo: null, resumo: "ok" },
    { id: "a9", perfil_id: "p9", criado_em: "2026-10-06T12:00:00.000Z", tipo: "Comparação", resumo: "fora do escopo" },
    { id: "a0", perfil_id: "p1", criado_em: "2026-09-01T12:00:00.000Z", tipo: "Antiga", resumo: "fora do período" },
  ],
};
const query = { fromUtc: "2026-10-01T03:00:00.000Z", toUtcExclusive: "2026-10-16T03:00:00.000Z", page: 1, pageSize: 25 };

describe("adaptador por e-mail (AC-12)", () => {
  const adapter = createEmailProfileAdapter("fiscocheck", "Teste", mapping, "pendente");

  it("retorna somente atividades do escopo, no período, normalizadas", async () => {
    const { client, log } = fakeClient(tables);
    const r = await adapter.fetch(scope, query, client);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.items.map((i) => i.id).sort()).toEqual(["a1", "a2"]);
    expect(r.items.find((i) => i.id === "a2")?.type).toBe("Ação");
    expect(r.items.every((i) => [1, 2].includes(i.userId))).toBe(true);
    // A consulta de perfis é filtrada na fonte pelos e-mails do escopo (sem carga irrestrita).
    expect(log[0]).toMatchObject({ table: "perfis_sinteticos", inColumn: "email" });
    expect(log[0]?.inValues).toEqual(["ugo.usuario@exemplo.test", "ursula.usuaria@exemplo.test"]);
    expect(log[1]?.inValues).toEqual(["p1", "p2"]);
  });

  it("escopo vazio, sem perfis ou sem atividades → 'vazio' (não confundido com indisponível)", async () => {
    const { client } = fakeClient(tables);
    expect(await adapter.fetch([], query, client)).toEqual({ status: "vazio" });
    expect(await adapter.fetch([{ userId: 5, name: "X", email: "sem.perfil@exemplo.test", dptoId: 1 }], query, client)).toEqual({ status: "vazio" });
    expect(await adapter.fetch(scope, { ...query, fromUtc: "2030-01-01T00:00:00Z", toUtcExclusive: "2030-01-02T00:00:00Z" }, client)).toEqual({ status: "vazio" });
  });

  it("falha da fonte ou ausência de service role → 'indisponivel'", async () => {
    expect((await adapter.fetch(scope, query, fakeClient(tables, { failTable: "acoes_sinteticas" }).client)).status).toBe("indisponivel");
    expect((await adapter.fetch(scope, query, null)).status).toBe("indisponivel");
  });

  it("mapeamento ausente ou com identificador suspeito → 'nao_suportado'", async () => {
    const pending = createEmailProfileAdapter("tributario", "X", null, "schema pendente");
    expect(await pending.fetch(scope, query, fakeClient(tables).client)).toEqual({ status: "nao_suportado", message: "schema pendente" });
    const bad = createEmailProfileAdapter("tributario", "X", { ...mapping, activityTable: "acoes;drop" }, "inválido");
    expect((await bad.fetch(scope, query, fakeClient(tables).client)).status).toBe("nao_suportado");
  });

  it("paginação usa total da fonte", async () => {
    const r = await adapter.fetch(scope, { ...query, pageSize: 1 }, fakeClient(tables).client);
    expect(r).toMatchObject({ status: "ok", total: 2 });
    if (r.status === "ok") expect(r.items).toHaveLength(1);
  });

  it("limitação documentada: e-mail com maiúsculas na aplicação não é conciliado (X-06)", async () => {
    const upper = { ...tables, perfis_sinteticos: [{ id: "p1", email: "UGO.usuario@exemplo.test" }] };
    expect(await adapter.fetch(scope, query, fakeClient(upper).client)).toEqual({ status: "vazio" });
  });

  it("filtros só estreitam o escopo", () => {
    expect(narrowScope(scope, { userId: 99, dptoId: null })).toEqual([]);
    expect(narrowScope(scope, { userId: null, dptoId: 10 })).toHaveLength(2);
  });

  it("adaptadores reais (Fisco Check, Tributário) seguem 'não suportado' até confirmar schema", async () => {
    for (const a of ACTIVITY_ADAPTERS) {
      expect((await a.fetch(scope, query, fakeClient(tables).client)).status).toBe("nao_suportado");
    }
  });
});
