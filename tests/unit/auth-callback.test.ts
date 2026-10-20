// AC-01 com simulação do Supabase Auth/Microsoft. Login Microsoft real: validação manual em staging (docs/validacao-externa.md).
import { describe, expect, it, vi } from "vitest";
import { type CallbackDeps, loginErrorMessage, resolveCallback } from "@/lib/auth/callback";

function deps(overrides: Partial<CallbackDeps> = {}) {
  return {
    exchangeCode: vi.fn(async () => ({ ok: true })),
    provision: vi.fn(async () => ({ ok: true as const })),
    signOut: vi.fn(async () => undefined),
    ...overrides,
  };
}
const run = (qs: string, d = deps()) => resolveCallback(new URLSearchParams(qs), d);

describe("callback OAuth", () => {
  it("login corporativo válido segue para caminho interno permitido", async () => {
    const d = deps();
    expect(await run("code=abc&next=%2Faplicacoes%2F2", d)).toBe("/aplicacoes/2");
    expect(d.provision).toHaveBeenCalledOnce();
    expect(d.signOut).not.toHaveBeenCalled();
  });

  it("redirecionamento externo vira raiz", async () => {
    expect(await run("code=abc&next=https%3A%2F%2Fevil.example")).toBe("/");
  });

  it("cancelamento no provedor não troca código", async () => {
    const d = deps();
    expect(await run("error=access_denied&error_description=cancelado", d)).toBe("/login?erro=cancelado");
    expect(d.exchangeCode).not.toHaveBeenCalled();
  });

  it("indisponibilidade do provedor", async () => {
    expect(await run("error=temporarily_unavailable")).toBe("/login?erro=indisponivel");
    expect(await run("code=abc", deps({ exchangeCode: async () => { throw new Error("rede"); } }))).toBe("/login?erro=indisponivel");
  });

  it("callback sem código ou com código inválido não concede acesso", async () => {
    const d = deps({ exchangeCode: vi.fn(async () => ({ ok: false })) });
    expect(await run("", d)).toBe("/login?erro=callback");
    expect(await run("code=invalido", d)).toBe("/login?erro=callback");
    expect(d.provision).not.toHaveBeenCalled();
  });

  it("conta de outro tenant: encerra a sessão recém-criada e informa não autorizado", async () => {
    const d = deps({ provision: async () => ({ ok: false, hint: "luzia_foreign_account" }) });
    expect(await run("code=abc&next=%2Fadmin", d)).toBe("/login?erro=nao_autorizado");
    expect(d.signOut).toHaveBeenCalledOnce();
  });

  it("conflito de identidade também é negado; falha genérica é indisponível", async () => {
    expect(await run("code=abc", deps({ provision: async () => ({ ok: false, hint: "luzia_identity_conflict" }) }))).toBe("/login?erro=nao_autorizado");
    const d = deps({ provision: async () => { throw new Error("x"); } });
    expect(await run("code=abc", d)).toBe("/login?erro=indisponivel");
    expect(d.signOut).toHaveBeenCalledOnce();
  });

  it("cadastro ainda não sincronizado na coexistência tem mensagem própria", async () => {
    const d = deps({ provision: async () => ({ ok: false, hint: "luzia_not_synced" }) });
    expect(await run("code=abc", d)).toBe("/login?erro=nao_sincronizado");
    expect(d.signOut).toHaveBeenCalledOnce();
    expect(loginErrorMessage("nao_sincronizado")).toMatch(/ainda não chegou/);
  });

  it("mensagens em português; código desconhecido cai na mensagem de callback", () => {
    expect(loginErrorMessage("cancelado")).toMatch(/cancelado/);
    expect(loginErrorMessage("qualquer")).toMatch(/inválido ou expirou/);
    expect(loginErrorMessage(null)).toBeNull();
  });
});
