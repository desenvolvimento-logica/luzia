// AC-05 (agregados), AC-10 e AC-11 — relatórios sobre todo o período, escopo e fuso (simulação PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb, type Db, E, expectSqlError, idOf } from "./harness";

let db: Db;
const FROM = "2026-08-01";
const TO = "2026-10-15";

interface Metrics { total_opens: number; distinct_users: number; top_apps: { app_id: number; app_name: string; total: number }[]; daily: { day: string; total: number }[] }

function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

beforeAll(async () => {
  db = await createTestDb();
  const { rows: users } = await db.query<{ user_id: number }>("select user_id from public.users order by user_id");
  const { rows: apps } = await db.query<{ app_id: number }>("select app_id from public.applications order by app_id");
  const rnd = lcg(42);
  const start = Date.parse("2026-07-25T00:00:00Z");
  const span = Date.parse("2026-10-20T00:00:00Z") - start;
  const values: string[] = [];
  for (let i = 0; i < 1500; i++) {
    const u = users[Math.floor(rnd() * users.length)]!.user_id;
    const a = apps[Math.floor(rnd() * apps.length)]!.app_id;
    const t = new Date(start + Math.floor(rnd() * span)).toISOString();
    values.push(`(${u}, ${a}, '${t}')`);
  }
  // Bordas de dia em America/Sao_Paulo (UTC-3): 02:59:59Z ainda é o dia anterior.
  const ugo = await idOf(db, "users", E.userFiscal);
  const geral = await idOf(db, "applications", "Portal Geral");
  values.push(`(${ugo}, ${geral}, '2026-10-01T02:59:59Z')`, `(${ugo}, ${geral}, '2026-10-01T03:00:00Z')`, `(${ugo}, ${geral}, '2026-10-16T02:59:59.999Z')`, `(${ugo}, ${geral}, '2026-10-16T03:00:00Z')`);
  await db.exec(`insert into public.access_log (user_id, app_id, datetime) values ${values.join(",")}`);
});

const metrics = (email: string, from = FROM, to = TO, app: number | null = null, user: number | null = null, dpto: number | null = null) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ m: Metrics }>("select public.report_access_metrics($1, $2, $3, $4, $5) as m", [from, to, app, user, dpto])).rows[0]!.m,
  );

const page = (email: string, limit: number, offset: number, from = FROM, to = TO, dpto: number | null = null) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ log_id: number; total_count: number; opened_at: Date }>(
      "select * from public.report_access_page($1, $2, null, null, $5, $3, $4)", [from, to, limit, offset, dpto],
    )).rows,
  );

async function reference(where: string): Promise<{ total: number; users: number }> {
  const { rows } = await db.query<{ total: number; users: number }>(
    `select count(*)::int total, count(distinct l.user_id)::int users
       from public.access_log l join public.users u using (user_id)
      where l.datetime >= ('${FROM}'::timestamp at time zone 'America/Sao_Paulo')
        and l.datetime < (('${TO}'::date + 1)::timestamp at time zone 'America/Sao_Paulo') and ${where}`,
  );
  return rows[0]!;
}

describe("agregados sobre todo o período (AC-10)", () => {
  it("há mais de 500 acessos e os totais do gerente coincidem com a consulta de referência", async () => {
    const ref = await reference("true");
    expect(ref.total).toBeGreaterThan(500);
    const m = await metrics(E.gerente);
    expect(m.total_opens).toBe(ref.total);
    expect(m.distinct_users).toBe(ref.users);
    expect(m.daily.reduce((s, d) => s + Number(d.total), 0)).toBe(ref.total);
    expect(m.daily).toHaveLength(76);
    expect(m.top_apps.reduce((s, a) => s + Number(a.total), 0)).toBe(ref.total);
  });

  it("líder só agrega usuários do próprio departamento; listagem e totais coincidem", async () => {
    const ref = await reference("u.user_role = 'usuario' and u.user_dpto = (select dpto_id from public.dpto where dpto_name = 'Fiscal')");
    const m = await metrics(E.liderFiscal);
    expect(m.total_opens).toBe(ref.total);
    const rows = await page(E.liderFiscal, 25, 0);
    expect(Number(rows[0]?.total_count)).toBe(ref.total);
  });

  it("coordenador do tributário não vê dados do fiscal", async () => {
    const fiscal = await idOf(db, "dpto", "Fiscal");
    const m = await metrics(E.coordTrib, FROM, TO, null, null, fiscal);
    expect(m.total_opens).toBe(0);
  });

  it("filtros de colaborador fora do escopo retornam vazio em vez de vazar", async () => {
    const gina = await idOf(db, "users", E.gerente);
    const m = await metrics(E.liderFiscal, FROM, TO, null, gina);
    expect(m.total_opens).toBe(0);
  });
});

describe("paginação, limites e fuso (AC-11)", () => {
  it("percorre todas as páginas sem duplicar nem perder registros", async () => {
    const m = await metrics(E.diretor);
    const seen = new Set<number>();
    for (let offset = 0; offset < m.total_opens; offset += 100) {
      const rows = await page(E.diretor, 100, offset);
      for (const r of rows) seen.add(Number(r.log_id));
      expect(Number(rows[0]?.total_count)).toBe(m.total_opens);
    }
    expect(seen.size).toBe(m.total_opens);
  });

  it("limite máximo de 100 por página e período válido", async () => {
    await expectSqlError(page(E.diretor, 101, 0), /Paginação inválida/);
    await expectSqlError(page(E.diretor, 0, 0), /Paginação inválida/);
    await expectSqlError(page(E.diretor, 25, 0, "2026-10-10", "2026-10-01"), /Período inválido/);
    await expectSqlError(page(E.diretor, 25, 0, "2025-01-01", "2026-10-01"), /Período máximo/);
  });

  it("dia civil em São Paulo: 02:59:59Z pertence ao dia anterior; 03:00Z ao próprio dia", async () => {
    const ugo = await idOf(db, "users", E.userFiscal);
    const day = (d: string) => metrics(E.gerente, d, d, null, ugo);
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int n from public.access_log where user_id = $1 and datetime >= '2026-10-01T03:00:00Z' and datetime < '2026-10-02T03:00:00Z'`, [ugo],
    );
    const oct1 = await day("2026-10-01");
    expect(oct1.total_opens).toBe(rows[0]!.n);
    const { rows: sep } = await db.query<{ n: number }>(
      `select count(*)::int n from public.access_log where user_id = $1 and datetime >= '2026-09-30T03:00:00Z' and datetime < '2026-10-01T03:00:00Z'`, [ugo],
    );
    expect((await day("2026-09-30")).total_opens).toBe(sep[0]!.n);
    // O acesso de 16/10 02:59:59.999Z (15/10 em SP) entra no período que termina em 15/10; o de 03:00Z não.
    const last = (await metrics(E.gerente, TO, TO, null, ugo)).daily;
    expect(last).toHaveLength(1);
    expect(last[0]?.day).toBe("2026-10-15");
  });

  it("usuario comum é negado nos agregados e na listagem", async () => {
    await expectSqlError(metrics(E.userFiscal), /Sem acesso a relatórios/);
    await expectSqlError(page(E.userFiscal, 25, 0), /Sem acesso a relatórios/);
  });

  it("aplicação que o líder não abre continua nomeada no relatório", async () => {
    const m = await metrics(E.liderFiscal);
    expect(m.top_apps.every((a) => typeof a.app_name === "string" && a.app_name.length > 0)).toBe(true);
  });
});
