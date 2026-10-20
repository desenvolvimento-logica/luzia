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

/** Aplicação aberta ocupando toda a área de conteúdo, com barra compacta. */
export function OpenAppView({ app, departmentName, src, origin, openId, simulate }: OpenAppViewProps) {
  return (
    <>
      <SetBreadcrumb items={[{ label: "Aplicações", href: "/" }, { label: app.name }]} />
      <AppFrame
        appId={app.id}
        name={app.name}
        icon={<AppIcon icon={app.icon} name={app.name} size="xs" />}
        departmentName={departmentName}
        src={src}
        origin={origin}
        openId={openId}
        simulate={simulate}
      />
    </>
  );
}
