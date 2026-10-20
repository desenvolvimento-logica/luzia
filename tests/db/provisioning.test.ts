// AC-01 (parte do banco) e AC-02 — provisionamento seguro nas duas fases. Simulação: identidades Microsoft são
// linhas sintéticas em auth.identities; o formato real de identity_data precisa ser confirmado (X-03).
import { describe, expect, it } from "vitest";
import { asUser, createAuthUser, createTestDb, type Db, E, expectSqlError, FOREIGN_TENANT, uidOf } from "./harness";

const provision = (db: Db, email: string, microsoft = true) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ collaborator_id: number; access_status: string; outcome: string }>("select * from public.luzia_provision_me()")).rows[0],
  { microsoft });

describe("primeiro acesso", () => {
  it("colaborador já importado: 'existente', sem mudanças", async () => {
    const db = await createTestDb();
    expect(await provision(db, E.userFiscal)).toMatchObject({ outcome: "existente", access_status: "active" });
  });

  it("coexistência: conta nova criada pelo gatilho legado é adotada com perfil mínimo e sem apps", async () => {
    const db = await createTestDb();
    await createAuthUser(db, "nova.pessoa@exemplo.test", { name: "Nova Pessoa" });
    const r = await provision(db, "nova.pessoa@exemplo.test");
    expect(r?.outcome).toBe("adotado");
    const { rows } = await db.query<{ role: string; is_admin: boolean; kind: string; auth_user_id: string }>(
      `select c.role::text, c.is_admin, d.kind::text, c.auth_user_id from public.luzia_collaborators c
         join public.luzia_departments d on d.id = c.department_id where c.email = 'nova.pessoa@exemplo.test'`,
    );
    expect(rows[0]).toEqual({ role: "usuario", is_admin: false, kind: "provisioning", auth_user_id: uidOf("nova.pessoa@exemplo.test") });
    expect((await asUser(db, "nova.pessoa@exemplo.test", (tx) => tx.query("select 1 from public.luzia_applications"))).rows).toHaveLength(0);
  });

  it("adoção nunca herda administração indevida nem departamento inexistente", async () => {
    const db = await createTestDb({ phase: "primary" });
    await createAuthUser(db, "nova.pessoa@exemplo.test");
    // Departamento legado criado depois do corte (ainda inexistente no luzia_) vira provisioning na adoção.
    await db.exec(`insert into public.dpto (dpto_name) values ('Criado no legado');
      update public.users set user_dpto = (select dpto_id from public.dpto where dpto_name = 'Criado no legado') where user_email = 'nova.pessoa@exemplo.test';`);
    await provision(db, "nova.pessoa@exemplo.test");
    const { rows } = await db.query<{ kind: string }>(
      "select d.kind::text from public.luzia_collaborators c join public.luzia_departments d on d.id = c.department_id where c.email = 'nova.pessoa@exemplo.test'",
    );
    expect(rows[0]?.kind).toBe("provisioning");
  });

  it("coexistência: sem cadastro legado, nega (cadastro nasce no hub antigo)", async () => {
    const db = await createTestDb();
    await db.exec("alter table auth.users disable trigger on_auth_user_created");
    await createAuthUser(db, "sem.cadastro@exemplo.test");
    await expectSqlError(provision(db, "sem.cadastro@exemplo.test"), /ainda não sincronizado/);
  });

  it("fase primary: vincula cadastro luzia sem identidade pelo e-mail; e-mail não reassocia identidade", async () => {
    const db = await createTestDb({ phase: "primary" });
    await db.exec("alter table auth.users disable trigger on_auth_user_created");
    await asUser(db, E.admin, (tx) => tx.query(
      "select public.luzia_admin_change_identity((select id from public.luzia_collaborators where email = $1), null, $1, 'Conta Microsoft recriada pela TI')", [E.userTrib]));
    await db.query("delete from auth.identities where user_id = $1", [uidOf(E.userTrib)]);
    await db.query("delete from auth.users where id = $1", [uidOf(E.userTrib)]);
    await createAuthUser(db, E.userTrib);
    expect(await provision(db, E.userTrib)).toMatchObject({ outcome: "vinculado" });

    // Outra identidade com o e-mail de um colaborador já vinculado.
    const other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query("insert into auth.users (id, email) values ($1, $2)", [other, E.userFiscal.toUpperCase()]);
    await db.query("insert into auth.identities (user_id, provider, provider_id, identity_data) values ($1, 'azure', 'x', $2)", [
      other, JSON.stringify({ custom_claims: { tid: "11111111-1111-4111-8111-111111111111" } }),
    ]);
    await expectSqlError(
      asUser(db, null, (tx) => tx.query("select * from public.luzia_provision_me()"), { sub: other }),
      /já vinculado a outra identidade/,
    );
  });

  it("conta de outro tenant, conta e-mail/senha e sessão não-Microsoft são recusadas", async () => {
    const db = await createTestDb({ phase: "primary" });
    await createAuthUser(db, "externo@outro.example", { tid: FOREIGN_TENANT });
    await expectSqlError(provision(db, "externo@outro.example"), /não pertence ao tenant/);
    await createAuthUser(db, "autocadastro@exemplo.test", { provider: "email", tid: null });
    await expectSqlError(provision(db, "autocadastro@exemplo.test"), /não pertence ao tenant/);
    await expectSqlError(provision(db, E.userFiscal, false), /Sessão não é Microsoft/);
    for (const email of ["externo@outro.example", "autocadastro@exemplo.test"]) {
      expect((await db.query("select 1 from public.luzia_collaborators where email = $1", [email])).rows, email).toHaveLength(0);
    }
  });

  it("sem tenant configurado, nenhum login é aceito (fail-closed)", async () => {
    const db = await createTestDb();
    await db.exec("delete from public.luzia_settings where key = 'azure_tenant_id'");
    await expectSqlError(provision(db, E.userFiscal), /Tenant corporativo não configurado/);
  });

  it("adoção é auditada sem copiar nome/e-mail", async () => {
    const db = await createTestDb();
    await createAuthUser(db, "nova.pessoa@exemplo.test");
    const r = await provision(db, "nova.pessoa@exemplo.test");
    const { rows } = await db.query<{ action: string; reason: string; changes: Record<string, unknown> }>(
      "select action, reason, changes from public.luzia_audit_events where entity = 'luzia_collaborators' and entity_id = $1", [String(r?.collaborator_id)],
    );
    expect(rows[0]).toMatchObject({ action: "insert", reason: "adocao-cadastro-legado" });
    expect(rows[0]?.changes).not.toHaveProperty("email");
    expect(rows[0]?.changes).not.toHaveProperty("name");
  });
});
