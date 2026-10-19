import { randomUUID } from "node:crypto";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { APP_URL_MESSAGES, checkAppUrl } from "@/lib/security/app-url";
import { serverConfig } from "@/lib/server-config";
import { AppFrame } from "./app-frame";

export const metadata: Metadata = { title: "Aplicação" };

function Denied({ children }: { children: React.ReactNode }) {
  return (
    <ErrorState
      title="Acesso não disponível"
      action={
        <ButtonLink href="/" variant="secondary">
          Voltar ao catálogo
        </ButtonLink>
      }
    >
      {children}
    </ErrorState>
  );
}

export default async function OpenAppPage({ params }: PageProps<"/aplicacoes/[id]">) {
  const { id } = await params;
  const appId = /^\d{1,12}$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(appId) || appId <= 0) return <Denied>Aplicação não encontrada.</Denied>;

  const { supabase } = await requirePage();
  // Autoriza ANTES de renderizar o iframe ou entregar sessão; URL direta também passa por aqui.
  const [{ data: can }, { data: app }] = await Promise.all([
    supabase.rpc("luzia_can_open", { p_app_id: appId }),
    supabase.from("applications").select("app_id, app_name, app_url, app_status").eq("app_id", appId).maybeSingle(),
  ]);
  if (!app || can !== true) {
    return <Denied>Esta aplicação não existe, está desativada ou não está liberada para o seu departamento.</Denied>;
  }

  const cfg = serverConfig();
  const url = checkAppUrl(app.app_url, cfg.appOrigins, { allowLocal: cfg.allowLocalApps });
  if (!url.ok) {
    console.warn(JSON.stringify({ evento: "luzia_app_url_recusada", app_id: app.app_id, motivo: url.reason }));
    return (
      <Denied>
        A integração desta aplicação está com configuração inválida ({APP_URL_MESSAGES[url.reason]}). A administração precisa
        corrigir o cadastro ou a lista de origens aprovadas.
      </Denied>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/" variant="ghost" aria-label="Voltar ao catálogo">
          <ArrowLeft aria-hidden className="size-4" />
          Catálogo
        </ButtonLink>
        <h1 className="text-xl font-semibold">{app.app_name}</h1>
      </div>
      {/* openId gerado por renderização: remontagem técnica reutiliza; nova abertura gera outro. */}
      <AppFrame appId={app.app_id} name={app.app_name} src={url.url} origin={url.origin} openId={randomUUID()} />
    </div>
  );
}
