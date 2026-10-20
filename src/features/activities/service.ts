import "server-only";
import { findAdapter } from "@/lib/activities/registry";
import { civilMidnightUtc, narrowScope } from "@/lib/activities/scope";
import type { ActivityResult, ScopeUser, ServiceClientLike } from "@/lib/activities/types";
import { addDays } from "@/lib/reports/period";
import { serviceRoleSupabase } from "@/lib/supabase/admin";
import type { HubSupabase } from "@/lib/supabase/server";

export interface ActivityRequest {
  source: string;
  from: string;
  to: string;
  userId: number | null;
  dptoId: number | null;
  page: number;
  pageSize: number;
}

/**
 * 1) escopo resolvido no banco com a sessão do solicitante (luzia_report_scope exige relatório e aplica a matriz);
 * 2) só então o adaptador usa a service role, restrito aos e-mails desse escopo.
 */
export async function fetchActivities(supabase: HubSupabase, req: ActivityRequest): Promise<ActivityResult> {
  const adapter = findAdapter(req.source);
  if (!adapter) return { status: "nao_suportado", message: "Fonte de atividades desconhecida." };

  const { data, error } = await supabase.rpc("luzia_report_scope");
  if (error) return { status: "indisponivel", message: "Não foi possível resolver seu escopo de visibilidade." };
  const scope: ScopeUser[] = (data ?? []).map((u) => ({ userId: u.collaborator_id, name: u.name, email: u.email, dptoId: u.department_id }));

  return adapter.fetch(
    narrowScope(scope, { userId: req.userId, dptoId: req.dptoId }),
    { fromUtc: civilMidnightUtc(req.from), toUtcExclusive: civilMidnightUtc(addDays(req.to, 1)), page: req.page, pageSize: req.pageSize },
    serviceRoleSupabase() as unknown as ServiceClientLike | null,
  );
}
