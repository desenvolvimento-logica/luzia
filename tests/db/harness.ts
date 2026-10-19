// Banco de teste em PGlite: shim da plataforma Supabase + legado hipotético + migração candidata.
// É uma SIMULAÇÃO: não há PostgREST, GoTrue nem Storage, e a conexão é única.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const sql = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

export const TENANT = "11111111-1111-4111-8111-111111111111";
export const FOREIGN_TENANT = "99999999-9999-4999-8999-999999999999";

export type Db = PGlite;
export type Tx = Transaction;

export interface DbOptions {
  migrate?: boolean;
  seed?: boolean;
  cutover?: boolean;
  linkSeedUsers?: boolean;
}

export function migrationFiles(): string[] {
  return readdirSync(path.join(ROOT, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join("supabase", "migrations", f));
}

export async function createTestDb(options: DbOptions = {}): Promise<Db> {
  const { migrate = true, seed = true, cutover = true, linkSeedUsers = true } = options;
  const db = new PGlite();
  await db.exec("set timezone = 'UTC'");
  await db.exec(sql("supabase/dev/00_supabase_platform_shim.sql"));
  await db.exec(sql("supabase/dev/01_legacy_baseline.sql"));
  if (!migrate) return db;
  for (const file of migrationFiles()) await db.exec(sql(file));
  if (cutover) await db.exec(sql("supabase/cutover/20261019000200_remove_legacy_autoprovision.sql"));
  await db.query("insert into private.settings (key, value) values ('azure_tenant_id', $1)", [TENANT]);
  if (seed) await db.exec(sql("supabase/dev/02_synthetic_seed.sql"));
  if (seed && linkSeedUsers) {
    const { rows } = await db.query<{ user_email: string }>("select user_email from public.users");
    for (const { user_email } of rows) await createAuthUser(db, user_email);
    await db.exec(
      "update public.users u set auth_user_id = a.id from auth.users a where lower(a.email) = lower(u.user_email) and u.auth_user_id is null",
    );
  }
  return db;
}

export function uidOf(email: string): string {
  const h = createHash("md5").update(email.toLowerCase()).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export async function createAuthUser(
  db: Db,
  email: string,
  opts: { provider?: string; tid?: string | null; name?: string } = {},
): Promise<string> {
  const { provider = "azure", tid = TENANT, name } = opts;
  const id = uidOf(email);
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) on conflict (id) do nothing",
    [id, email.toLowerCase(), JSON.stringify(name ? { full_name: name } : {})],
  );
  await db.query(
    "insert into auth.identities (user_id, provider, provider_id, identity_data) values ($1, $2, $3, $4) on conflict do nothing",
    [id, provider, `${provider}:${id}`, JSON.stringify(tid ? { email, custom_claims: { tid } } : { email })],
  );
  return id;
}

/** Executa como o papel `authenticated` com o JWT do colaborador indicado (como o PostgREST faria). */
export async function asUser<T>(db: Db, email: string | null, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = email ? { sub: uidOf(email), role: "authenticated" } : { role: "anon" };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(email ? "set local role authenticated" : "set local role anon");
    return fn(tx);
  });
}

export async function idOf(db: Db, table: "users" | "dpto" | "applications", name: string): Promise<number> {
  const q = {
    users: "select user_id as id from public.users where user_email = $1",
    dpto: "select dpto_id as id from public.dpto where dpto_name = $1",
    applications: "select app_id as id from public.applications where app_name = $1",
  }[table];
  const { rows } = await db.query<{ id: number }>(q, [name]);
  if (!rows[0]) throw new Error(`não encontrado: ${table} ${name}`);
  return Number(rows[0].id);
}

export const E = {
  admin: "ana.admin@exemplo.test",
  diretor: "davi.diretor@exemplo.test",
  gerente: "gina.gerente@exemplo.test",
  coordFiscal: "caio.coord@exemplo.test",
  coordFiscal2: "cora.coord@exemplo.test",
  liderFiscal: "lia.lider@exemplo.test",
  liderFiscal2: "leo.lider@exemplo.test",
  userFiscal: "ugo.usuario@exemplo.test",
  userFiscal2: "ursula.usuaria@exemplo.test",
  desativada: "dora.desativada@exemplo.test",
  coordTrib: "teo.coord@exemplo.test",
  liderTrib: "tina.lider@exemplo.test",
  userTrib: "tom.usuario@exemplo.test",
  pendente: "paulo.pendente@exemplo.test",
} as const;

export async function expectSqlError(p: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await p;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!pattern.test(msg)) throw new Error(`erro inesperado: ${msg}`);
    return;
  }
  throw new Error(`esperava erro ${pattern}`);
}
