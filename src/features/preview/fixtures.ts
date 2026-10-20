// Dados SINTÉTICOS para a pré-visualização de interface (src/app/dev/preview). Nunca usados com o banco.
import type { ShellUser } from "@/components/app-shell";
import type { CatalogApp } from "@/features/catalog/types";
import type { BellNewsItem } from "@/components/shell/news-bell";

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

// Mesmo texto de supabase/content/novidades/20261020_novo-luzia.sql (mais recente primeiro).
export const PREVIEW_NEWS: BellNewsItem[] = [
  { id: "n1", title: "As novidades agora ficam no sininho", body: "Sempre que algo mudar no Luz.IA, o resumo aparece aqui, no sininho no alto da tela. A bolinha amarela indica que há novidade publicada nos últimos dias.", version: "2.3", publishedAt: "2026-10-20T15:30:00-03:00" },
  { id: "n2", title: "Aplicações em tela cheia", body: "Ao abrir uma aplicação, ela agora ocupa toda a área da tela, sem margens.\n\nPrecisa de ainda mais espaço? Use o botão Tela cheia, na barra da aplicação. Para sair, aperte Esc.", version: "2.2", publishedAt: "2026-10-20T15:00:00-03:00" },
  { id: "n3", title: "Relatórios mais completos para gestores", body: "Quem acompanha a equipe agora vê, para qualquer período:\n\n• total de aberturas, de colaboradores e de aplicações acessadas;\n• um gráfico dia a dia e as aplicações mais usadas;\n• o histórico completo, com ordenação por qualquer coluna.\n\nOs números consideram todo o período escolhido.", version: "2.1", publishedAt: "2026-10-20T14:10:00-03:00" },
  { id: "n4", title: "Boas-vindas ao novo Luz.IA", body: "O Luz.IA foi reconstruído para ficar mais organizado e fácil de usar.\n\n• Menu lateral com tudo à mão — dá para recolhê-lo quando você precisar de mais espaço.\n• Catálogo com as aplicações do seu departamento e busca por nome.\n• Tema claro ou escuro: escolha no ícone ao lado do sininho.\n\nVocê continua entrando com a sua conta Microsoft do escritório, como sempre. Algumas aplicações ainda podem pedir login enquanto finalizamos a integração com o novo Luz.IA.", version: "2.0", publishedAt: "2026-10-20T14:00:00-03:00" },
];

// Série sintética determinística (não é estatística real).
const DAILY = [68, 72, 75, 92, 118, 101, 80, 72, 91, 103, 112, 86, 61, 71, 79, 78, 103, 119, 105, 92];

export const PREVIEW_METRICS = {
  total_opens: 1284,
  distinct_collaborators: 86,
  distinct_applications: 6,
  top_applications: [
    { application_id: "a1", name: "Fisco Check", total: 482 },
    { application_id: "a2", name: "Mensagens (e-CAC)", total: 316 },
    { application_id: "a3", name: "contcheck", total: 221 },
    { application_id: "a4", name: "PERDCOMP", total: 148 },
    { application_id: "a5", name: "Boas-vindas", total: 76 },
    { application_id: "a6", name: "CPA Tax Planner", total: 41 },
  ],
  daily: DAILY.map((total, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, total })),
};

export const PREVIEW_REPORT_ROWS = [
  ["Alex Martins", "Administração", "Fisco Check", "2026-10-20T19:24:00Z"],
  ["Camila Souza", "Fiscal", "contcheck", "2026-10-20T17:11:00Z"],
  ["Bruno Lima", "Contábil", "Mensagens (e-CAC)", "2026-10-20T14:03:00Z"],
  ["Daniela Rocha", "Tributário", "PERDCOMP", "2026-10-20T12:47:00Z"],
].map(([name, dept, app, at], i) => ({
  event_id: i + 1,
  opened_at: at!,
  collaborator_id: i + 1,
  collaborator_name: name!,
  department_id: i + 1,
  department_name: dept!,
  application_id: `a${i + 1}`,
  application_name: app!,
  total_count: 1284,
}));

export const PREVIEW_FILTER_OPTIONS = {
  users: [{ id: 1, name: "Alex Martins", dptoId: 1 }, { id: 2, name: "Camila Souza", dptoId: 2 }],
  apps: PREVIEW_APPS.map((a) => ({ id: a.id, name: a.name })),
  dptos: [{ id: 1, name: "Administração" }, { id: 2, name: "Fiscal" }, { id: 3, name: "Contábil" }, { id: 4, name: "Tributário" }],
};
