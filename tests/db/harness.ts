// Banco de teste em PGlite: shim da plataforma Supabase + legado hipotético + migração luzia_ + importação.
// É uma SIMULAÇÃO: não há PostgREST, GoTrue nem Storage, e a conexão é única.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const sql = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

export const TENANT = "11111111-1111-4111-8111-111111111111";
export const FOREIGN_TENANT = "99999999-9999-4999-8999-999999999999";
export const CUTOVER = "supabase/cutover/20261020110000_luzia_switch_to_primary.sql";

export type Db = PGlite;
export type Tx = Transaction;
export type Phase = "coexistence" | "primary";

export interface DbOptions {
  /** Só o legado (sem luzia_). */
  legacyOnly?: boolean;
  seed?: boolean;
  importLegacy?: boolean;
  phase?: Phase;
}

export function migrationFiles(): string[] {
  return readdirSync(path.join(ROOT, "supabase", "migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join("supabase", "migrations", f));
}

export async function applyMigrations(db: Db): Promise<void> {
  for (const file of migrationFiles()) await db.exec(sql(file));
}

export async function createTestDb(options: DbOptions = {}): Promise<Db> {
  const { legacyOnly = false, seed = true, importLegacy = true, phase = "coexistence" } = options;
  const db = new PGlite();
  await db.exec("set timezone = 'UTC'");
  // O schema private já existe no projeto compartilhado (usado por outras apps).
  await db.exec(sql("supabase/dev/00_supabase_platform_shim.sql"));
  await db.exec("create schema private; grant usage on schema private to authenticated, service_role;");
  await db.exec(sql("supabase/dev/01_legacy_baseline.sql"));
  if (seed) {
    await db.exec(sql("supabase/dev/02_synthetic_seed.sql"));
    // Login Microsoft de cada colaborador: o gatilho legado on_auth_user_created vincula por e-mail.
    const { rows } = await db.query<{ user_email: string }>("select user_email from public.users");
    for (const { user_email } of rows) await createAuthUser(db, user_email);
  }
  if (legacyOnly) return db;

  await applyMigrations(db);
  await db.query("insert into public.luzia_settings (key, value) values ('azure_tenant_id', $1)", [TENANT]);
  if (seed && importLegacy) {
    await db.query("select private.luzia_import_legacy()");
    await db.query("update public.luzia_collaborators set access_status = 'inactive' where email = $1", [E.desativada]);
  }
  if (phase === "primary") await db.exec(sql(CUTOVER));
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
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3) on conflict (id) do nothing", [
    id,
    email.toLowerCase(),
    JSON.stringify(name ? { full_name: name } : {}),
  ]);
  await db.query(
    "insert into auth.identities (user_id, provider, provider_id, identity_data) values ($1, $2, $3, $4) on conflict do nothing",
    [id, provider, `${provider}:${id}`, JSON.stringify(tid ? { email, custom_claims: { tid } } : { email })],
  );
  return id;
}

export interface SessionOptions {
  /** Sessão criada por login Microsoft (amr oauth + provedor azure). Padrão: true. */
  microsoft?: boolean;
  sub?: string;
}

export function claimsFor(email: string | null, opts: SessionOptions = {}) {
  if (!email && !opts.sub) return { role: "anon" };
  const microsoft = opts.microsoft ?? true;
  return {
    sub: opts.sub ?? uidOf(email!),
    role: "authenticated",
    amr: [{ method: microsoft ? "oauth" : "password", timestamp: 1 }],
    app_metadata: { provider: microsoft ? "azure" : "email", providers: [microsoft ? "azure" : "email"] },
  };
}

/** Executa como `authenticated` com o JWT do colaborador indicado (como o PostgREST faria). */
export async function asUser<T>(db: Db, email: string | null, fn: (tx: Tx) => Promise<T>, opts: SessionOptions = {}): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = claimsFor(email, opts);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(claims.role === "anon" ? "set local role anon" : "set local role authenticated");
    return fn(tx);
  });
}

export async function idOf(db: Db, table: "collaborator" | "department" | "application", name: string): Promise<number | string> {
  const q = {
    collaborator: "select id::text as id from public.luzia_collaborators where email = lower($1)",
    department: "select id::text as id from public.luzia_departments where name = $1",
    application: "select id::text as id from public.luzia_applications where name = $1",
  }[table];
  const { rows } = await db.query<{ id: string }>(q, [name]);
  if (!rows[0]) throw new Error(`não encontrado: ${table} ${name}`);
  return table === "application" ? rows[0].id : Number(rows[0].id);
}

export const collaboratorId = async (db: Db, email: string) => (await idOf(db, "collaborator", email)) as number;
export const departmentId = async (db: Db, name: string) => (await idOf(db, "department", name)) as number;
export const applicationId = async (db: Db, name: string) => (await idOf(db, "application", name)) as string;

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

/** Impressão digital das tabelas legadas (dados + políticas + gatilhos) para provar que nada mudou. */
export async function legacyFingerprint(db: Db): Promise<string> {
  const { rows } = await db.query<{ f: string }>(`select md5(string_agg(x, '|' order by x)) as f from (
    select 'dpto:' || t::text as x from public.dpto t
    union all select 'users:' || t::text from public.users t
    union all select 'apps:' || t::text from public.applications t
    union all select 'apps_dpto:' || t::text from public.applications_dpto t
    union all select 'log:' || t::text from public.access_log t
    union all select 'notes:' || t::text from public.patch_notes t
    union all select 'pol:' || tablename || policyname || coalesce(qual, '') || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename not like 'luzia\\_%'
    union all select 'trg:' || tgrelid::regclass::text || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text not like '%luzia\\_%'
    union all select 'grant:' || table_name || grantee || privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name not like 'luzia\\_%'
  ) s`);
  return rows[0]!.f;
}
