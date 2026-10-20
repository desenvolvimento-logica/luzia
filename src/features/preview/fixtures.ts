// Dados SINTÉTICOS para a pré-visualização de interface (src/app/dev/preview). Nunca usados com o banco.
import type { ShellUser } from "@/components/app-shell";
import type { CatalogApp } from "@/features/catalog/types";
import type { CatalogNews } from "@/features/catalog/catalog-view";

export const PREVIEW_COLLABORATOR: ShellUser = {
  name: "Camila Souza",
  email: "camila.souza@exemplo.test",
  dptoName: "Tributário",
  role: "usuario",
  isAdmin: false,
  canSeeReports: false,
};

export const PREVIEW_ADMIN: ShellUser = {
  name: "Alex Martins",
  email: "alex.martins@exemplo.test",
  dptoName: "Administração",
  role: "gerente",
  isAdmin: true,
  canSeeReports: true,
};

export const PREVIEW_APPS: CatalogApp[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Mensagens (e-CAC)", description: "Organize as mensagens e obrigações do e-CAC.", icon: "✉️" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Boas-vindas", description: "Prepare a recepção de novos clientes.", icon: "🤝" },
  { id: "00000000-0000-4000-8000-000000000003", name: "PERDCOMP", description: "Acompanhe declarações e compensações.", icon: "📄" },
  { id: "00000000-0000-4000-8000-000000000004", name: "CPA Tax Planner", description: "Planeje cenários tributários com clareza.", icon: "📊" },
];

export const PREVIEW_NEWS: CatalogNews[] = [
  { id: "n1", title: "Novo visual do Luz.IA", body: "Menu lateral, catálogo reorganizado e tema escuro revisado.", publishedAt: "2026-10-20T15:00:00Z" },
  { id: "n2", title: "Relatórios por período", body: "Totais calculados sobre todo o período, no fuso de Brasília.", publishedAt: "2026-10-19T12:00:00Z" },
];
