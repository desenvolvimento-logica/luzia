import Link from "next/link";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";

const LINKS = [
  ["/admin/aplicacoes", "Aplicações"],
  ["/admin/colaboradores", "Colaboradores"],
  ["/admin/departamentos", "Departamentos"],
  ["/admin/novidades", "Novidades"],
  ["/admin/auditoria", "Auditoria"],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Esconder o menu não é controle de acesso: cada página e cada ação revalidam, e o banco também.
  const { user } = await requirePage("admin");
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Administração" className="flex flex-wrap gap-2 border-b border-border pb-3">
        {LINKS.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm text-text no-underline hover:bg-surface-2">
            {label}
          </Link>
        ))}
      </nav>
      {user.adminReadOnly ? (
        <Notice tone="warning">
          <strong>Transição em andamento:</strong> os cadastros ainda são mantidos no hub antigo e copiados para cá. Esta área
          está em modo somente leitura até o corte.
        </Notice>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
