import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

describe("migração aplica sobre o legado hipotético", () => {
  it("cria banco com seed", async () => {
    const db = await createTestDb();
    const { rows } = await db.query<{ n: number }>("select count(*)::int as n from public.users");
    expect(rows[0]?.n).toBe(14);
  });
});
