// Contrato legado hub ↔ aplicação (spec 7), preservado sem extensões:
//   aplicação → hub: { type: "LUZIA_READY" }
//   hub → aplicação: { type: "LUZIA_SESSION", access_token, refresh_token }
// O contrato não tem confirmação de recebimento: "enviada" não significa "sessão aplicada".

export const LUZIA_READY = "LUZIA_READY";
export const LUZIA_SESSION = "LUZIA_SESSION";

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
}

export type DeliveryTrigger = "load" | "ready";
export type DeliveryOutcome = "enviada" | "negada" | "sem_sessao" | "ignorada" | "erro";

export interface MessageLike {
  origin: string;
  source: unknown;
  data: unknown;
}

export interface FrameTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface BridgeDeps {
  /** Origem derivada da URL validada no servidor. Nunca "*". */
  targetOrigin: string;
  /** `iframe.contentWindow` do iframe autorizado (ou null se desmontado). */
  getFrameWindow: () => FrameTarget | null;
  /** Revalida no servidor: colaborador ativo e aplicação autorizada e ativa. */
  authorize: () => Promise<boolean>;
  /** Sessão atual (renovada se necessário) obtida no momento da entrega, nunca de um render anterior. */
  getSession: () => Promise<SessionTokens | null>;
  onOutcome?: (outcome: DeliveryOutcome, trigger: DeliveryTrigger) => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidTargetOrigin(origin: string): boolean {
  if (!origin || origin === "*" || origin === "null") return false;
  try {
    return new URL(origin).origin === origin;
  } catch {
    return false;
  }
}

/** READY só é aceito da origem aprovada E da janela exata do iframe autorizado. */
export function isReadyMessage(event: MessageLike, targetOrigin: string, frameWindow: unknown): boolean {
  if (!frameWindow || event.source !== frameWindow) return false;
  if (event.origin !== targetOrigin) return false;
  return isPlainObject(event.data) && event.data.type === LUZIA_READY;
}

export function buildSessionMessage(tokens: SessionTokens) {
  return { type: LUZIA_SESSION, access_token: tokens.access_token, refresh_token: tokens.refresh_token } as const;
}

export interface SessionBridge {
  handleLoad(): Promise<DeliveryOutcome>;
  handleMessage(event: MessageLike): Promise<DeliveryOutcome> | null;
  dispose(): void;
}

/**
 * Entrega a sessão no `load` do iframe e no primeiro READY de cada carregamento.
 * Entregas simultâneas são coalescidas e READY repetido no mesmo carregamento é ignorado (sem ciclos).
 */
export function createSessionBridge(deps: BridgeDeps): SessionBridge {
  if (!isValidTargetOrigin(deps.targetOrigin)) {
    throw new Error("targetOrigin inválido para entrega de sessão");
  }
  let disposed = false;
  let readyHandled = false;
  let inFlight: Promise<DeliveryOutcome> | null = null;

  const deliver = (trigger: DeliveryTrigger): Promise<DeliveryOutcome> => {
    if (disposed) return Promise.resolve("ignorada");
    if (inFlight) return inFlight;
    inFlight = (async (): Promise<DeliveryOutcome> => {
      try {
        if (!(await deps.authorize())) return "negada";
        if (disposed) return "ignorada";
        const tokens = await deps.getSession();
        if (!tokens?.access_token || !tokens.refresh_token) return "sem_sessao";
        const target = deps.getFrameWindow();
        if (disposed || !target) return "ignorada";
        target.postMessage(buildSessionMessage(tokens), deps.targetOrigin);
        return "enviada";
      } catch {
        return "erro";
      }
    })().then((outcome) => {
      inFlight = null;
      deps.onOutcome?.(outcome, trigger);
      return outcome;
    });
    return inFlight;
  };

  return {
    handleLoad() {
      readyHandled = false;
      return deliver("load");
    },
    handleMessage(event) {
      if (disposed || !isReadyMessage(event, deps.targetOrigin, deps.getFrameWindow())) return null;
      if (readyHandled) return null;
      readyHandled = true;
      return deliver("ready");
    },
    dispose() {
      disposed = true;
    },
  };
}
