// AC-03, AC-04, AC-05, AC-06 — RLS das tabelas luzia_ com identidades representativas, sem service role (PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { canOpenApp, canViewInReports, type Collaborator, type DptoKind, isCargo } from "@/lib/auth/matrix";
import { applicationId, asUser, collaboratorId, createTestDb, type Db, E, expectSqlError } from "./harness";

let db: Db;

interface Row { id: number; email: string; department_id: number; role: string; is_admin: boolean; access_status: string }

async function loadCollaborators() {
  const { rows } = await db.query<Row>("select id, email, department_id, role::text, is_admin, access_status::text from public.luzia_collaborators");
  return rows.map((r) => {
    if (!isCargo(r.role)) throw new Error("cargo inválido");
    const c: Collaborator = { userId: Number(r.id), dptoId: Number(r.department_id), role: r.role, isAdmin: r.is_admin, status: r.access_status === "active" ? "ativo" : "desativado" };
    return { email: r.email, c };
  });
}

beforeAll(async () => {
  db = await createTestDb({ phase: "primary" });
});

describe("matriz hierárquica (AC-05)", () => {
  it("cada perfil vê o próprio registro + exatamente o escopo da matriz TypeScript", async () => {
    const all = await loadCollaborators();
    for (const { email, c: me } of all) {
      const visible = await asUser(db, email, async (tx) =>
        (await tx.query<{ id: number }>("select id from public.luzia_collaborators order by id")).rows.map((r) => Number(r.id)),
      );
      const expected = all.filter(({ c }) => c.userId === me.userId || canViewInReports(me, c)).map(({ c }) => c.userId).sort((a, b) => a - b);
      expect(visible, email).toEqual(expected);
    }
  });

  it("escopo de relatório não inclui pares, superiores nem o próprio líder/coordenador", async () => {
    const scope = (email: string) =>
      asUser(db, email, async (tx) => (await tx.query<{ email: string }>("select email from public.luzia_report_scope()")).rows.map((r) => r.email));
    expect((await scope(E.liderFiscal)).sort()).toEqual([E.desativada, E.userFiscal, E.userFiscal2].sort());
    const coord = await scope(E.coordFiscal);
    expect(coord).toContain(E.liderFiscal2);
    for (const e of [E.coordFiscal, E.coordFiscal2, E.gerente, E.userTrib]) expect(coord).not.toContain(e);
  });

  it("usuario comum não acessa relatórios", async () => {
    await expectSqlError(asUser(db, E.userFiscal, (tx) => tx.query("select * from public.luzia_report_scope()")), /Sem acesso a relatórios/);
    expect((await asUser(db, E.userFiscal, (tx) => tx.query("select * from public.luzia_access_events"))).rows).toHaveLength(0);
  });

  it("sessão que não veio do login Microsoft não enxerga nada, mesmo com JWT válido", async () => {
    const r = await asUser(db, E.admin, async (tx) => ({
      collaborators: (await tx.query("select 1 from public.luzia_collaborators")).rows.length,
      apps: (await tx.query("select 1 from public.luzia_applications")).rows.length,
    }), { microsoft: false });
    expect(r).toEqual({ collaborators: 0, apps: 0 });
  });

  it("anon não lê tabelas luzia_", async () => {
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.luzia_collaborators")), /permission denied/);
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.luzia_applications")), /permission denied/);
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.luzia_settings")), /permission denied/);
  });
});

describe("catálogo por departamento (AC-03, AC-04)", () => {
  it("cada colaborador recebe exatamente o catálogo previsto pela matriz", async () => {
    const all = await loadCollaborators();
    const { rows: apps } = await db.query<{ id: string; active: boolean; audience: string; depts: number[] }>(
      `select a.id, a.active, a.audience::text, coalesce(array_agg(d.department_id) filter (where d.department_id is not null), '{}') as depts
         from public.luzia_applications a left join public.luzia_application_departments d on d.application_id = a.id group by a.id`,
    );
    const { rows: depts } = await db.query<{ id: number; kind: string }>("select id, kind::text from public.luzia_departments");
    const kindOf = (id: number | null): DptoKind | null => {
      const k = depts.find((d) => Number(d.id) === id)?.kind;
      return k === "provisioning" ? "provisionamento" : k === "regular" ? "normal" : null;
    };
    for (const { email, c } of all) {
      const ok = await asUser(db, email, async (tx) =>
        (await tx.query<{ id: string; ok: boolean }>("select a.id, public.luzia_can_open(a.id) as ok from public.luzia_applications a")).rows,
      );
      const got = ok.filter((r) => r.ok).map((r) => r.id).sort();
      const expected = apps
        .filter((a) => canOpenApp(c, { appId: 0, active: a.active, audience: a.audience === "all_departments" ? "todos" : "selecionados", dptoIds: a.depts.map(Number) }, kindOf))
        .map((a) => a.id)
        .sort();
      expect(got, email).toEqual(expected);
    }
  });

  it("fiscal não vê nem abre app do tributário; app global aparece para ambos", async () => {
    const names = await asUser(db, E.userFiscal, async (tx) =>
      (await tx.query<{ name: string }>("select name from public.luzia_applications order by name")).rows.map((r) => r.name),
    );
    expect(names).toEqual(["Fisco Check", "Portal Geral"]);
    const msg = await applicationId(db, "Mensagens e-CAC");
    expect((await asUser(db, E.userFiscal, (tx) => tx.query<{ ok: boolean }>("select public.luzia_can_open($1) ok", [msg]))).rows[0]?.ok).toBe(false);
  });

  it("'Não atribuído' não recebe nem as aplicações globais", async () => {
    expect((await asUser(db, E.pendente, (tx) => tx.query("select 1 from public.luzia_applications"))).rows).toHaveLength(0);
  });

  it("aplicação inativa: admin vê na administração, mas ninguém abre", async () => {
    const antiga = await applicationId(db, "Aplicação Antiga");
    const r = await asUser(db, E.admin, async (tx) =>
      (await tx.query<{ n: number; ok: boolean }>("select (select count(*)::int from public.luzia_applications where id = $1) n, public.luzia_can_open($1) ok", [antiga])).rows[0],
    );
    expect(r).toEqual({ n: 1, ok: false });
  });

  it("colaborador inativo não lê dados protegidos; vê só o próprio perfil", async () => {
    const r = await asUser(db, E.desativada, async (tx) => ({
      apps: (await tx.query("select 1 from public.luzia_applications")).rows.length,
      depts: (await tx.query("select 1 from public.luzia_departments")).rows.length,
      news: (await tx.query("select 1 from public.luzia_news")).rows.length,
      me: (await tx.query<{ email: string }>("select email from public.luzia_collaborators")).rows.map((x) => x.email),
      profile: (await tx.query<{ access_status: string }>("select access_status from public.luzia_my_profile()")).rows[0]?.access_status,
    }));
    expect(r).toEqual({ apps: 0, depts: 0, news: 0, me: [E.desativada], profile: "inactive" });
  });
});

describe("escrita somente por RPC administrativa (AC-06)", () => {
  it("nenhum cliente escreve direto nas tabelas, nem admin", async () => {
    for (const stmt of [
      "update public.luzia_collaborators set is_admin = true",
      "insert into public.luzia_departments (id, name) values (999, 'X')",
      "update public.luzia_applications set url = 'https://malicioso.example/'",
      "delete from public.luzia_news",
      "insert into public.luzia_access_events (open_id, collaborator_id, application_id) values (gen_random_uuid(), 1, gen_random_uuid())",
      "truncate public.luzia_access_events",
    ]) {
      await expectSqlError(asUser(db, E.admin, (tx) => tx.query(stmt)), /permission denied/);
    }
  });

  it("usuário comum não se promove; gerente/diretor não administram", async () => {
    const me = await collaboratorId(db, E.userFiscal);
    const fiscal = (await db.query<{ id: number }>("select id from public.luzia_departments where name = 'Fiscal'")).rows[0]!.id;
    for (const email of [E.userFiscal, E.gerente, E.diretor]) {
      await expectSqlError(
        asUser(db, email, (tx) => tx.query("select public.luzia_admin_update_collaborator($1, $2, 'diretor', true, 'active')", [me, fiscal])),
        /Somente administradores/,
      );
      await expectSqlError(
        asUser(db, email, (tx) => tx.query("select public.luzia_admin_save_application(null, 'X', null, 'https://x.exemplo.test/', null, true, 'all_departments', null)")),
        /Somente administradores/,
      );
    }
    const { rows } = await db.query<{ is_admin: boolean; role: string }>("select is_admin, role::text from public.luzia_collaborators where id = $1", [me]);
    expect(rows[0]).toEqual({ is_admin: false, role: "usuario" });
  });

  it("funções privadas e importação não ficam acessíveis a clientes", async () => {
    await expectSqlError(asUser(db, null, (tx) => tx.query("select private.luzia_is_admin()")), /permission denied/);
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.luzia_provision_me()")), /permission denied/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("select private.luzia_import_legacy()")), /permission denied/);
  });
});

describe("coexistência: administração somente leitura no hub novo", () => {
  it("admin não altera cadastros enquanto o hub antigo é a fonte", async () => {
    const co = await createTestDb({ phase: "coexistence" });
    await expectSqlError(asUser(co, E.admin, (tx) => tx.query("select public.luzia_admin_save_department(null, 'Novo')")), /somente leitura durante a coexistência/);
    const geral = await applicationId(co, "Portal Geral");
    expect((await asUser(co, E.userFiscal, (tx) => tx.query<{ ok: boolean }>("select public.luzia_can_open($1) ok", [geral]))).rows[0]?.ok).toBe(true);
  });
});
