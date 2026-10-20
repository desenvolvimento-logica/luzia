// Importação legado → luzia_ (coexistência) e espelho luzia_ → legado (fase primary). Simulação PGlite.
import { describe, expect, it } from "vitest";
import {
  applyMigrations, asUser, collaboratorId, createAuthUser, createTestDb, CUTOVER, type Db, departmentId, E, expectSqlError,
  legacyFingerprint, sql, TENANT, uidOf,
} from "./harness";

const counts = async (db: Db) =>
  (await db.query<{ d: number; c: number; a: number; ad: number; audit: number }>(`select
    (select count(*)::int from public.luzia_departments) d, (select count(*)::int from public.luzia_collaborators) c,
    (select count(*)::int from public.luzia_applications) a, (select count(*)::int from public.luzia_application_departments) ad,
    (select count(*)::int from public.luzia_audit_events) audit`)).rows[0]!;

/** Tabela no estilo do HelpDesk GC: FKs para public.users (restrict) e public.dpto (cascade). */
async function addGcLikeDependents(db: Db) {
  await db.exec(`
    create table public.gestao_cadastros_fixture (
      id bigint generated always as identity primary key,
      user_id bigint not null references public.users (user_id) on delete restrict,
      dpto_id bigint not null references public.dpto (dpto_id) on delete cascade);
    insert into public.gestao_cadastros_fixture (user_id, dpto_id) select user_id, user_dpto from public.users where user_dpto is not null;`);
}

describe("importação do legado (coexistência)", () => {
  it("copia cadastros com os mesmos IDs, normaliza e infere audiência", async () => {
    const db = await createTestDb();
    const legacy = await db.query<{ n: number }>("select count(*)::int n from public.users");
    const c = await counts(db);
    expect(c.c).toBe(legacy.rows[0]!.n);
    const { rows: same } = await db.query<{ n: number }>(
      "select count(*)::int n from public.users u join public.luzia_collaborators c on c.id = u.user_id and c.auth_user_id is not distinct from u.auth_user_id",
    );
    expect(same[0]!.n).toBe(legacy.rows[0]!.n);
    // E-mail com maiúsculas no legado vira minúsculo no luzia.
    expect((await db.query("select 1 from public.luzia_collaborators where email = 'ursula.usuaria@exemplo.test'")).rows).toHaveLength(1);
    // Sem departamento no legado → "Não atribuído" (provisioning).
    const { rows: sd } = await db.query<{ kind: string }>(
      "select d.kind::text from public.luzia_collaborators c join public.luzia_departments d on d.id = c.department_id where c.email = $1", [E.semDpto],
    );
    expect(sd[0]?.kind).toBe("provisioning");
    const { rows: aud } = await db.query<{ name: string; audience: string; active: boolean }>("select name, audience::text, active from public.luzia_applications order by name");
    expect(aud).toEqual([
      { name: "Aplicação Antiga", audience: "all_departments", active: false },
      { name: "Fisco Check", audience: "selected_departments", active: true },
      { name: "Mensagens e-CAC", audience: "selected_departments", active: true },
      { name: "Portal Geral", audience: "all_departments", active: true },
    ]);
    // Novidades e histórico de acessos não são migrados (decisão de 20/10/2026).
    expect((await db.query("select 1 from public.luzia_news")).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.luzia_access_events")).rows).toHaveLength(0);
  });

  it("é idempotente: reimportar não duplica nem gera auditoria nova", async () => {
    const db = await createTestDb();
    const before = await counts(db);
    await db.query("select private.luzia_import_legacy()");
    await db.query("select private.luzia_import_legacy()");
    expect(await counts(db)).toEqual(before);
  });

  it("reimportação traz mudanças feitas no hub antigo e remove vínculos que sumiram", async () => {
    const db = await createTestDb();
    await db.exec(`
      update public.users set user_role = 'lider' where user_email = '${E.userFiscal}';
      update public.dpto set dpto_name = 'Fiscal SP' where dpto_name = 'Fiscal';
      delete from public.applications_dpto where app_id = (select app_id from public.applications where app_name = 'Mensagens e-CAC');
      insert into public.applications_dpto select a.app_id, d.dpto_id from public.applications a, public.dpto d
        where a.app_name = 'Mensagens e-CAC' and d.dpto_name = 'Contábil';`);
    await db.query("select private.luzia_import_legacy()");
    const { rows } = await db.query<{ role: string }>("select role::text from public.luzia_collaborators where email = $1", [E.userFiscal]);
    expect(rows[0]?.role).toBe("lider");
    expect((await db.query("select 1 from public.luzia_departments where name = 'Fiscal SP'")).rows).toHaveLength(1);
    const { rows: links } = await db.query<{ name: string }>(
      `select d.name from public.luzia_application_departments ad join public.luzia_applications a on a.id = ad.application_id
         join public.luzia_departments d on d.id = ad.department_id where a.name = 'Mensagens e-CAC'`,
    );
    expect(links.map((l) => l.name)).toEqual(["Contábil"]);
  });

  it("na coexistência nada é escrito no legado (dados, políticas, gatilhos e grants idênticos)", async () => {
    const db = await createTestDb({ legacyOnly: true });
    const before = await legacyFingerprint(db);
    await applyMigrations(db);
    await db.query("insert into public.luzia_settings (key, value) values ('azure_tenant_id', $1)", [TENANT]);
    await db.query("select private.luzia_import_legacy()");
    await db.query("select private.luzia_import_legacy()");
    // Uso normal do hub novo na coexistência: abrir app registra evento só em luzia_.
    const app = (await db.query<{ id: string }>("select id from public.luzia_applications where name = 'Portal Geral'")).rows[0]!.id;
    await asUser(db, E.userFiscal, (tx) => tx.query("select public.luzia_register_open($1, gen_random_uuid())", [app]));
    expect(await legacyFingerprint(db)).toBe(before);
  });

  it("aborta com e-mails repetidos (ignorando maiúsculas) no legado", async () => {
    const db = await createTestDb({ legacyOnly: true });
    await db.exec(`alter table public.users disable trigger on_app_user_created_link_auth;
      insert into public.users (user_name, user_email, user_role) values ('Duplicada', 'UGO.USUARIO@exemplo.test', 'usuario');`);
    await applyMigrations(db);
    await expectSqlError(db.query("select private.luzia_import_legacy()"), /e-mails repetidos/);
  });

  it("não roda depois do corte (o hub novo passa a ser a fonte)", async () => {
    const db = await createTestDb({ phase: "primary" });
    await expectSqlError(db.query("select private.luzia_import_legacy()"), /só na fase coexistence/);
  });
});

describe("espelho para o legado (fase primary)", () => {
  it("mudanças de cadastro no hub novo chegam a public.users/public.dpto com os mesmos IDs", async () => {
    const db = await createTestDb({ phase: "primary" });
    const ugo = await collaboratorId(db, E.userFiscal);
    const trib = await departmentId(db, "Tributário");
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_update_collaborator($1, $2, 'lider', false, 'active')", [ugo, trib]));
    const { rows } = await db.query<{ user_dpto: number; user_role: string }>("select user_dpto, user_role from public.users where user_id = $1", [ugo]);
    expect(rows[0]).toEqual({ user_dpto: trib, user_role: "lider" });

    const newId = await asUser(db, E.admin, async (tx) => Number((await tx.query<{ id: number }>("select public.luzia_admin_save_department(null, 'Departamento Pessoal') id")).rows[0]!.id));
    const { rows: d } = await db.query<{ dpto_name: string }>("select dpto_name from public.dpto where dpto_id = $1", [newId]);
    expect(d[0]?.dpto_name).toBe("Departamento Pessoal");
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_save_department($1, 'DP')", [newId]));
    expect((await db.query<{ dpto_name: string }>("select dpto_name from public.dpto where dpto_id = $1", [newId])).rows[0]?.dpto_name).toBe("DP");
  });

  it("colaborador novo provisionado no hub ganha linha em public.users com o mesmo id", async () => {
    const db = await createTestDb({ phase: "primary" });
    // Sem o gatilho legado criar a linha (ex.: gatilho removido no futuro): o hub cria e espelha.
    await db.exec("alter table auth.users disable trigger on_auth_user_created");
    await createAuthUser(db, "nova.pessoa@exemplo.test", { name: "Nova Pessoa" });
    const r = await asUser(db, "nova.pessoa@exemplo.test", async (tx) =>
      (await tx.query<{ collaborator_id: number; outcome: string }>("select * from public.luzia_provision_me()")).rows[0]!,
    );
    expect(r.outcome).toBe("provisionado");
    const { rows } = await db.query<{ user_id: number; auth_user_id: string; user_role: string }>(
      "select user_id, auth_user_id, user_role from public.users where user_email = 'nova.pessoa@exemplo.test'",
    );
    expect(rows[0]).toEqual({ user_id: r.collaborator_id, auth_user_id: uidOf("nova.pessoa@exemplo.test"), user_role: "usuario" });
  });

  it("estado inativo, aplicações e novidades não são espelhados; nenhuma linha legada é apagada", async () => {
    const db = await createTestDb({ phase: "primary" });
    await addGcLikeDependents(db);
    const legacyUsers = (await db.query<{ n: number }>("select count(*)::int n from public.users")).rows[0]!.n;
    const gcRows = (await db.query<{ n: number }>("select count(*)::int n from public.gestao_cadastros_fixture")).rows[0]!.n;
    const tom = await collaboratorId(db, E.userTrib);
    const trib = await departmentId(db, "Tributário");
    await asUser(db, E.admin, async (tx) => {
      await tx.query("select public.luzia_admin_update_collaborator($1, $2, 'usuario', false, 'inactive')", [tom, trib]);
      await tx.query("select public.luzia_admin_save_news(null, 'Nova', 'Texto', null, now())");
    });
    // Desativar departamento só sem colaboradores ativos; exclusão física nunca.
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_set_department_active($1, false)", [trib])), /colaboradores ativos/);
    await expectSqlError(db.query("delete from public.luzia_departments where id = $1", [trib]), /Exclusão não permitida/);
    await expectSqlError(db.query("delete from public.luzia_collaborators where id = $1", [tom]), /Exclusão não permitida/);
    expect((await db.query<{ n: number }>("select count(*)::int n from public.users")).rows[0]!.n).toBe(legacyUsers);
    expect((await db.query<{ n: number }>("select count(*)::int n from public.gestao_cadastros_fixture")).rows[0]!.n).toBe(gcRows);
    expect((await db.query("select 1 from public.patch_notes where note_title = 'Nova'")).rows).toHaveLength(0);
  });

  it("cadastro criado no legado depois do corte é adotado no primeiro login, com o mesmo id", async () => {
    const db = await createTestDb({ phase: "primary" });
    // Gatilho legado on_auth_user_created cria public.users (comportamento atual de qualquer login no projeto).
    await createAuthUser(db, "chegou.depois@exemplo.test", { name: "Chegou Depois" });
    const legacyId = (await db.query<{ user_id: number }>("select user_id from public.users where user_email = 'chegou.depois@exemplo.test'")).rows[0]!.user_id;
    const r = await asUser(db, "chegou.depois@exemplo.test", async (tx) => (await tx.query<{ collaborator_id: number; outcome: string }>("select * from public.luzia_provision_me()")).rows[0]!);
    expect(r).toEqual({ collaborator_id: legacyId, access_status: "active", outcome: "adotado" });
    // A adoção em lote só insere quem falta e nunca concede admin.
    await createAuthUser(db, "outro.depois@exemplo.test");
    const n = await asUser(db, E.admin, async (tx) => Number((await tx.query<{ n: number }>("select public.luzia_admin_adopt_legacy_collaborators() n")).rows[0]!.n));
    expect(n).toBe(1);
  });

  it("reverter o corte devolve a fonte ao hub antigo, já atualizado pelo espelho", async () => {
    const db = await createTestDb({ phase: "primary" });
    const ugo = await collaboratorId(db, E.userFiscal);
    const fiscal = await departmentId(db, "Fiscal");
    await asUser(db, E.admin, (tx) => tx.query("select public.luzia_admin_update_collaborator($1, $2, 'coordenador', false, 'active')", [ugo, fiscal]));
    await db.exec(sql("supabase/rollback/20261020110000_luzia_switch_to_primary.down.sql"));
    expect((await db.query<{ value: string }>("select value from public.luzia_settings where key = 'phase'")).rows[0]?.value).toBe("coexistence");
    expect((await db.query<{ user_role: string }>("select user_role from public.users where user_id = $1", [ugo])).rows[0]?.user_role).toBe("coordenador");
    // Corte de novo funciona.
    await db.exec(sql(CUTOVER));
  });

  it("corte exige tenant configurado e admin com identidade vinculada", async () => {
    const db = await createTestDb();
    await db.exec("delete from public.luzia_settings where key = 'azure_tenant_id'");
    await expect(db.exec(sql(CUTOVER))).rejects.toThrow(/tenant corporativo não configurado/);
    await db.exec("rollback"); // como no SQL Editor: a transação do script fica abortada
    expect((await db.query<{ value: string }>("select value from public.luzia_settings where key = 'phase'")).rows[0]?.value).toBe("coexistence");
  });
});
