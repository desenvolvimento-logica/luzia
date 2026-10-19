// AC-03, AC-04, AC-05, AC-06 — RLS com identidades representativas, sem service role (simulação PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { canOpenApp, canViewInReports, type Collaborator, type DptoKind, isCargo } from "@/lib/auth/matrix";
import { asUser, createTestDb, type Db, E, expectSqlError, idOf } from "./harness";

let db: Db;

interface UserRow { user_id: number; user_email: string; user_dpto: number; user_role: string; is_admin: boolean; access_status: string }

async function loadCollaborators() {
  const { rows } = await db.query<UserRow>("select user_id, user_email, user_dpto, user_role, is_admin, access_status from public.users");
  return rows.map((r) => {
    if (!isCargo(r.user_role)) throw new Error("cargo inválido");
    const c: Collaborator = {
      userId: Number(r.user_id), dptoId: Number(r.user_dpto), role: r.user_role,
      isAdmin: r.is_admin, status: r.access_status === "ativo" ? "ativo" : "desativado",
    };
    return { email: r.user_email, c };
  });
}

beforeAll(async () => {
  db = await createTestDb();
});

describe("matriz hierárquica (AC-05)", () => {
  it("users: cada perfil vê o próprio registro + exatamente o escopo da matriz TypeScript", async () => {
    const all = await loadCollaborators();
    for (const { email, c: me } of all) {
      const visible = await asUser(db, email, async (tx) =>
        (await tx.query<{ user_id: number }>("select user_id from public.users order by user_id")).rows.map((r) => Number(r.user_id)),
      );
      const expected = all
        .filter(({ c }) => c.userId === me.userId || canViewInReports(me, c))
        .map(({ c }) => c.userId)
        .sort((a, b) => a - b);
      expect(visible, email).toEqual(expected);
    }
  });

  it("report_scope_users não inclui pares, superiores nem o próprio líder/coordenador", async () => {
    const lider = await asUser(db, E.liderFiscal, async (tx) =>
      (await tx.query<{ user_email: string }>("select user_email from public.report_scope_users()")).rows.map((r) => r.user_email),
    );
    expect(lider.sort()).toEqual([E.desativada, E.userFiscal, E.userFiscal2].sort());

    const coord = await asUser(db, E.coordFiscal, async (tx) =>
      (await tx.query<{ user_email: string }>("select user_email from public.report_scope_users()")).rows.map((r) => r.user_email),
    );
    expect(coord).not.toContain(E.coordFiscal);
    expect(coord).not.toContain(E.coordFiscal2);
    expect(coord).not.toContain(E.gerente);
    expect(coord).toContain(E.liderFiscal2);
    expect(coord).not.toContain(E.userTrib);
  });

  it("usuario comum não acessa relatórios", async () => {
    await expectSqlError(asUser(db, E.userFiscal, (tx) => tx.query("select * from public.report_scope_users()")), /Sem acesso a relatórios/);
    const logs = await asUser(db, E.userFiscal, (tx) => tx.query("select * from public.access_log"));
    expect(logs.rows).toHaveLength(0);
  });

  it("anon não lê tabelas do hub", async () => {
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.users")), /permission denied/);
    await expectSqlError(asUser(db, null, (tx) => tx.query("select * from public.applications")), /permission denied/);
  });
});

describe("catálogo por departamento (AC-03, AC-04)", () => {
  it("cada colaborador recebe exatamente o catálogo previsto pela matriz", async () => {
    const all = await loadCollaborators();
    const { rows: apps } = await db.query<{ app_id: number; app_status: boolean; audience: "todos" | "selecionados"; dptos: number[] }>(
      `select a.app_id, a.app_status, a.audience, coalesce(array_agg(d.dpto_id) filter (where d.dpto_id is not null), '{}') as dptos
         from public.applications a left join public.applications_dpto d using (app_id) group by a.app_id`,
    );
    const { rows: dptos } = await db.query<{ dpto_id: number; dpto_kind: DptoKind }>("select dpto_id, dpto_kind from public.dpto");
    const kindOf = (id: number | null) => dptos.find((d) => Number(d.dpto_id) === id)?.dpto_kind ?? null;

    for (const { email, c } of all) {
      const opened = await asUser(db, email, async (tx) =>
        (await tx.query<{ app_id: number; ok: boolean }>("select a.app_id, public.luzia_can_open(a.app_id) as ok from public.applications a order by app_id")).rows,
      );
      const canOpen = opened.filter((r) => r.ok).map((r) => Number(r.app_id));
      const expected = apps
        .filter((a) => canOpenApp(c, { appId: Number(a.app_id), active: a.app_status, audience: a.audience, dptoIds: a.dptos.map(Number) }, kindOf))
        .map((a) => Number(a.app_id))
        .sort((x, y) => x - y);
      expect(canOpen, email).toEqual(expected);
    }
  });

  it("fiscal não vê nem abre app do tributário; app global aparece para ambos", async () => {
    const msg = await idOf(db, "applications", "Mensagens e-CAC");
    const names = await asUser(db, E.userFiscal, async (tx) =>
      (await tx.query<{ app_name: string }>("select app_name from public.applications order by app_name")).rows.map((r) => r.app_name),
    );
    expect(names).toEqual(["Fisco Check", "Portal Geral"]);
    const ok = await asUser(db, E.userFiscal, async (tx) => (await tx.query<{ ok: boolean }>("select public.luzia_can_open($1) as ok", [msg])).rows[0]?.ok);
    expect(ok).toBe(false);
  });

  it("'Não atribuído' não recebe nem as aplicações globais", async () => {
    const names = await asUser(db, E.pendente, async (tx) => (await tx.query("select app_name from public.applications")).rows);
    expect(names).toHaveLength(0);
  });

  it("aplicação inativa: admin vê na administração, mas ninguém abre", async () => {
    const antiga = await idOf(db, "applications", "Aplicação Antiga");
    const res = await asUser(db, E.admin, async (tx) =>
      (await tx.query<{ n: number; ok: boolean }>("select (select count(*)::int from public.applications where app_id = $1) as n, public.luzia_can_open($1) as ok", [antiga])).rows[0],
    );
    expect(res).toEqual({ n: 1, ok: false });
  });

  it("colaborador desativado não lê dados protegidos nem abre aplicações", async () => {
    const r = await asUser(db, E.desativada, async (tx) => ({
      apps: (await tx.query("select 1 from public.applications")).rows.length,
      dptos: (await tx.query("select 1 from public.dpto")).rows.length,
      notes: (await tx.query("select 1 from public.patch_notes")).rows.length,
      users: (await tx.query<{ user_email: string }>("select user_email from public.users")).rows.map((x) => x.user_email),
    }));
    expect(r).toEqual({ apps: 0, dptos: 0, notes: 0, users: [E.desativada] });
  });

  it("desativar um gestor corta o escopo dele imediatamente, mesmo com JWT válido", async () => {
    await db.exec(`update public.users set access_status = 'desativado' where user_email = '${E.liderTrib}'`);
    try {
      await expectSqlError(asUser(db, E.liderTrib, (tx) => tx.query("select * from public.report_scope_users()")), /Sem acesso/);
    } finally {
      await db.exec(`update public.users set access_status = 'ativo' where user_email = '${E.liderTrib}'`);
    }
  });
});

describe("administração restrita (AC-06)", () => {
  it("usuário comum não promove a si mesmo nem altera cargo", async () => {
    const res = await asUser(db, E.userFiscal, async (tx) => {
      const r1 = await tx.query(`update public.users set is_admin = true where user_email = '${E.userFiscal}'`);
      const r2 = await tx.query(`update public.users set user_role = 'diretor' where user_email = '${E.userFiscal}'`);
      return [r1.affectedRows, r2.affectedRows];
    });
    expect(res).toEqual([0, 0]);
    const { rows } = await db.query<{ is_admin: boolean; user_role: string }>("select is_admin, user_role from public.users where user_email = $1", [E.userFiscal]);
    expect(rows[0]).toEqual({ is_admin: false, user_role: "usuario" });
  });

  it("gerente/diretor não modificam cadastros, aplicações ou URL", async () => {
    for (const email of [E.gerente, E.diretor, E.coordFiscal]) {
      const affected = await asUser(db, email, async (tx) => {
        const a = await tx.query("update public.applications set app_url = 'https://malicioso.example/'");
        const b = await tx.query("update public.dpto set dpto_name = dpto_name || 'x'");
        const c = await tx.query("delete from public.patch_notes");
        return [a.affectedRows, b.affectedRows, c.affectedRows];
      });
      expect(affected, email).toEqual([0, 0, 0]);
      await expectSqlError(asUser(db, email, (tx) => tx.query("insert into public.dpto (dpto_name) values ('Invasor')")), /row-level security/);
      await expectSqlError(
        asUser(db, email, (tx) => tx.query("select public.admin_save_application(null, 'X', null, 'https://x.exemplo.test/', null, true, 'todos', null)")),
        /Somente administradores/,
      );
    }
  });

  it("cliente não registra acesso em nome de outro nem trunca tabelas", async () => {
    const other = await idOf(db, "users", E.userFiscal2);
    const app = await idOf(db, "applications", "Portal Geral");
    await expectSqlError(asUser(db, E.userFiscal, (tx) => tx.query("insert into public.access_log (user_id, app_id) values ($1, $2)", [other, app])), /row-level security/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("truncate public.access_log")), /permission denied/);
    await expectSqlError(asUser(db, E.admin, (tx) => tx.query("delete from public.access_log")), /permission denied/);
  });

  it("inserção direta (hub antigo) exige aplicação autorizada", async () => {
    const me = await idOf(db, "users", E.userFiscal);
    const msg = await idOf(db, "applications", "Mensagens e-CAC");
    await expectSqlError(asUser(db, E.userFiscal, (tx) => tx.query("insert into public.access_log (user_id, app_id) values ($1, $2)", [me, msg])), /row-level security/);
  });

  it("funções privadas não ficam acessíveis a anon", async () => {
    await expectSqlError(asUser(db, null, (tx) => tx.query("select private.is_admin()")), /permission denied/);
    await expectSqlError(asUser(db, null, (tx) => tx.query("select public.luzia_provision_me()")), /permission denied/);
  });
});
