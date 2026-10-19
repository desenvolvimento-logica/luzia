// AC-07 e contrato legado (spec 7) — teste com simulação de janelas; não substitui AC-08 em staging.
import { describe, expect, it, vi } from "vitest";
import { buildSessionMessage, createSessionBridge, isReadyMessage, LUZIA_SESSION, type SessionTokens } from "@/lib/sso/bridge";

const ORIGIN = "https://app.exemplo.test";
const tokens: SessionTokens = { access_token: "at-sintetico", refresh_token: "rt-sintetico" };

function setup(overrides: Partial<Parameters<typeof createSessionBridge>[0]> = {}) {
  const frame = { postMessage: vi.fn() };
  const outcomes: string[] = [];
  const authorize = vi.fn(async () => true);
  const getSession = vi.fn(async () => tokens);
  const bridge = createSessionBridge({
    targetOrigin: ORIGIN,
    getFrameWindow: () => frame,
    authorize,
    getSession,
    onOutcome: (o) => outcomes.push(o),
    ...overrides,
  });
  return { bridge, frame, outcomes, authorize, getSession };
}

describe("validação de READY", () => {
  const win = {};
  it("aceita somente origem aprovada + janela exata + formato correto", () => {
    expect(isReadyMessage({ origin: ORIGIN, source: win, data: { type: "LUZIA_READY" } }, ORIGIN, win)).toBe(true);
    expect(isReadyMessage({ origin: "https://evil.example", source: win, data: { type: "LUZIA_READY" } }, ORIGIN, win)).toBe(false);
    expect(isReadyMessage({ origin: ORIGIN, source: {}, data: { type: "LUZIA_READY" } }, ORIGIN, win)).toBe(false);
    expect(isReadyMessage({ origin: ORIGIN, source: win, data: "LUZIA_READY" }, ORIGIN, win)).toBe(false);
    expect(isReadyMessage({ origin: ORIGIN, source: win, data: { type: "LUZIA_SESSION" } }, ORIGIN, win)).toBe(false);
    expect(isReadyMessage({ origin: ORIGIN, source: win, data: null }, ORIGIN, win)).toBe(false);
    expect(isReadyMessage({ origin: ORIGIN, source: null, data: { type: "LUZIA_READY" } }, ORIGIN, null)).toBe(false);
  });

  it("recusa origem curinga, null ou com caminho", () => {
    for (const bad of ["*", "null", "", "https://app.exemplo.test/path", "javascript:alert(1)"]) {
      expect(() => setup({ targetOrigin: bad })).toThrow(/targetOrigin inválido/);
    }
  });
});

describe("entrega de sessão", () => {
  it("envia o payload legado exato ao contentWindow com targetOrigin explícito", async () => {
    const { bridge, frame } = setup();
    expect(await bridge.handleLoad()).toBe("enviada");
    expect(frame.postMessage).toHaveBeenCalledTimes(1);
    expect(frame.postMessage).toHaveBeenCalledWith({ type: LUZIA_SESSION, access_token: "at-sintetico", refresh_token: "rt-sintetico" }, ORIGIN);
    expect(Object.keys(buildSessionMessage(tokens)).sort()).toEqual(["access_token", "refresh_token", "type"]);
  });

  it("mensagem de origem ou janela incorreta é ignorada sem entrega", async () => {
    const { bridge, frame } = setup();
    expect(bridge.handleMessage({ origin: "https://evil.example", source: frame, data: { type: "LUZIA_READY" } })).toBeNull();
    expect(bridge.handleMessage({ origin: ORIGIN, source: { postMessage() {} }, data: { type: "LUZIA_READY" } })).toBeNull();
    expect(frame.postMessage).not.toHaveBeenCalled();
  });

  it("READY válido entrega; READY repetido no mesmo carregamento é ignorado (sem ciclos)", async () => {
    const { bridge, frame } = setup();
    const ready = { origin: ORIGIN, source: frame, data: { type: "LUZIA_READY" } };
    expect(await bridge.handleMessage(ready)).toBe("enviada");
    for (let i = 0; i < 5; i++) expect(bridge.handleMessage(ready)).toBeNull();
    expect(frame.postMessage).toHaveBeenCalledTimes(1);
    await bridge.handleLoad(); // novo carregamento reabre a janela de READY
    expect(await bridge.handleMessage(ready)).toBe("enviada");
    expect(frame.postMessage).toHaveBeenCalledTimes(3);
  });

  it("load e READY simultâneos são coalescidos em uma entrega", async () => {
    const { bridge, frame } = setup();
    const a = bridge.handleLoad();
    const b = bridge.handleMessage({ origin: ORIGIN, source: frame, data: { type: "LUZIA_READY" } });
    await Promise.all([a, b]);
    expect(frame.postMessage).toHaveBeenCalledTimes(1);
  });

  it("revalida autorização e lê a sessão atual a cada entrega (sem token obsoleto)", async () => {
    let n = 0;
    const getSession = vi.fn(async () => ({ access_token: `at-${++n}`, refresh_token: `rt-${n}` }));
    const { bridge, frame, authorize } = setup({ getSession });
    await bridge.handleLoad();
    await bridge.handleLoad();
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(frame.postMessage.mock.calls.map((c) => (c[0] as { access_token: string }).access_token)).toEqual(["at-1", "at-2"]);
  });

  it("não envia quando a autorização é negada (app inativa/colaborador desativado) ou sem sessão", async () => {
    const denied = setup({ authorize: async () => false });
    expect(await denied.bridge.handleLoad()).toBe("negada");
    expect(denied.frame.postMessage).not.toHaveBeenCalled();
    expect(denied.getSession).not.toHaveBeenCalled();

    const noSession = setup({ getSession: async () => null });
    expect(await noSession.bridge.handleLoad()).toBe("sem_sessao");
    expect(noSession.frame.postMessage).not.toHaveBeenCalled();
  });

  it("após dispose (sair/desmontar) nenhuma entrega ocorre, nem a que estava em andamento", async () => {
    let release!: (v: boolean) => void;
    const { bridge, frame } = setup({ authorize: () => new Promise<boolean>((r) => (release = r)) });
    const pending = bridge.handleLoad();
    bridge.dispose();
    release(true);
    expect(await pending).toBe("ignorada");
    expect(await bridge.handleLoad()).toBe("ignorada");
    expect(frame.postMessage).not.toHaveBeenCalled();
  });

  it("falhas não vazam tokens: resultado sem payload", async () => {
    const { bridge, outcomes } = setup({ getSession: async () => { throw new Error("rede"); } });
    expect(await bridge.handleLoad()).toBe("erro");
    expect(JSON.stringify(outcomes)).not.toContain("at-sintetico");
  });
});
