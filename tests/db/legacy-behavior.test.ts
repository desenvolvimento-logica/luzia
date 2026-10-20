// Comportamento do hub ANTIGO reproduzido com as políticas reais do inventário de 20/10/2026 (simulação PGlite).
// Serve para documentar diferenças que os colaboradores vão perceber no corte; não testa o hub novo.
import { describe, expect, it } from "vitest";
import { asUser, createTestDb, E } from "./harness";

describe("legado: catálogo com as políticas reais", () => {
  it("não-admin vê todas as aplicações ativas, inclusive as restritas a outro departamento", async () => {
    const db = await createTestDb({ legacyOnly: true });
    const names = await asUser(db, E.userFiscal, async (tx) =>
      (await tx.query<{ app_name: string }>("select app_name from public.applications order by app_name")).rows.map((r) => r.app_name),
    );
    // "Mensagens e-CAC" é só do Tributário em applications_dpto, mas a política applications_select_scoped consulta
    // applications_dpto sob o RLS do próprio usuário (applications_dpto_select_admin: só admin lê) e o NOT EXISTS
    // vira sempre verdadeiro para não-admins.
    expect(names).toEqual(["Fisco Check", "Mensagens e-CAC", "Portal Geral"]);
    const links = await asUser(db, E.userFiscal, (tx) => tx.query("select * from public.applications_dpto"));
    expect(links.rows).toHaveLength(0);
  });

  it("no hub novo, o mesmo colaborador vê só o catálogo do próprio departamento", async () => {
    const db = await createTestDb();
    const names = await asUser(db, E.userFiscal, async (tx) =>
      (await tx.query<{ name: string }>("select name from public.luzia_applications order by name")).rows.map((r) => r.name),
    );
    expect(names).toEqual(["Fisco Check", "Portal Geral"]);
  });

  it("não-admin do legado não lê nomes de departamentos (só o admin)", async () => {
    const db = await createTestDb({ legacyOnly: true });
    expect((await asUser(db, E.userFiscal, (tx) => tx.query("select * from public.dpto"))).rows).toHaveLength(0);
  });
});
