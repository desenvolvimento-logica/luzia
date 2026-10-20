// AC-16 (simulação) — ensaio da fundação luzia_ sobre o legado HIPOTÉTICO com dados sintéticos:
// idempotência, legado intocado, reversão completa e reaplicação. Não substitui o ensaio no projeto real.
import { describe, expect, it } from "vitest";
import { applyMigrations, createTestDb, type Db, expectSqlError, legacyFingerprint, sql } from "./harness";

const ROLLBACK = "supabase/rollback/20261020100000_luzia_foundation.down.sql";

const luziaObjects = async (db: Db) =>
  (await db.query<{ n: number }>(`select
     (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname like 'luzia\\_%')
   + (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.proname like 'luzia\\_%')
   + (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typname like 'luzia\\_%') as n`)).rows[0]!.n;

describe("ensaio de migração e reversão (AC-16, simulação)", () => {
  it("aplica duas vezes, reverte só objetos luzia_ e reaplica, sem tocar no legado", async () => {
    const db = await createTestDb({ legacyOnly: true });
    const legacy = await legacyFingerprint(db);

    await applyMigrations(db);
    await applyMigrations(db); // idempotente
    await db.query("select private.luzia_import_legacy()");
    expect(Number(await luziaObjects(db))).toBeGreaterThan(40);
    expect(await legacyFingerprint(db)).toBe(legacy);

    await expectSqlError(db.exec(sql(ROLLBACK)), /confirmação ausente/);
    await db.exec(`begin; set local luzia.confirm_drop = 'remover-objetos-luzia'; ${sql(ROLLBACK)} commit;`);
    expect(Number(await luziaObjects(db))).toBe(0);
    expect(await legacyFingerprint(db)).toBe(legacy);

    await applyMigrations(db);
    await db.query("select private.luzia_import_legacy()");
    expect((await db.query("select 1 from public.luzia_collaborators")).rows.length).toBeGreaterThan(0);
  });

  it("reversão da fundação é recusada depois do corte", async () => {
    const db = await createTestDb({ phase: "primary" });
    await expect(db.exec(`begin; set local luzia.confirm_drop = 'remover-objetos-luzia'; ${sql(ROLLBACK)} commit;`)).rejects.toThrow(/fase primary ativa/);
    await db.exec("rollback");
    expect((await db.query("select 1 from public.luzia_settings")).rows.length).toBeGreaterThan(0);
  });

  it("verificação somente leitura não aponta problemas de RLS, grants ou objetos em tabelas compartilhadas", async () => {
    const db = await createTestDb();
    const { rows } = await db.query<{ verificacao: string }>(sql("supabase/verification/20261020100000_luzia_foundation.check.sql"));
    const v = JSON.parse(rows[0]!.verificacao);
    expect(v.rls_desligado).toEqual([]);
    expect(v.escrita_direta_concedida).toEqual([]);
    expect(v.leitura_anon).toEqual([]);
    expect(v.funcoes_definer_sem_search_path).toEqual([]);
    expect(v.objetos_em_tabelas_compartilhadas).toEqual([]);
    expect(v.divergencias.colaboradores_ausentes_no_luzia).toBe(0);
    expect(v.divergencias.colaboradores_com_dados_diferentes).toBe(0); // e-mail com maiúsculas no legado é comparado normalizado
  });

  it("baseline hipotético e seed recusam banco que já tem dados do hub", async () => {
    const db = await createTestDb();
    await expect(db.exec(sql("supabase/dev/01_legacy_baseline.sql"))).rejects.toThrow(/já existem/);
    await expect(db.exec(sql("supabase/dev/02_synthetic_seed.sql"))).rejects.toThrow(/já contém dados/);
  });
});
