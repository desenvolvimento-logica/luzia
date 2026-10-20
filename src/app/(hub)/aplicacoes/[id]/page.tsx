import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalUuid } from "@/lib/reports/pagination";
import { APP_URL_MESSAGES, checkAppUrl } from "@/lib/security/app-url";
import { serverConfig } from "@/lib/server-config";
import { OpenAppView } from "@/features/apps/open-app-view";

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
  const appId = parseOptionalUuid(id);
  if (!appId) return <Denied>Aplicação não encontrada.</Denied>;

  const { supabase, user } = await requirePage();
  // Autoriza ANTES de renderizar o iframe ou entregar sessão; URL direta também passa por aqui.
  const [{ data: can }, { data: app }] = await Promise.all([
    supabase.rpc("luzia_can_open", { p_application_id: appId }),
    supabase.from("luzia_applications").select("id, name, url, icon, active").eq("id", appId).maybeSingle(),
  ]);
  if (!app || can !== true) {
    return <Denied>Esta aplicação não existe, está desativada ou não está liberada para o seu departamento.</Denied>;
  }

  const cfg = serverConfig();
  const url = checkAppUrl(app.url, cfg.appOrigins, { allowLocal: cfg.allowLocalApps });
  if (!url.ok) {
    console.warn(JSON.stringify({ evento: "luzia_app_url_recusada", application_id: app.id, motivo: url.reason }));
    return (
      <Denied>
        A integração desta aplicação está com configuração inválida ({APP_URL_MESSAGES[url.reason]}). A administração precisa
        corrigir o cadastro ou a lista de origens aprovadas.
      </Denied>
    );
  }

  // openId gerado por renderização: remontagem técnica reutiliza; nova abertura gera outro.
  return (
    <OpenAppView
      app={{ id: app.id, name: app.name, icon: app.icon }}
      departmentName={user.dptoName}
      src={url.url}
      origin={url.origin}
      openId={randomUUID()}
    />
  );
}
