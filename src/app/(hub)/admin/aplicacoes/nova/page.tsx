import { redirect } from "next/navigation";

// Edição agora acontece no painel lateral da lista.
export default function NewAppRedirect() {
  redirect("/admin/aplicacoes?nova=1");
}
