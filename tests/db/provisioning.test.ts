// AC-01 (parte do banco) e AC-02 — provisionamento seguro. Simulação: identidades Microsoft são linhas
// sintéticas em auth.identities; o formato real de identity_data precisa ser confirmado (X-03).
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createAuthUser, createTestDb, type Db, E, expectSqlError, FOREIGN_TENANT, uidOf } from "./harness";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const provision = (email: string) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ user_id: number; access_status: string; provisioned: boolean; linked: boolean }>("select * from public.luzia_provision_me()")).rows[0],
  );

describe("primeiro acesso", () => {
  it("conta corporativa nova recebe perfil mínimo em 'Não atribuído', sem admin", async () => {
    await createAuthUser(db, "nova.pessoa@exemplo.test", { name: "Nova Pessoa" });
    const r = await provision("nova.pessoa@exemplo.test");
    expect(r?.provisioned).toBe(true);
    const { rows } = await db.query<{ user_role: string; is_admin: boolean; dpto_kind: string; user_name: string; auth_user_id: string }>(
      `select u.user_role, u.is_admin, d.dpto_kind, u.user_name, u.auth_user_id
         from public.users u join public.dpto d on d.dpto_id = u.user_dpto where u.user_email = 'nova.pessoa@exemplo.test'`,
    );
    expect(rows[0]).toEqual({ user_role: "usuario", is_admin: false, dpto_kind: "provisionamento", user_name: "Nova Pessoa", auth_user_id: uidOf("nova.pessoa@exemplo.test") });
    const apps = await asUser(db, "nova.pessoa@exemplo.test", (tx) => tx.query("select 1 from public.applications"));
    expect(apps.rows).toHaveLength(0);
  });

  it("segunda chamada é idempotente", async () => {
    await createAuthUser(db, "nova.pessoa@exemplo.test");
    await provision("nova.pessoa@exemplo.test");
    const r = await provision("nova.pessoa@exemplo.test");
    expect(r).toMatchObject({ provisioned: false, linked: false });
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.users where user_email = 'nova.pessoa@exemplo.test'");
    expect(rows[0]?.n).toBe(1);
  });

  it("cadastro corporativo existente sem identidade é vinculado por e-mail (case-insensitive)", async () => {
    await db.query("insert into public.users (user_name, user_email, user_dpto, user_role) select 'Existente', 'Existente@Exemplo.test', dpto_id, 'lider' from public.dpto where dpto_name = 'Fiscal'");
    await createAuthUser(db, "existente@exemplo.test");
    const r = await provision("existente@exemplo.test");
    expect(r).toMatchObject({ linked: true, provisioned: false });
    const { rows } = await db.query<{ user_role: string; auth_user_id: string }>("select user_role, auth_user_id from public.users where lower(user_email) = 'existente@exemplo.test'");
    expect(rows[0]).toEqual({ user_role: "lider", auth_user_id: uidOf("existente@exemplo.test") });
  });

  it("e-mail não reassocia cadastro já vinculado a outra identidade", async () => {
    // Nova identidade (outro id) com o mesmo e-mail de um colaborador já vinculado.
    await db.query("insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', $1)", [E.userFiscal.toUpperCase()]);
    await db.query(
      "insert into auth.identities (user_id, provider, provider_id, identity_data) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'azure', 'x', $1)",
      [JSON.stringify({ custom_claims: { tid: "11111111-1111-4111-8111-111111111111" } })],
    );
    await expectSqlError(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })]);
        await tx.exec("set local role authenticated");
        await tx.query("select * from public.luzia_provision_me()");
      }),
      /já vinculado a outra identidade/,
    );
    const { rows } = await db.query<{ auth_user_id: string }>("select auth_user_id from public.users where user_email = $1", [E.userFiscal]);
    expect(rows[0]?.auth_user_id).toBe(uidOf(E.userFiscal));
  });

  it("conta de outro tenant é recusada e não gera cadastro", async () => {
    await createAuthUser(db, "externo@outro.example", { tid: FOREIGN_TENANT });
    await expectSqlError(provision("externo@outro.example"), /não pertence ao tenant/);
    const { rows } = await db.query("select 1 from public.users where user_email = 'externo@outro.example'");
    expect(rows).toHaveLength(0);
  });

  it("conta criada por e-mail/senha (outra app) é recusada", async () => {
    await createAuthUser(db, "autocadastro@exemplo.test", { provider: "email", tid: null });
    await expectSqlError(provision("autocadastro@exemplo.test"), /não pertence ao tenant/);
  });

  it("sem tenant configurado, nenhum login é aceito (fail-closed)", async () => {
    await db.exec("delete from private.settings where key = 'azure_tenant_id'");
    await createAuthUser(db, "nova.pessoa@exemplo.test");
    await expectSqlError(provision("nova.pessoa@exemplo.test"), /Tenant corporativo não configurado/);
  });

  it("provisionamento é auditado sem copiar nome/e-mail", async () => {
    await createAuthUser(db, "nova.pessoa@exemplo.test");
    const r = await provision("nova.pessoa@exemplo.test");
    const { rows } = await db.query<{ action: string; reason: string; changes: Record<string, unknown> }>(
      "select action, reason, changes from public.admin_audit where entity = 'users' and entity_id = $1", [String(r?.user_id)],
    );
    expect(rows[0]?.action).toBe("insert");
    expect(rows[0]?.reason).toBe("provisionamento-primeiro-acesso");
    expect(rows[0]?.changes).not.toHaveProperty("user_email");
    expect(rows[0]?.changes).not.toHaveProperty("user_name");
  });
});

describe("gatilho legado durante a coexistência (antes do corte)", () => {
  it("documenta R-02: antes do corte, autocadastro por e-mail ainda cria cadastro no hub; depois, não", async () => {
    const legacy = await createTestDb({ cutover: false });
    await createAuthUser(legacy, "autocadastro@exemplo.test", { provider: "email", tid: null });
    const before = await legacy.query("select 1 from public.users where user_email = 'autocadastro@exemplo.test'");
    expect(before.rows).toHaveLength(1);
    // Mesmo assim, o novo hub nega a entrada e 'Não atribuído' não abre nada.
    await expectSqlError(
      asUser(legacy, "autocadastro@exemplo.test", (tx) => tx.query("select * from public.luzia_provision_me()")),
      /não pertence ao tenant/,
    );

    await createAuthUser(db, "autocadastro@exemplo.test", { provider: "email", tid: null });
    const after = await db.query("select 1 from public.users where user_email = 'autocadastro@exemplo.test'");
    expect(after.rows).toHaveLength(0);
  });
});
