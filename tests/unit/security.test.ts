import { describe, expect, it } from "vitest";
import { checkAppUrl } from "@/lib/security/app-url";
import { isApprovedIconUrl, isEmojiLike, parseIcon } from "@/lib/security/icon";
import { parseAllowedOrigins } from "@/lib/security/origins";
import { safeNextPath } from "@/lib/security/redirect";
import { checkIconUpload, ICON_MAX_BYTES } from "@/lib/security/upload";
import { sanitizeSearchTerm } from "@/lib/text";

const ALLOWED = ["https://fiscocheck.exemplo.test", "https://tributario.exemplo.test"];
const prod = { allowLocal: false };
const dev = { allowLocal: true };

describe("origens aprovadas", () => {
  it("aceita só https sem caminho; local apenas em desenvolvimento", () => {
    expect(parseAllowedOrigins("https://a.exemplo.test, https://b.exemplo.test/ ,http://c.exemplo.test,https://u:p@d.exemplo.test,https://e.exemplo.test/x", prod)).toEqual([
      "https://a.exemplo.test",
      "https://b.exemplo.test",
    ]);
    expect(parseAllowedOrigins("http://localhost:4100", prod)).toEqual([]);
    expect(parseAllowedOrigins("http://localhost:4100", dev)).toEqual(["http://localhost:4100"]);
    expect(parseAllowedOrigins(undefined, prod)).toEqual([]);
  });
});

describe("URL de aplicação", () => {
  it("aceita https em origem aprovada e devolve a origem do targetOrigin", () => {
    expect(checkAppUrl("https://fiscocheck.exemplo.test/app?x=1", ALLOWED, prod)).toEqual({
      ok: true,
      url: "https://fiscocheck.exemplo.test/app?x=1",
      origin: "https://fiscocheck.exemplo.test",
    });
  });

  it.each([
    ["javascript:alert(1)", "esquema"],
    ["data:text/html,<b>", "invalida"],
    ["http://fiscocheck.exemplo.test/", "esquema"],
    ["https://user:senha@fiscocheck.exemplo.test/", "credenciais"],
    ["https://outra.exemplo.test/", "origem_nao_aprovada"],
    ["https://fiscocheck.exemplo.test.evil.example/", "origem_nao_aprovada"],
    ["//fiscocheck.exemplo.test/", "invalida"],
    ["", "invalida"],
  ])("recusa %s (%s)", (url, reason) => {
    expect(checkAppUrl(url, ALLOWED, prod)).toEqual({ ok: false, reason });
  });

  it("salvar uma URL não amplia a lista de origens", () => {
    const list = [...ALLOWED];
    checkAppUrl("https://nova.exemplo.test/", list, prod);
    expect(list).toEqual(ALLOWED);
  });

  it("exceção local só com allowLocal", () => {
    expect(checkAppUrl("http://localhost:4100/", ["http://localhost:4100"], prod)).toEqual({ ok: false, reason: "esquema" });
    expect(checkAppUrl("http://localhost:4100/", ["http://localhost:4100"], dev).ok).toBe(true);
  });
});

describe("redirecionamento pós-login", () => {
  it.each([
    ["/aplicacoes/3", "/aplicacoes/3"],
    ["/relatorios?de=2026-10-01", "/relatorios?de=2026-10-01"],
    ["/", "/"],
    ["https://evil.example/", "/"],
    ["//evil.example/", "/"],
    ["/\\evil.example", "/"],
    ["/%2F%2Fevil.example", "/"],
    ["/auth/callback?code=x", "/"],
    ["/login", "/"],
    ["javascript:alert(1)", "/"],
    ["/aplicacoes\n", "/"],
    [null, "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("upload de ícone", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  it("aceita PNG, JPEG e WebP pelo conteúdo", () => {
    expect(checkIconUpload(png, "image/png")).toEqual({ ok: true, mime: "image/png" });
    expect(checkIconUpload(jpeg, "image/jpeg")).toEqual({ ok: true, mime: "image/jpeg" });
    expect(checkIconUpload(webp, "image/webp")).toEqual({ ok: true, mime: "image/webp" });
  });

  it("recusa SVG, conteúdo disfarçado, vazio e acima de 2 MB", () => {
    expect(checkIconUpload(svg, "image/svg+xml").ok).toBe(false);
    expect(checkIconUpload(svg, "image/png").ok).toBe(false);
    expect(checkIconUpload(png, "image/jpeg").ok).toBe(false);
    expect(checkIconUpload(new Uint8Array(), "image/png").ok).toBe(false);
    const big = new Uint8Array(ICON_MAX_BYTES + 1);
    big.set(png);
    expect(checkIconUpload(big, "image/png").ok).toBe(false);
  });
});

describe("ícones e busca", () => {
  it("emoji e URLs do bucket aprovado", () => {
    expect(isEmojiLike("🧾")).toBe(true);
    expect(isEmojiLike("✉️")).toBe(true);
    expect(isEmojiLike("<img>")).toBe(false);
    expect(isEmojiLike("abc")).toBe(false);
    expect(parseIcon("javascript:alert(1)")).toEqual({ kind: "none" });
    expect(parseIcon("http://evil.example/x.png")).toEqual({ kind: "none" });
    const base = "https://projeto.supabase.exemplo.test";
    expect(isApprovedIconUrl(`${base}/storage/v1/object/public/app-icons/apps/x.png`, base, "app-icons")).toBe(true);
    expect(isApprovedIconUrl(`https://evil.example/storage/v1/object/public/app-icons/x.png`, base, "app-icons")).toBe(false);
    expect(isApprovedIconUrl(`${base}/storage/v1/object/public/outro/x.png`, base, "app-icons")).toBe(false);
  });

  it("termo de busca não injeta filtros PostgREST", () => {
    expect(sanitizeSearchTerm("ana),user_role.eq.diretor,(x")).toBe("ana user role.eq.diretor x");
    expect(sanitizeSearchTerm("100%_*")).toBe("100");
    expect(sanitizeSearchTerm("ana.admin@exemplo.test")).toBe("ana.admin@exemplo.test");
  });
});
