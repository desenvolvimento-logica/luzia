import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { SetBreadcrumb } from "@/components/shell/breadcrumbs";
import { AppFrame } from "@/app/(hub)/aplicacoes/[id]/app-frame";

export interface OpenAppViewProps {
  app: { id: string; name: string; icon: string | null };
  departmentName: string | null;
  src: string;
  origin: string;
  openId: string;
  simulate?: boolean;
}

/** Moldura enxuta: título, retorno ao catálogo e a maior área possível para o iframe. */
export function OpenAppView({ app, departmentName, src, origin, openId, simulate }: OpenAppViewProps) {
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <SetBreadcrumb items={[{ label: "Aplicações", href: "/" }, { label: app.name }]} />
      <Link href="/" className="inline-flex min-h-10 items-center gap-2 self-start text-sm text-muted no-underline hover:text-text">
        <ArrowLeft aria-hidden className="size-4" />
        Voltar ao catálogo
      </Link>
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <AppIcon icon={app.icon} name={app.name} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight md:text-[28px]">{app.name}</h1>
          {departmentName ? <p className="text-muted">Departamento: {departmentName}</p> : null}
        </div>
      </div>
      <AppFrame appId={app.id} name={app.name} src={src} origin={origin} openId={openId} simulate={simulate} />
    </div>
  );
}
