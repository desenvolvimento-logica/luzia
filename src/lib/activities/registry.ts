import { createEmailProfileAdapter, type EmailProfileMapping } from "./email-profile-adapter";
import type { ActivityAdapter, ActivitySourceId } from "./types";

const PENDING = "Integração ainda não suportada: o schema real desta aplicação precisa ser confirmado antes de ligar a consulta.";

// A spec operacional cita as tabelas (Fisco Check: profiles/comparisons; Tributário: perfis/acoes/mensagens/boas_vindas),
// mas não as colunas. Preencher a partir do schema verificado (docs/decisoes.md X-06) e cobrir com teste.
const FISCOCHECK_MAPPING: EmailProfileMapping | null = null;
const TRIBUTARIO_MAPPING: EmailProfileMapping | null = null;

export const ACTIVITY_ADAPTERS: readonly ActivityAdapter[] = [
  createEmailProfileAdapter("fiscocheck", "Fisco Check", FISCOCHECK_MAPPING, PENDING),
  createEmailProfileAdapter("tributario", "Mensagens e Boas-vindas", TRIBUTARIO_MAPPING, PENDING),
];

export function findAdapter(id: string): ActivityAdapter | undefined {
  return ACTIVITY_ADAPTERS.find((a) => a.id === (id as ActivitySourceId));
}
