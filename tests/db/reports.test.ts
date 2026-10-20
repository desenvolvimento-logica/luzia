// AC-05 (agregados), AC-10 e AC-11 — relatórios sobre todo o período, escopo e fuso (simulação PGlite).
import { beforeAll, describe, expect, it } from "vitest";
import { applicationId, asUser, collaboratorId, createTestDb, type Db, departmentId, E, expectSqlError } from "./harness";

let db: Db;
const FROM = "2026-08-01";
const TO = "2026-10-15";

interface Metrics {
  total_opens: number;
  distinct_collaborators: number;
  distinct_applications: number;
  top_applications: { application_id: string; name: string; total: number }[];
  daily: { day: string; total: number }[];
}

function lcg(seed: number) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
}

beforeAll(async () => {
  db = await createTestDb({ phase: "primary" });
  const { rows: people } = await db.query<{ id: number }>("select id from public.luzia_collaborators order by id");
  const { rows: apps } = await db.query<{ id: string }>("select id from public.luzia_applications order by id");
  const rnd = lcg(42);
  const start = Date.parse("2026-07-25T00:00:00Z");
  const span = Date.parse("2026-10-20T00:00:00Z") - start;
  const values: string[] = [];
  for (let i = 0; i < 1500; i++) {
    const c = people[Math.floor(rnd() * people.length)]!.id;
    const a = apps[Math.floor(rnd() * apps.length)]!.id;
    values.push(`(gen_random_uuid(), ${c}, '${a}', '${new Date(start + Math.floor(rnd() * span)).toISOString()}')`);
  }
  // Bordas de dia em America/Sao_Paulo (UTC-3): 02:59:59Z ainda é o dia anterior.
  const ugo = await collaboratorId(db, E.userFiscal);
  const geral = await applicationId(db, "Portal Geral");
  for (const t of ["2026-10-01T02:59:59Z", "2026-10-01T03:00:00Z", "2026-10-16T02:59:59.999Z", "2026-10-16T03:00:00Z"]) {
    values.push(`(gen_random_uuid(), ${ugo}, '${geral}', '${t}')`);
  }
  await db.exec(`insert into public.luzia_access_events (open_id, collaborator_id, application_id, opened_at) values ${values.join(",")}`);
});

const metrics = (email: string, from = FROM, to = TO, app: string | null = null, person: number | null = null, dept: number | null = null) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ m: Metrics }>("select public.luzia_report_access_metrics($1, $2, $3, $4, $5) as m", [from, to, app, person, dept])).rows[0]!.m,
  );

const page = (email: string, limit: number, offset: number, from = FROM, to = TO) =>
  asUser(db, email, async (tx) =>
    (await tx.query<{ event_id: number; total_count: number }>("select * from public.luzia_report_access_page($1, $2, null, null, null, $3, $4)", [from, to, limit, offset])).rows,
  );

async function reference(where: string) {
  const { rows } = await db.query<{ total: number; people: number; apps: number }>(
    `select count(*)::int total, count(distinct e.collaborator_id)::int people, count(distinct e.application_id)::int apps
       from public.luzia_access_events e join public.luzia_collaborators c on c.id = e.collaborator_id
      where e.opened_at >= ('${FROM}'::timestamp at time zone 'America/Sao_Paulo')
        and e.opened_at < (('${TO}'::date + 1)::timestamp at time zone 'America/Sao_Paulo') and ${where}`,
  );
  return rows[0]!;
}

describe("agregados sobre todo o período (AC-10)", () => {
  it("mais de 500 acessos; totais do gerente coincidem com a consulta de referência", async () => {
    const ref = await reference("true");
    expect(ref.total).toBeGreaterThan(500);
    const m = await metrics(E.gerente);
    expect(m.total_opens).toBe(ref.total);
    expect(m.distinct_collaborators).toBe(ref.people);
    expect(m.distinct_applications).toBe(ref.apps);
    expect(m.daily.reduce((s, d) => s + Number(d.total), 0)).toBe(ref.total);
    expect(m.daily).toHaveLength(76);
    expect(m.top_applications.reduce((s, a) => s + Number(a.total), 0)).toBe(ref.total);
  });

  it("líder só agrega usuários do próprio departamento; listagem e totais coincidem", async () => {
    const ref = await reference(`c.role = 'usuario' and c.department_id = ${await departmentId(db, "Fiscal")}`);
    expect((await metrics(E.liderFiscal)).total_opens).toBe(ref.total);
    expect(Number((await page(E.liderFiscal, 25, 0))[0]?.total_count)).toBe(ref.total);
  });

  it("filtros fora do escopo retornam vazio em vez de vazar", async () => {
    expect((await metrics(E.coordTrib, FROM, TO, null, null, await departmentId(db, "Fiscal"))).total_opens).toBe(0);
    expect((await metrics(E.liderFiscal, FROM, TO, null, await collaboratorId(db, E.gerente))).total_opens).toBe(0);
  });
});

describe("ordenação do histórico", () => {
  const sorted = (email: string, sort: string, dir: string, limit = 100) =>
    asUser(db, email, async (tx) =>
      (await tx.query<{ event_id: number; opened_at: Date; collaborator_name: string; application_name: string; total_count: number }>(
        "select * from public.luzia_report_access_page($1, $2, null, null, null, $3, 0, $4, $5)", [FROM, TO, limit, sort, dir],
      )).rows,
    );

  it("ordena por colaborador e aplicação nos dois sentidos, com desempate estável", async () => {
    const asc = (await sorted(E.diretor, "collaborator", "asc")).map((r) => r.collaborator_name.toLowerCase());
    expect(asc).toEqual([...asc].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    const desc = (await sorted(E.diretor, "application", "desc")).map((r) => (r.application_name ?? "").toLowerCase());
    expect(desc).toEqual([...desc].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)));
  });

  it("ordena por data ascendente; o padrão continua data descendente", async () => {
    const asc = (await sorted(E.diretor, "opened_at", "asc")).map((r) => new Date(r.opened_at).getTime());
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const def = await asUser(db, E.diretor, async (tx) =>
      (await tx.query<{ opened_at: Date }>("select * from public.luzia_report_access_page($1, $2, null, null, null, 50, 0)", [FROM, TO])).rows.map((r) => new Date(r.opened_at).getTime()),
    );
    expect(def).toEqual([...def].sort((a, b) => b - a));
  });

  it("ordenação não altera total nem escopo e rejeita valores inválidos", async () => {
    const a = await sorted(E.liderFiscal, "department", "asc", 25);
    const b = await sorted(E.liderFiscal, "opened_at", "desc", 25);
    expect(Number(a[0]?.total_count)).toBe(Number(b[0]?.total_count));
    await expectSqlError(sorted(E.diretor, "user_email", "asc"), /Ordenação inválida/);
    await expectSqlError(sorted(E.diretor, "collaborator", "sideways"), /Ordenação inválida/);
  });
});

describe("paginação, limites e fuso (AC-11)", () => {
  it("percorre todas as páginas sem duplicar nem perder registros", async () => {
    const m = await metrics(E.diretor);
    const seen = new Set<number>();
    for (let offset = 0; offset < m.total_opens; offset += 100) {
      const rows = await page(E.diretor, 100, offset);
      for (const r of rows) seen.add(Number(r.event_id));
      expect(Number(rows[0]?.total_count)).toBe(m.total_opens);
    }
    expect(seen.size).toBe(m.total_opens);
  });

  it("limite de 100 por página e período válido", async () => {
    await expectSqlError(page(E.diretor, 101, 0), /Paginação inválida/);
    await expectSqlError(page(E.diretor, 0, 0), /Paginação inválida/);
    await expectSqlError(page(E.diretor, 25, 0, "2026-10-10", "2026-10-01"), /Período inválido/);
    await expectSqlError(page(E.diretor, 25, 0, "2025-01-01", "2026-10-01"), /Período máximo/);
  });

  it("dia civil em São Paulo: 02:59:59Z pertence ao dia anterior; 03:00Z ao próprio dia", async () => {
    const ugo = await collaboratorId(db, E.userFiscal);
    const count = async (a: string, b: string) =>
      (await db.query<{ n: number }>("select count(*)::int n from public.luzia_access_events where collaborator_id = $1 and opened_at >= $2 and opened_at < $3", [ugo, a, b])).rows[0]!.n;
    expect((await metrics(E.gerente, "2026-10-01", "2026-10-01", null, ugo)).total_opens).toBe(await count("2026-10-01T03:00:00Z", "2026-10-02T03:00:00Z"));
    expect((await metrics(E.gerente, "2026-09-30", "2026-09-30", null, ugo)).total_opens).toBe(await count("2026-09-30T03:00:00Z", "2026-10-01T03:00:00Z"));
    const last = (await metrics(E.gerente, TO, TO, null, ugo)).daily;
    expect(last).toEqual([{ day: "2026-10-15", total: await count("2026-10-15T03:00:00Z", "2026-10-16T03:00:00Z") }]);
  });

  it("usuario comum é negado; nomes de apps que o líder não abre continuam no relatório", async () => {
    await expectSqlError(metrics(E.userFiscal), /Sem acesso a relatórios/);
    await expectSqlError(page(E.userFiscal, 25, 0), /Sem acesso a relatórios/);
    expect((await metrics(E.liderFiscal)).top_applications.every((a) => typeof a.name === "string" && a.name.length > 0)).toBe(true);
  });
});
