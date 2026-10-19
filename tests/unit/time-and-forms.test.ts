import { describe, expect, it } from "vitest";
import { applicationSchema, collaboratorSchema, noteSchema } from "@/features/admin/schemas";
import { civilMidnightUtc } from "@/lib/activities/scope";
import { parsePageSize } from "@/lib/reports/pagination";
import { resolvePeriod, saoPauloDate } from "@/lib/reports/period";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";

describe("fuso America/Sao_Paulo (AC-11)", () => {
  it("meia-noite civil em UTC, inclusive com horário de verão histórico", () => {
    expect(civilMidnightUtc("2026-10-01")).toBe("2026-10-01T03:00:00.000Z");
    // 2018-11-04 começou o horário de verão (00:00 → 01:00): primeiro instante do dia é 01:00 -02.
    expect(civilMidnightUtc("2018-12-01")).toBe("2018-12-01T02:00:00.000Z");
  });

  it("data civil de um instante perto da virada", () => {
    expect(saoPauloDate(new Date("2026-10-01T02:59:59Z"))).toBe("2026-09-30");
    expect(saoPauloDate(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });

  it("período padrão de 30 dias e limites", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(resolvePeriod(undefined, undefined, now)).toEqual({ from: "2026-09-20", to: "2026-10-19", adjusted: false });
    expect(resolvePeriod("2026-10-10", "2026-10-01", now).adjusted).toBe(true);
    expect(resolvePeriod("2020-01-01", "2026-10-01", now)).toMatchObject({ from: "2025-09-30", adjusted: true });
    expect(resolvePeriod("2026-02-30", "lixo", now).to).toBe("2026-10-19");
  });

  it("ida e volta de datetime-local", () => {
    const utc = zonedLocalToUtc("2026-10-19T08:30");
    expect(utc).toBe("2026-10-19T11:30:00.000Z");
    expect(utcToZonedLocal(utc!)).toBe("2026-10-19T08:30");
    expect(zonedLocalToUtc("2026-13-01T00:00")).toBeNull();
  });

  it("tamanho de página limitado a 100 (padrão 25)", () => {
    expect(parsePageSize(undefined)).toBe(25);
    expect(parsePageSize("500")).toBe(100);
    expect(parsePageSize("0")).toBe(1);
  });
});

describe("validação dos formulários administrativos", () => {
  const ctx = {
    allowedOrigins: ["https://geral.exemplo.test"],
    originOptions: { allowLocal: false },
    supabaseUrl: "https://projeto.supabase.exemplo.test",
    iconBucket: "app-icons",
  };
  const base = { app_name: "Portal", app_description: "", app_url: "https://geral.exemplo.test/", app_icon: "🌐", app_status: "on" };

  it("audiência selecionada exige departamento; 'todos' descarta seleção", () => {
    const s = applicationSchema(ctx);
    expect(s.safeParse({ ...base, audience: "selecionados", dpto_ids: [] }).success).toBe(false);
    const ok = s.parse({ ...base, audience: "todos", dpto_ids: ["2"] });
    expect(ok.dpto_ids).toEqual([]);
    expect(ok.app_status).toBe(true);
    expect(s.parse({ ...base, audience: "selecionados", dpto_ids: ["2", "3"] }).dpto_ids).toEqual([2, 3]);
  });

  it("URL fora da lista e ícone arbitrário são recusados", () => {
    const s = applicationSchema(ctx);
    const r = s.safeParse({ ...base, app_url: "https://outra.exemplo.test/", app_icon: "https://evil.example/x.png", audience: "todos" });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["app_url", "app_icon"]));
  });

  it("formulário de colaborador não aceita identidade nem e-mail", () => {
    const parsed = collaboratorSchema.parse({ user_id: "1", user_dpto: "2", user_role: "lider", access_status: "ativo", user_email: "x@y", auth_user_id: "z" });
    expect(parsed).toEqual({ user_id: 1, user_dpto: 2, user_role: "lider", is_admin: false, access_status: "ativo" });
    expect(collaboratorSchema.safeParse({ user_id: "1", user_dpto: "2", user_role: "presidente", access_status: "ativo" }).success).toBe(false);
  });

  it("novidade converte horário de Brasília para UTC", () => {
    const n = noteSchema.parse({ note_title: "T", note_body: "<script>x</script>", note_version: "", dt_publish: "2026-10-20T09:00" });
    expect(n.dt_publish).toBe("2026-10-20T12:00:00.000Z");
    expect(n.note_body).toBe("<script>x</script>"); // armazenado como texto; a interface nunca interpreta HTML
    expect(noteSchema.safeParse({ note_title: "T", note_body: "x", note_version: "", dt_publish: "ontem" }).success).toBe(false);
  });
});
