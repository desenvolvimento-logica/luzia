import { redirect } from "next/navigation";
import { parseOptionalUuid } from "@/lib/reports/pagination";

// Edição agora acontece no painel lateral da lista; mantém links antigos funcionando.
export default async function EditAppRedirect({ params }: PageProps<"/admin/aplicacoes/[id]">) {
  const id = parseOptionalUuid((await params).id);
  redirect(id ? `/admin/aplicacoes?editar=${id}` : "/admin/aplicacoes");
}
