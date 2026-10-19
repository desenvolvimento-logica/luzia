// O inventário da Etapa 5 precisa ser só leitura e executável. Storage não existe no shim (consulta 11 pulada).
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { createTestDb } from "./harness";

it("inventário somente leitura executa e não altera o banco", async () => {
  const db = await createTestDb();
  const file = readFileSync(path.resolve(import.meta.dirname, "../../supabase/inventory/inventario-somente-leitura.sql"), "utf8");
  const statements = file
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  expect(statements.every((s) => /^(select|with)\b/i.test(s))).toBe(true);
  const before = await db.query("select (select count(*) from public.users) u, (select count(*) from public.admin_audit) a");
  for (const s of statements) {
    if (s.includes("storage.buckets")) continue;
    await db.query(s);
  }
  const after = await db.query("select (select count(*) from public.users) u, (select count(*) from public.admin_audit) a");
  expect(after.rows).toEqual(before.rows);
});
