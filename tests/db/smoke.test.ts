import { describe, expect, it } from "vitest";
import { createTestDb } from "./harness";

describe("fundação luzia_ sobre o legado hipotético", () => {
  it("aplica, importa e passa pelo corte", async () => {
    const db = await createTestDb({ phase: "primary" });
    const { rows } = await db.query<{ n: number; phase: string }>(
      "select (select count(*)::int from public.luzia_collaborators) n, (select value from public.luzia_settings where key = 'phase') phase",
    );
    expect(rows[0]).toEqual({ n: 14, phase: "primary" });
  });
});
