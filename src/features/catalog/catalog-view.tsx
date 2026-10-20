import { Building2 } from "lucide-react";
import { Notice } from "@/components/ui/states";
import { CatalogGrid } from "./catalog-grid";
import type { CatalogApp } from "./types";

export interface CatalogViewProps {
  departmentName: string | null;
  pendingDepartment: boolean;
  isAdmin: boolean;
  apps: CatalogApp[];
}

export function CatalogView({ departmentName, pendingDepartment, isAdmin, apps }: CatalogViewProps) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">Escritório Lógica</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[32px]">Tudo o que você precisa, em um só lugar.</h1>
          <p className="mt-2 text-base text-muted md:text-lg">
            {isAdmin
              ? "Como administrador, você vê todas as aplicações ativas do hub."
              : "Acesse as ferramentas disponíveis para o seu departamento."}
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-3 self-start rounded-[var(--radius-card)] bg-brand-soft px-4 py-3">
          <Building2 aria-hidden className="size-6" />
          <span className="leading-tight">
            <span className="block text-sm text-muted">Departamento</span>
            <span className="block font-semibold">{departmentName ?? "Não definido"}</span>
          </span>
        </div>
      </div>

      {pendingDepartment && !isAdmin ? (
        <Notice tone="warning">
          Seu cadastro ainda não tem departamento definido, por isso nenhuma aplicação foi liberada. Procure a administração do
          Luz.IA para concluir o cadastro.
        </Notice>
      ) : null}

      <CatalogGrid apps={apps} departmentName={departmentName} />

    </div>
  );
}
