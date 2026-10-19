// AC-16 (simulação) — ensaio da migração candidata e da reversão sobre o legado HIPOTÉTICO com dados
// sintéticos. Não substitui o ensaio numa cópia isolada do banco real (docs/transicao.md).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { asUser, createAuthUser, createTestDb, type Db, migrationFiles } from "./harness";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const migrate = async (db: Db) => {
  for (const f of migrationFiles()) await db.exec(read(f));
};

async function legacyWithData(): Promise<Db> {
  const db = await createTestDb({ migrate: false });
  await db.exec(`
    insert into public.dpto (dpto_name) values ('Fiscal'), ('Tributário');
    insert into public.applications (app_name, app_url, app_status) values
      ('Global', 'https://global.exemplo.test/', true),
      ('Restrita', 'https://restrita.exemplo.test/', true),
      ('Legada http', 'http://legado.exemplo.test/', true);
    insert into public.applications_dpto select a.app_id, d.dpto_id from public.applications a, public.dpto d
      where a.app_name = 'Restrita' and d.dpto_name = 'Fiscal';
  `);
  // Usuários entram pelo gatilho legado (provisionamento em 'Não atribuído').
  for (const email of ["a@exemplo.test", "b@exemplo.test", "c@exemplo.test"]) await createAuthUser(db, email);
  await db.exec(`
    update public.users set user_dpto = (select dpto_id from public.dpto where dpto_name = 'Fiscal'), is_admin = (user_email = 'a@exemplo.test')
      where user_email in ('a@exemplo.test', 'b@exemplo.test');
    insert into public.access_log (user_id, app_id, datetime)
      select u.user_id, a.app_id, now() - (g || ' hours')::interval
        from public.users u, public.applications a, generate_series(1, 40) g;
  `);
  return db;
}

async function counts(db: Db) {
  const { rows } = await db.query<{ users: number; dpto: number; apps: number; links: number; logs: number }>(`select
    (select count(*)::int from public.users) users, (select count(*)::int from public.dpto) dpto,
    (select count(*)::int from public.applications) apps, (select count(*)::int from public.applications_dpto) links,
    (select count(*)::int from public.access_log) logs`);
  return rows[0];
}

const policies = async (db: Db) =>
  (await db.query<{ p: string }>("select tablename || '.' || policyname as p from pg_policies where schemaname = 'public' order by 1")).rows.map((r) => r.p);

describe("ensaio de migração e reversão (AC-16, simulação)", () => {
  it("preserva contagens, faz backfill que mantém a interpretação legada e é reaplicável", async () => {
    const db = await legacyWithData();
    const before = await counts(db);
    const legacyPolicies = await policies(db);

    await migrate(db);
    expect(await counts(db)).toEqual(before);
    const { rows: aud } = await db.query<{ app_name: string; audience: string }>("select app_name, audience from public.applications order by app_name");
    expect(aud).toEqual([
      { app_name: "Global", audience: "todos" },
      { app_name: "Legada http", audience: "todos" },
      { app_name: "Restrita", audience: "selecionados" },
    ]);
    const { rows: kind } = await db.query<{ dpto_kind: string }>("select dpto_kind from public.dpto where dpto_name = 'Não atribuído'");
    expect(kind[0]?.dpto_kind).toBe("provisionamento");
    const { rows: st } = await db.query<{ n: number }>("select count(*)::int n from public.users where access_status = 'ativo'");
    expect(st[0]?.n).toBe(before!.users);
    expect((await policies(db)).every((p) => p.split(".")[1]!.startsWith("luzia_"))).toBe(true);

    // Reaplicar a migração não falha nem duplica dados.
    await migrate(db);
    expect(await counts(db)).toEqual(before);

    // Linha legada com http continua lá (restrição NOT VALID), mas novas gravações inseguras são recusadas.
    const { rows: http } = await db.query("select 1 from public.applications where app_url like 'http://%'");
    expect(http).toHaveLength(1);

    // Reversão: dados preservados, políticas legadas restauradas, funções v2 removidas.
    await db.exec(read("supabase/rollback/20261019000100_hub_v2_foundation.down.sql"));
    expect(await counts(db)).toEqual(before);
    expect(await policies(db)).toEqual(legacyPolicies);
    const { rows: fn } = await db.query("select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'private' and p.proname = 'me'");
    expect(fn).toHaveLength(0);
    const { rows: kept } = await db.query("select 1 from information_schema.columns where table_name = 'applications' and column_name = 'audience'");
    expect(kept).toHaveLength(1);

    // Comportamento legado volta: usuário em 'Não atribuído' vê a app global de novo.
    const visible = await asUser(db, "c@exemplo.test", async (tx) => (await tx.query<{ app_name: string }>("select app_name from public.applications order by 1")).rows.map((r) => r.app_name));
    expect(visible).toEqual(["Global", "Legada http"]);
    const { rows: grants } = await db.query("select 1 from information_schema.role_table_grants where table_name = 'users' and grantee = 'anon'");
    expect(grants.length).toBeGreaterThan(0);

    // Nova tentativa depois da reversão.
    await migrate(db);
    expect((await policies(db)).every((p) => p.split(".")[1]!.startsWith("luzia_"))).toBe(true);
    const blocked = await asUser(db, "c@exemplo.test", async (tx) => (await tx.query("select app_name from public.applications")).rows);
    expect(blocked).toHaveLength(0);
  });

  it("baseline hipotético e seed recusam banco que já tem dados do hub", async () => {
    const db = await createTestDb();
    await expect(db.exec(read("supabase/dev/01_legacy_baseline.sql"))).rejects.toThrow(/já existem/);
    await expect(db.exec(read("supabase/dev/02_synthetic_seed.sql"))).rejects.toThrow(/já contém dados/);
  });
});
