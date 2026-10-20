// O inventário da Etapa 5 é uma única consulta somente leitura que devolve uma célula JSON.
import { describe, expect, it } from "vitest";
import { applyMigrations, createTestDb, sql } from "./harness";

const INVENTORY = "supabase/inventory/inventario-somente-leitura.sql";

async function legacyDb() {
  const db = await createTestDb({ legacyOnly: true });
  // O Storage existe no Supabase real; no PGlite, um stub mínimo para a consulta do bucket.
  await db.exec("create schema storage; create table storage.buckets (id text primary key, name text, public boolean); insert into storage.buckets values ('app-icons', 'app-icons', true);");
  return db;
}

describe("inventário somente leitura", () => {
  it("é um único SELECT e devolve uma célula JSON com as seções esperadas", async () => {
    const db = await legacyDb();
    const text = sql(INVENTORY).replace(/^\s*--.*$/gm, "").trim();
    expect(text.replace(/;\s*$/, "").includes(";")).toBe(false);
    expect(/^with\b/i.test(text)).toBe(true);
    expect(/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate)\b/i.test(text.replace(/'[^']*'/g, ""))).toBe(false);

    const before = await db.query("select (select count(*) from public.users) u, (select count(*) from public.dpto) d");
    const { rows } = await db.query<{ inventario: string }>(sql(INVENTORY));
    expect(rows).toHaveLength(1);
    const inv = JSON.parse(rows[0]!.inventario);
    for (const key of [
      "colunas_hub", "restricoes_hub", "indices_hub", "rls_hub", "politicas", "grants_hub", "funcoes_public_hub", "funcoes_private",
      "gatilhos", "identidades", "contagens", "origens_app_url", "bucket_app_icons", "fks_de_outros_sistemas",
      "objetos_luzia_existentes", "schema_private",
    ]) {
      expect(inv, key).toHaveProperty(key);
    }
    expect(inv.contagens.users).toBe(14);
    expect(inv.contagens.users_email_maiusculo).toBe(1);
    expect(inv.objetos_luzia_existentes).toEqual([]);
    expect(inv.schema_private.authenticated_usage).toBe(true);
    expect(inv.identidades.chaves_custom_claims_azure).toEqual(["tid"]);
    expect(inv.gatilhos.map((g: { gatilho: string }) => g.gatilho)).toEqual(expect.arrayContaining(["on_auth_user_created"]));
    expect(inv.colunas_hub.users.map((c: { coluna: string }) => c.coluna)).toContain("user_create");
    expect(inv.colunas_hub.users.find((c: { coluna: string }) => c.coluna === "user_id").identity).toBe("ALWAYS");
    // Nenhum e-mail ou nome aparece no resultado.
    expect(rows[0]!.inventario).not.toMatch(/@exemplo\.test|Ana Administradora/);
    expect((await db.query("select (select count(*) from public.users) u, (select count(*) from public.dpto) d")).rows).toEqual(before.rows);
  });

  it("depois da fundação, lista os objetos luzia_ existentes (colisão detectável)", async () => {
    const db = await legacyDb();
    await applyMigrations(db);
    const inv = JSON.parse((await db.query<{ inventario: string }>(sql(INVENTORY))).rows[0]!.inventario);
    expect(inv.objetos_luzia_existentes).toEqual(expect.arrayContaining(["relacao:public.luzia_collaborators", "funcao:private.luzia_me"]));
  });
});
