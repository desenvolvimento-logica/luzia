// AC-04, AC-09, AC-13 e proteções de cadastro (simulação PGlite).
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, createTestDb, type Db, E, expectSqlError, idOf } from "./harness";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
});

const registerOpen = (email: string, appId: number, openId: string) =>
  asUser(db, email, async (tx) => Number((await tx.query<{ id: number }>("select public.luzia_register_open($1, $2) as id", [appId, openId])).rows[0]?.id));

describe("registro idempotente de abertura (AC-09)", () => {
  it("repetir a mesma abertura não duplica; nova abertura intencional gera novo evento", async () => {
    const app = await idOf(db, "applications", "Fisco Check");
    const first = randomUUID();
    const a = await registerOpen(E.userFiscal, app, first);
    const b = await registerOpen(E.userFiscal, app, first);
    const c = await registerOpen(E.userFiscal, app, randomUUID());
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.access_log where app_id = $1", [app]);
    expect(rows[0]?.n).toBe(2);
  });

  it("identificador de abertura de outro colaborador é rejeitado", async () => {
    const app = await idOf(db, "applications", "Fisco Check");
    const id = randomUUID();
    await registerOpen(E.userFiscal, app, id);
    await expectSqlError(registerOpen(E.userFiscal2, app, id), /Identificador de abertura inválido/);
  });

  it("negações não geram registro (AC-04)", async () => {
    const antiga = await idOf(db, "applications", "Aplicação Antiga");
    const msg = await idOf(db, "applications", "Mensagens e-CAC");
    const geral = await idOf(db, "applications", "Portal Geral");
    await expectSqlError(registerOpen(E.admin, antiga, randomUUID()), /não autorizada/);
    await expectSqlError(registerOpen(E.userFiscal, msg, randomUUID()), /não autorizada/);
    await expectSqlError(registerOpen(E.desativada, geral, randomUUID()), /sem acesso ativo/);
    await expectSqlError(registerOpen(E.pendente, geral, randomUUID()), /não autorizada/);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.access_log");
    expect(rows[0]?.n).toBe(0);
  });
});

describe("auditoria atômica (AC-13)", () => {
  it("alteração administrativa registra ator, entidade e de/para", async () => {
    const target = await idOf(db, "users", E.userFiscal);
    const adminId = await idOf(db, "users", E.admin);
    await asUser(db, E.admin, (tx) => tx.query("update public.users set user_role = 'lider' where user_id = $1", [target]));
    const { rows } = await db.query<{ actor_user_id: number; action: string; changes: Record<string, { de: unknown; para: unknown }> }>(
      "select actor_user_id, action, changes from public.admin_audit where entity = 'users' and entity_id = $1 and actor_user_id is not null", [String(target)],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.actor_user_id)).toBe(adminId);
    expect(rows[0]?.action).toBe("update");
    expect(rows[0]?.changes).toEqual({ user_role: { de: "usuario", para: "lider" } });
  });

  it("mutação que falha não deixa auditoria (mesma transação)", async () => {
    const before = (await db.query<{ n: number }>("select count(*)::int n from public.admin_audit")).rows[0]?.n;
    await expectSqlError(
      asUser(db, E.admin, (tx) => tx.query("select public.admin_save_application(null, 'Sem dpto', null, 'https://x.exemplo.test/', '🙂', true, 'selecionados', '{}')")),
      /precisa de ao menos um departamento/,
    );
    const after = (await db.query<{ n: number }>("select count(*)::int n from public.admin_audit")).rows[0]?.n;
    expect(after).toBe(before);
    expect((await db.query("select 1 from public.applications where app_name = 'Sem dpto'")).rows).toHaveLength(0);
  });

  it("cliente comum não lê; admin não altera nem apaga auditoria", async () => {
    await asUser(db, E.admin, (tx) => tx.query("update public.dpto set dpto_name = 'Fiscal SP' where dpto_name = 'Fiscal'"));
    const visible = await asUser(db, E.gerente, (tx) => tx.query("select * from public.admin_audit"));
    expect(visible.rows).toHaveLength(0);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.admin_audit set action = 'x'")), /permission denied/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.admin_audit")), /permission denied/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("insert into public.admin_audit (action, entity, entity_id) values ('x','y','z')")), /permission denied/);
    const own = await asUser(db, E.admin, (tx) => tx.query("select * from public.admin_audit where entity = 'dpto'"));
    expect(own.rows.length).toBeGreaterThan(0);
  });
});

describe("última conta administrativa ativa (AC-13)", () => {
  it("admin único não pode se rebaixar, ser desativado ou excluído", async () => {
    const id = await idOf(db, "users", E.admin);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.users set is_admin = false where user_id = $1", [id])), /última conta administrativa/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.users set access_status = 'desativado' where user_id = $1", [id])), /última conta administrativa/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.users where user_id = $1", [id])), /última conta administrativa/);
  });

  it("com dois admins, um pode sair; o restante fica protegido", async () => {
    const ana = await idOf(db, "users", E.admin);
    const davi = await idOf(db, "users", E.diretor);
    await asUser(db, E.admin, (tx) => tx.query("update public.users set is_admin = true where user_id = $1", [davi]));
    await asUser(db, E.diretor, (tx) => tx.query("update public.users set is_admin = false where user_id = $1", [ana]));
    await expectSqlError(asUser(db, E.diretor, (tx) => tx.query("update public.users set is_admin = false where user_id = $1", [davi])), /última conta administrativa/);
  });

  it("rebaixar os dois admins na mesma instrução é bloqueado", async () => {
    const davi = await idOf(db, "users", E.diretor);
    await asUser(db, E.admin, (tx) => tx.query("update public.users set is_admin = true where user_id = $1", [davi]));
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.users set is_admin = false where is_admin")), /última conta administrativa/);
    const { rows } = await db.query<{ n: number }>("select count(*)::int n from public.users where is_admin");
    expect(rows[0]?.n).toBe(2);
  });
});

describe("identidade e cadastros protegidos", () => {
  it("identidade/e-mail vinculados não mudam por UPDATE comum; só pelo procedimento com motivo", async () => {
    const id = await idOf(db, "users", E.userFiscal);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.users set user_email = 'outro@exemplo.test' where user_id = $1", [id])), /não pode ser alterado/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.users set auth_user_id = null where user_id = $1", [id])), /não pode ser alterada/);
    await expectSqlError(
      asUser(db, E.admin, (tx) => tx.query("select public.admin_change_identity($1, null, 'novo@exemplo.test', 'curto')", [id])),
      /Informe o motivo/,
    );
    await asUser(db, E.admin, (tx) => tx.query("select public.admin_change_identity($1, null, 'Novo@Exemplo.test', 'Troca de e-mail corporativo após mudança de nome')", [id]));
    const { rows } = await db.query<{ user_email: string; auth_user_id: string | null }>("select user_email, auth_user_id from public.users where user_id = $1", [id]);
    expect(rows[0]).toEqual({ user_email: "novo@exemplo.test", auth_user_id: null });
    const audit = await db.query<{ reason: string }>("select reason from public.admin_audit where entity = 'users' and entity_id = $1 and action = 'update' and actor_user_id is not null", [String(id)]);
    expect(audit.rows[0]?.reason).toMatch(/^troca-identidade: /);
    await expectSqlError(asUser(db, E.gerente, (tx) => tx.query("select public.admin_change_identity($1, null, 'x@exemplo.test', 'motivo suficientemente longo')", [id])), /Somente administradores/);
  });

  it("departamento de provisionamento é protegido; departamento em uso não é excluído", async () => {
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("update public.dpto set dpto_name = 'Outro' where dpto_kind = 'provisionamento'")), /protegido/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.dpto where dpto_kind = 'provisionamento'")), /protegido/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.dpto where dpto_name = 'Fiscal'")), /colaboradores ou aplicações/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("insert into public.dpto (dpto_name, dpto_kind) values ('Falso', 'provisionamento')")), /row-level security/);
    await asUser(db, E.admin, (tx) => tx.query("insert into public.dpto (dpto_name) values ('Temporário')"));
    const del = await asUser(db, E.admin, (tx) => tx.query("delete from public.dpto where dpto_name = 'Temporário'"));
    expect(del.affectedRows).toBe(1);
  });

  it("aplicação com histórico não é excluída; audiência é salva de forma atômica", async () => {
    const app = await idOf(db, "applications", "Portal Geral");
    await registerOpen(E.userFiscal, app, randomUUID());
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.applications where app_id = $1", [app])), /desative em vez de excluir/);

    const fiscal = await idOf(db, "dpto", "Fiscal");
    const trib = await idOf(db, "dpto", "Tributário");
    const id = await asUser(db, E.admin, async (tx) =>
      Number((await tx.query<{ id: number }>("select public.admin_save_application(null, 'Nova', 'desc', 'https://nova.exemplo.test/', '🙂', true, 'selecionados', $1) as id", [[fiscal, trib]])).rows[0]?.id),
    );
    let links = await db.query("select dpto_id from public.applications_dpto where app_id = $1", [id]);
    expect(links.rows).toHaveLength(2);
    await asUser(db, E.admin, (tx) => tx.query("select public.admin_save_application($1, 'Nova', 'desc', 'https://nova.exemplo.test/', '🙂', true, 'todos', $2)", [id, [fiscal]]));
    links = await db.query("select dpto_id from public.applications_dpto where app_id = $1", [id]);
    expect(links.rows).toHaveLength(0);
    // Remover o único departamento de uma app "selecionados" falha no commit.
    const fisco = await idOf(db, "applications", "Fisco Check");
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.applications_dpto where app_id = $1", [fisco])), /ao menos um departamento/);
  });

  it("URL com esquema perigoso ou credenciais é rejeitada pelo banco", async () => {
    for (const url of ["javascript:alert(1)", "data:text/html,x", "https://user:senha@app.exemplo.test/", "ftp://x.exemplo.test/"]) {
      await expectSqlError(
        asUser(db, E.admin, (tx) => tx.query("update public.applications set app_url = $1 where app_name = 'Portal Geral'", [url])),
        /applications_app_url_safe_check/,
      );
    }
  });
});
