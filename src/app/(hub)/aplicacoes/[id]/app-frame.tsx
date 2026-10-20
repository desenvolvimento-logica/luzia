"use client";

import { ArrowLeft, Maximize2, Minimize2, RotateCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { authorizeSessionDelivery, registerOpen, reportFrameIssue } from "@/features/apps/actions";
import { createSessionBridge, type DeliveryOutcome } from "@/lib/sso/bridge";
import { browserSupabase } from "@/lib/supabase/browser";

const READY_TIMEOUT_MS = 10_000;
const REFRESH_MARGIN_S = 60;

interface Props {
  appId: string;
  name: string;
  /** Ícone já renderizado (servidor) para a barra. */
  icon: ReactNode;
  departmentName: string | null;
  src: string;
  origin: string;
  openId: string;
  /** Pré-visualização de interface: não registra abertura nem entrega sessão. */
  simulate?: boolean;
}

async function currentSession() {
  const auth = browserSupabase().auth;
  let { data } = await auth.getSession();
  const exp = data.session?.expires_at ?? 0;
  if (data.session && exp - Date.now() / 1000 < REFRESH_MARGIN_S) {
    ({ data } = await auth.refreshSession());
  }
  const s = data.session;
  return s ? { access_token: s.access_token, refresh_token: s.refresh_token } : null;
}

function statusText(outcome: DeliveryOutcome | null, loaded: boolean, name: string): string {
  if (outcome === "enviada") return "Sessão enviada à aplicação (a aplicação não confirma o recebimento).";
  if (outcome === "sem_sessao") return "Sua sessão no hub expirou. Entre novamente para usar esta aplicação.";
  if (outcome === "erro") return "Não foi possível enviar a sessão à aplicação.";
  return loaded ? "Aplicação carregada." : `Carregando ${name}…`;
}

const toolButton =
  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] px-2.5 text-sm font-medium text-text no-underline hover:bg-surface-2";

/**
 * Moldura mínima: uma barra de 48 px e o iframe ocupando toda a área restante (spec 3: privilegiar a aplicação).
 * "Tela cheia" usa a API nativa do navegador — Esc sai mesmo com o foco dentro da aplicação.
 */
export function AppFrame({ appId, name, icon, departmentName, src, origin, openId, simulate = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<ReturnType<typeof createSessionBridge> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeliveryOutcome | null>(null);
  const [readySeen, setReadySeen] = useState(false);
  const [slow, setSlow] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);

  // Registro idempotente da abertura (mesmo openId em remontagens e no StrictMode).
  useEffect(() => {
    if (simulate) return;
    let cancelled = false;
    registerOpen(appId, openId).then((r) => {
      if (!cancelled && !r.ok) setDenied(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, openId, simulate]);

  useEffect(() => {
    if (simulate) return;
    const bridge = createSessionBridge({
      targetOrigin: origin,
      getFrameWindow: () => iframeRef.current?.contentWindow ?? null,
      authorize: async () => {
        const r = await authorizeSessionDelivery(appId);
        return r.ok && r.origin === origin;
      },
      getSession: currentSession,
      onOutcome: (o) => {
        setOutcome(o);
        if (o === "negada") setDenied("Seu acesso a esta aplicação não está mais autorizado.");
      },
    });
    bridgeRef.current = bridge;
    const onMessage = (event: MessageEvent) => {
      if (bridge.handleMessage(event)) setReadySeen(true);
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      bridge.dispose();
      bridgeRef.current = null;
    };
  }, [appId, origin, simulate]);

  useEffect(() => {
    if (simulate || !loaded || readySeen) return;
    const t = window.setTimeout(() => {
      setSlow(true);
      void reportFrameIssue(appId, "sem_ready");
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loaded, readySeen, appId, simulate]);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === rootRef.current);
    // Detectado no cliente: alguns navegadores (ex.: Safari no iPhone) não oferecem tela cheia para elementos.
    queueMicrotask(() => setCanFullscreen(typeof document.documentElement.requestFullscreen === "function"));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await rootRef.current?.requestFullscreen();
    } catch {
      /* navegador recusou: segue na moldura normal */
    }
  }

  if (denied) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          title="Acesso não disponível"
          action={
            <ButtonLink href="/" variant="secondary">
              Voltar ao catálogo
            </ButtonLink>
          }
        >
          {denied}
        </ErrorState>
      </div>
    );
  }

  const status = statusText(outcome, loaded, name);
  return (
    <div ref={rootRef} className="flex h-[calc(100dvh-4rem)] min-h-[24rem] flex-col bg-surface">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2 sm:gap-2 sm:px-3">
        <Link href="/" className={toolButton} aria-label="Voltar ao catálogo" title="Voltar ao catálogo">
          <ArrowLeft aria-hidden className="size-4" />
          <span className="hidden lg:inline">Catálogo</span>
        </Link>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {icon}
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="truncate text-[15px] font-semibold">{name}</h1>
          {departmentName ? <span className="hidden truncate text-sm text-muted md:inline">· {departmentName}</span> : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {status}
        </p>
        <span className="hidden max-w-[22rem] truncate text-xs text-muted xl:inline" title={status}>
          {status}
        </span>
        {slow ? (
          <details className="relative">
            <summary
              className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-full bg-warning-bg px-3 text-xs font-medium [&::-webkit-details-marker]:hidden"
              aria-label="A aplicação não sinalizou prontidão — ver detalhes"
            >
              <TriangleAlert aria-hidden className="size-4" />
              <span className="hidden sm:inline">Sem sinal da aplicação</span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-[var(--radius-card)] border border-border bg-surface p-4 text-sm shadow-lg">
              A aplicação ainda não sinalizou que está pronta. Se a área estiver em branco ou pedir login, ela pode estar bloqueando
              a exibição dentro do hub (X-Frame-Options/CSP), não ter o listener de sessão ou aceitar sessão só de outro endereço do
              hub. O caso foi registrado para a equipe de integração.
            </div>
          </details>
        ) : null}
        <button
          type="button"
          className={toolButton}
          onClick={() => {
            setLoaded(false);
            setReadySeen(false);
            setSlow(false);
            setFrameKey((k) => k + 1);
          }}
          aria-label="Recarregar aplicação"
          title="Recarregar aplicação"
        >
          <RotateCw aria-hidden className="size-4" />
          <span className="hidden lg:inline">Recarregar</span>
        </button>
        {canFullscreen ? (
          <button
            type="button"
            className={toolButton}
            onClick={() => void toggleFullscreen()}
            aria-pressed={fullscreen}
            aria-label={fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
            title={fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia"}
          >
            {fullscreen ? <Minimize2 aria-hidden className="size-4" /> : <Maximize2 aria-hidden className="size-4" />}
            <span className="hidden lg:inline">{fullscreen ? "Sair da tela cheia" : "Tela cheia"}</span>
          </button>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {!loaded ? (
          <div className="absolute inset-0 bg-surface">
            <LoadingState label={`Carregando ${name}…`} />
          </div>
        ) : null}
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={src}
          title={name}
          className="absolute inset-0 size-full border-0"
          allow="fullscreen"
          // Sem allow-top-navigation: a aplicação não pode navegar a janela do hub.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => {
            setLoaded(true);
            void bridgeRef.current?.handleLoad();
          }}
        />
      </div>
    </div>
  );
}
