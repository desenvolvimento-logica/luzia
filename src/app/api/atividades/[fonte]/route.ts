import { type NextRequest, NextResponse } from "next/server";
import { fetchActivities } from "@/features/activities/service";
import { AuthorizationError, requireAction } from "@/lib/auth/session";
import { parseOptionalId, parsePage, parsePageSize } from "@/lib/reports/pagination";
import { resolvePeriod } from "@/lib/reports/period";

// Sem parâmetro de debug: diagnóstico de e-mails fora do escopo não é exposto (spec 6).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/atividades/[fonte]">) {
  const { fonte } = await ctx.params;
  try {
    const { supabase } = await requireAction("relatorios");
    const q = request.nextUrl.searchParams;
    const period = resolvePeriod(q.get("de"), q.get("ate"));
    const result = await fetchActivities(supabase, {
      source: fonte,
      from: period.from,
      to: period.to,
      userId: parseOptionalId(q.get("colaborador")),
      dptoId: parseOptionalId(q.get("dpto")),
      page: parsePage(q.get("pagina")),
      pageSize: parsePageSize(q.get("tamanho")),
    });
    const status = result.status === "indisponivel" ? 503 : result.status === "nao_suportado" ? 501 : 200;
    return NextResponse.json({ periodo: period, ...result }, { status, headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ erro: "nao_autorizado" }, { status: 403 });
    return NextResponse.json({ erro: "falha_interna" }, { status: 500 });
  }
}
