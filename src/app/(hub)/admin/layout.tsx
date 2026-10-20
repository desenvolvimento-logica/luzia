import type { ReactNode } from "react";
import { Notice } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // A navegação de administração fica no menu lateral. Esconder itens não é controle de acesso:
  // cada página e cada ação revalidam, e o banco também.
  const { user } = await requirePage("admin");
  return (
    <div className="flex flex-col gap-6">
      {user.adminReadOnly ? (
        <Notice tone="warning">
          <strong>Transição em andamento:</strong> colaboradores, departamentos e aplicações ainda são mantidos no hub antigo e
          copiados para cá, por isso ficam somente para consulta até o corte. As novidades podem ser publicadas normalmente.
        </Notice>
      ) : null}
      <div>{children}</div>
    </div>
  );
}
