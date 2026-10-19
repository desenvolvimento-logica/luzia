"use client";

import { RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, LoadingState, Notice } from "@/components/ui/states";
import { authorizeSessionDelivery, registerOpen, reportFrameIssue } from "@/features/apps/actions";
import { createSessionBridge, type DeliveryOutcome } from "@/lib/sso/bridge";
import { browserSupabase } from "@/lib/supabase/browser";

const READY_TIMEOUT_MS = 10_000;
const REFRESH_MARGIN_S = 60;

interface Props {
  appId: number;
  name: string;
  src: string;
  origin: string;
  openId: string;
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

export function AppFrame({ appId, name, src, origin, openId }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<ReturnType<typeof createSessionBridge> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [denied, setDenied] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeliveryOutcome | null>(null);
  const [readySeen, setReadySeen] = useState(false);
  const [slow, setSlow] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  // Registro idempotente da abertura (mesmo openId em remontagens e no StrictMode).
  useEffect(() => {
    let cancelled = false;
    registerOpen(appId, openId).then((r) => {
      if (!cancelled && !r.ok) setDenied(r.message);
    });
    return () => {
      cancelled = true;
    };
  }, [appId, openId]);

  useEffect(() => {
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
  }, [appId, origin]);

  useEffect(() => {
    if (!loaded || readySeen) return;
    const t = window.setTimeout(() => {
      setSlow(true);
      void reportFrameIssue(appId, "sem_ready");
    }, READY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [loaded, readySeen, appId]);

  if (denied) {
    return (
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
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p aria-live="polite">
          {outcome === "enviada"
            ? "Sessão enviada à aplicação. A aplicação não confirma o recebimento."
            : outcome === "sem_sessao"
              ? "Sua sessão no hub expirou. Entre novamente para usar esta aplicação."
              : outcome === "erro"
                ? "Não foi possível enviar a sessão à aplicação."
                : loaded
                  ? "Aplicação carregada."
                  : null}
        </p>
        <Button
          variant="ghost"
          className="min-h-8 px-2 text-xs"
          onClick={() => {
            setLoaded(false);
            setReadySeen(false);
            setSlow(false);
            setFrameKey((k) => k + 1);
          }}
        >
          <RotateCw aria-hidden className="size-3.5" />
          Recarregar aplicação
        </Button>
      </div>
      {slow ? (
        <Notice tone="warning">
          A aplicação ainda não sinalizou que está pronta. Se a área abaixo estiver em branco, ela pode estar bloqueando a exibição
          dentro do hub (X-Frame-Options ou CSP frame-ancestors) ou não ter o listener de sessão. O caso foi registrado para a
          equipe de integração.
        </Notice>
      ) : null}
      <div className="relative h-[calc(100dvh-11rem)] min-h-[28rem] overflow-hidden rounded-lg border border-border bg-surface">
        {!loaded ? (
          <div className="absolute inset-0">
            <LoadingState label={`Carregando ${name}…`} />
          </div>
        ) : null}
        <iframe
          key={frameKey}
          ref={iframeRef}
          src={src}
          title={name}
          className="size-full"
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
