import { CirclePlus } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/ui/states";
import { ApplicationDrawer, type DrawerApp } from "./application-drawer";
import { type AdminAppRow, AppsTable } from "./apps-table";

export interface AppsAdminViewProps {
  apps: (AdminAppRow & { drawer: DrawerApp })[];
  departments: { id: number; name: string }[];
  allowedOrigins: string[];
  readOnly: boolean;
  editingId: string | null;
  creating: boolean;
  savedName: string | null;
}

export function AppsAdminView({ apps, departments, allowedOrigins, readOnly, editingId, creating, savedName }: AppsAdminViewProps) {
  const editing = editingId ? apps.find((a) => a.id === editingId) : undefined;
  return (
    <>
      <PageHeader
        title="Aplicações"
        description="Gerencie o catálogo e os departamentos com acesso."
        actions={
          readOnly ? null : (
            <Link id="nova-aplicacao" href="/admin/aplicacoes?nova=1" scroll={false} className={buttonClass("primary")}>
              <CirclePlus aria-hidden className="size-5" />
              Nova aplicação
            </Link>
          )
        }
      />
      {savedName ? (
        <div className="mb-4">
          <Notice tone="success">
            <span role="status">Aplicação “{savedName}” salva.</span>
          </Notice>
        </div>
      ) : null}
      <AppsTable apps={apps.map((a) => ({ id: a.id, name: a.name, icon: a.icon, active: a.active, audienceLabel: a.audienceLabel }))} readOnly={readOnly} />
      {editing || (creating && !readOnly) ? (
        <ApplicationDrawer
          key={editing?.id ?? "nova"}
          app={editing?.drawer}
          departments={departments}
          allowedOrigins={allowedOrigins}
          readOnly={readOnly}
          closeHref="/admin/aplicacoes"
        />
      ) : null}
    </>
  );
}
