// Novidades: conteúdo publicado por arquivo e publicação pelo hub durante a coexistência (simulação PGlite).
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createTestDb, E, expectSqlError, sql } from "./harness";

const CONTENT_DIR = "supabase/content/novidades";
const contentFiles = () =>
  readdirSync(path.resolve(import.meta.dirname, "..", "..", CONTENT_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `${CONTENT_DIR}/${f}`);

describe("conteúdo de novidades", () => {
  it("todos os arquivos aplicam, não duplicam e ficam visíveis para o colaborador", async () => {
    const db = await createTestDb();
    for (const f of contentFiles()) await db.exec(sql(f));
    const first = (await db.query<{ n: number }>("select count(*)::int n from public.luzia_news")).rows[0]!.n;
    expect(first).toBeGreaterThanOrEqual(4);
    for (const f of contentFiles()) await db.exec(sql(f));
    expect((await db.query<{ n: number }>("select count(*)::int n from public.luzia_news")).rows[0]!.n).toBe(first);

    const seen = await asUser(db, E.userFiscal, async (tx) =>
      (await tx.query<{ title: string; body: string }>("select title, body from public.luzia_news order by published_at desc")).rows,
    );
    expect(seen).toHaveLength(first);
    // Linguagem para o colaborador: sem jargão técnico interno.
    for (const n of seen) expect(`${n.title} ${n.body}`).not.toMatch(/\b(RLS|SQL|migra[cç][aã]o|PostgREST|Supabase|iframe|token|deploy)\b/i);
    // Quebras de linha reais (o painel usa whitespace-pre-line).
    expect(seen.some((n) => n.body.includes("\n"))).toBe(true);
  });
});

describe("publicação pelo hub", () => {
  it("admin publica novidade na coexistência; não-admin continua bloqueado", async () => {
    const db = await createTestDb({ phase: "coexistence" });
    // Estado anterior à migração (o harness aplica todas): reverte para comparar.
    await db.exec(sql("supabase/rollback/20261020130000_luzia_news_any_phase.down.sql"));
    await expectSqlError(
      asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_news(null, 'T', 'Texto', null, now())")),
      /somente leitura durante a coexistência/,
    );
    await db.exec(sql("supabase/migrations/20261020130000_luzia_news_any_phase.sql"));
    const id = await asUser(db, E.admin, async (tx) =>
      (await tx.query<{ id: string }>("select public.luzia_admin_save_news(null, 'Novo atalho', 'Texto simples.', '2.4', now()) id")).rows[0]!.id,
    );
    expect(id).toMatch(/[0-9a-f-]{36}/);
    await expectSqlError(
      asUser(db, E.gerente, (tx) => tx.query("select public.luzia_admin_save_news(null, 'X', 'Y', null, now())")),
      /Somente administradores/,
    );
    // Cadastros continuam travados na coexistência.
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_department(null, 'Novo')")), /somente leitura/);
    // Reversão volta à regra anterior.
    await db.exec(sql("supabase/rollback/20261020130000_luzia_news_any_phase.down.sql"));
    await expectSqlError(
      asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_news(null, 'T', 'Texto', null, now())")),
      /somente leitura durante a coexistência/,
    );
  });
});
