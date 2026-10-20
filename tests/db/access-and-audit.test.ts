// AC-04, AC-09, AC-13 e proteções de cadastro nas tabelas luzia_ (simulação PGlite, fase primary).
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { applicationId, asUser, collaboratorId, createTestDb, type Db, departmentId, E, expectSqlError } from "./harness";

let db: Db;
beforeEach(async () => {
  db = await createTestDb({ phase: "primary" });
});

const registerOpen = (email: string, appId: string, openId: string) =>
  asUser(db, email, async (tx) => Number((await tx.query<{ id: number }>("select public.luzia_register_open($1, $2) as id", [appId, openId])).rows[0]?.id));
const updateCollaborator = (actor: string, id: number, dept: number, role: string, admin: boolean, status: string) =>
  asUser(db, actor, (tx) => tx.query("select public.luzia_admin_update_collaborator($1, $2, $3, $4, $5)", [id, dept, role, admin, status]));

describe("registro idempotente de abertura (AC-09)", () => {
  it("repetir a mesma abertura não duplica; nova abertura intencional gera novo evento", async () => {
    const app = await applicationId(db, "Fisco Check");
    const first = randomUUID();
    const a = await registerOpen(E.userFiscal, app, first);
    expect(await registerOpen(E.userFiscal, app, first)).toBe(a);
    expect(await registerOpen(E.userFiscal, app, randomUUID())).not.toBe(a);
    expect((await db.query<{ n: number }>("select count(*)::int n from public.luzia_access_events")).rows[0]?.n).toBe(2);
  });

  it("identificador de abertura de outro colaborador é rejeitado", async () => {
    const app = await applicationId(db, "Fisco Check");
    const id = randomUUID();
    await registerOpen(E.userFiscal, app, id);
    await expectSqlError(registerOpen(E.userFiscal2, app, id), /Identificador de abertura inválido/);
  });

  it("negações não geram registro (AC-04)", async () => {
    await expectSqlError(registerOpen(E.admin, await applicationId(db, "Aplicação Antiga"), randomUUID()), /não autorizada/);
    await expectSqlError(registerOpen(E.userFiscal, await applicationId(db, "Mensagens e-CAC"), randomUUID()), /não autorizada/);
    await expectSqlError(registerOpen(E.desativada, await applicationId(db, "Portal Geral"), randomUUID()), /sem acesso ativo/);
    await expectSqlError(registerOpen(E.pendente, await applicationId(db, "Portal Geral"), randomUUID()), /não autorizada/);
    expect((await db.query("select 1 from public.luzia_access_events")).rows).toHaveLength(0);
  });

  it("eventos de acesso são somente inserção", async () => {
    await registerOpen(E.userFiscal, await applicationId(db, "Portal Geral"), randomUUID());
    await expectSqlError(db.query("update public.luzia_access_events set opened_at = now()"), /somente inserção/);
    await expectSqlError(db.query("delete from public.luzia_access_events"), /Exclusão não permitida/);
  });
});

describe("auditoria atômica (AC-13)", () => {
  it("alteração administrativa registra ator, entidade e de/para", async () => {
    const ugo = await collaboratorId(db, E.userFiscal);
    const fiscal = await departmentId(db, "Fiscal");
    await updateCollaborator(E.admin, ugo, fiscal, "lider", false, "active");
    const { rows } = await db.query<{ actor_collaborator_id: number; action: string; changes: unknown }>(
      "select actor_collaborator_id, action, changes from public.luzia_audit_events where entity = 'luzia_collaborators' and entity_id = $1 and actor_collaborator_id is not null",
      [String(ugo)],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.actor_collaborator_id)).toBe(await collaboratorId(db, E.admin));
    expect(rows[0]?.changes).toEqual({ role: { de: "usuario", para: "lider" } });
  });

  it("mutação que falha não deixa auditoria nem espelho (mesma transação)", async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int n from public.luzia_audit_events")).rows[0]?.n;
    const legacyBefore = (await db.query<{ n: number }>("select count(*)::int n from public.dpto")).rows[0]?.n;
    await expectSqlError(
      asUser(db, E.admin, async (tx) => {
        await tx.query("select public.luzia_admin_save_department(null, 'Temporário')");
        await tx.query("select public.luzia_admin_save_application(null, 'Sem dpto', null, 'https://x.exemplo.test/', '🙂', true, 'selected_departments', '{}')");
      }),
      /precisa de ao menos um departamento/,
    );
    expect((await db.query<{ n: number }>("select count(*)::int n from public.luzia_audit_events")).rows[0]?.n).toBe(before);
    expect((await db.query<{ n: number }>("select count(*)::int n from public.dpto")).rows[0]?.n).toBe(legacyBefore);
  });

  it("auditoria: só admin lê; ninguém altera ou apaga", async () => {
    const fiscal = await departmentId(db, "Fiscal");
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_department($1, 'Fiscal SP')", [fiscal]));
    expect((await asUser(db, E.gerente, (tx) => tx.query("select * from public.luzia_audit_events"))).rows).toHaveLength(0);
    expect((await asUser(db, E.admin, (tx) => tx.query("select * from public.luzia_audit_events"))).rows.length).toBeGreaterThan(0);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.luzia_audit_events set action = 'x'")), /permission denied/);
    await expectSqlError(db.query("update public.luzia_audit_events set action = 'x'"), /somente inserção/);
    await expectSqlError(db.query("delete from public.luzia_audit_events"), /Exclusão não permitida/);
  });
});

describe("última conta administrativa ativa (AC-13)", () => {
  it("admin único não pode se rebaixar nem ser desativado", async () => {
    const ana = await collaboratorId(db, E.admin);
    const contabil = await departmentId(db, "Contábil");
    await expectSqlError(updateCollaborator(E.admin, ana, contabil, "usuario", false, "active"), /última conta administrativa/);
    await expectSqlError(updateCollaborator(E.admin, ana, contabil, "usuario", true, "inactive"), /última conta administrativa/);
  });

  it("com dois admins, um pode sair; o restante fica protegido (inclusive no espelho legado)", async () => {
    const ana = await collaboratorId(db, E.admin);
    const davi = await collaboratorId(db, E.diretor);
    const contabil = await departmentId(db, "Contábil");
    await updateCollaborator(E.admin, davi, contabil, "diretor", true, "active");
    await updateCollaborator(E.diretor, ana, contabil, "usuario", false, "active");
    await expectSqlError(updateCollaborator(E.diretor, davi, contabil, "diretor", false, "active"), /última conta administrativa/);
    expect((await db.query<{ is_admin: boolean }>("select is_admin from public.users where user_id = $1", [ana])).rows[0]?.is_admin).toBe(false);
  });

  it("rebaixar todos os admins numa única instrução é bloqueado", async () => {
    const davi = await collaboratorId(db, E.diretor);
    await updateCollaborator(E.admin, davi, await departmentId(db, "Contábil"), "diretor", true, "active");
    await expectSqlError(db.query("update public.luzia_collaborators set is_admin = false where is_admin"), /última conta administrativa/);
  });
});

describe("cadastros protegidos", () => {
  it("troca de identidade exige motivo e é auditada", async () => {
    const ugo = await collaboratorId(db, E.userFiscal);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_change_identity($1, null, 'novo@exemplo.test', 'curto')", [ugo])), /Informe o motivo/);
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_change_identity($1, null, 'Novo@Exemplo.test', 'Troca de e-mail corporativo após mudança de nome')", [ugo]));
    const { rows } = await db.query<{ email: string; auth_user_id: string | null }>("select email, auth_user_id from public.luzia_collaborators where id = $1", [ugo]);
    expect(rows[0]).toEqual({ email: "novo@exemplo.test", auth_user_id: null });
    expect((await db.query<{ user_email: string }>("select user_email from public.users where user_id = $1", [ugo])).rows[0]?.user_email).toBe("novo@exemplo.test");
    const audit = await db.query<{ reason: string }>("select reason from public.luzia_audit_events where entity_id = $1 and actor_collaborator_id is not null", [String(ugo)]);
    expect(audit.rows[0]?.reason).toMatch(/^troca-identidade: /);
  });

  it("departamento de provisionamento é protegido; departamento inativo não recebe colaboradores", async () => {
    const prov = (await db.query<{ id: number }>("select id from public.luzia_departments where kind = 'provisioning'")).rows[0]!.id;
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_department($1, 'Outro')", [prov])), /protegido/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_set_department_active($1, false)", [prov])), /protegido/);
    const tmp = await asUser(db, E.admin, async (tx) => Number((await tx.query<{ id: number }>("select public.luzia_admin_save_department(null, 'Temporário') id")).rows[0]!.id));
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_set_department_active($1, false)", [tmp]));
    await expectSqlError(updateCollaborator(E.admin, await collaboratorId(db, E.userFiscal), tmp, "usuario", false, "active"), /inválido ou inativo/);
  });

  it("audiência é salva de forma atômica e só com departamentos regulares", async () => {
    const fiscal = await departmentId(db, "Fiscal");
    const trib = await departmentId(db, "Tributário");
    const prov = (await db.query<{ id: number }>("select id from public.luzia_departments where kind = 'provisioning'")).rows[0]!.id;
    const save = (id: string | null, audience: string, depts: number[]) =>
      asUser(db, E.admin, async (tx) =>
        (await tx.query<{ id: string }>("select public.luzia_admin_save_application($1, 'Nova', 'desc', 'https://nova.exemplo.test/', '🙂', true, $2, $3) id", [id, audience, depts])).rows[0]!.id);
    const id = await save(null, "selected_departments", [fiscal, trib]);
    expect((await db.query("select 1 from public.luzia_application_departments where application_id = $1", [id])).rows).toHaveLength(2);
    await save(id, "all_departments", [fiscal]);
    expect((await db.query("select 1 from public.luzia_application_departments where application_id = $1", [id])).rows).toHaveLength(0);
    await expectSqlError(save(null, "selected_departments", [prov]), /Departamento inválido na audiência/);
  });

  it("URL com esquema perigoso ou credenciais é rejeitada pelo banco", async () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "https://user:senha@app.exemplo.test/", "ftp://x.exemplo.test/"]) {
      await expectSqlError(
        asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_application(null, 'X', null, $1, null, true, 'all_departments', null)", [url])),
        /luzia_applications_url_safe_check/,
      );
    }
  });
});
