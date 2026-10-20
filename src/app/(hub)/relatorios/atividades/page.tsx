import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, ErrorState, Notice } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { fetchActivities } from "@/features/activities/service";
import { loadFilterOptions } from "@/features/reports/queries";
import { ACTIVITY_ADAPTERS } from "@/lib/activities/registry";
import { requirePage } from "@/lib/auth/session";
import { buildQuery, parseOptionalId, parsePage } from "@/lib/reports/pagination";
import { formatDateTime, resolvePeriod } from "@/lib/reports/period";
import { ReportFiltersForm } from "../filters";
import { ReportTabs } from "../tabs";

export const metadata: Metadata = { title: "Atividades" };
const PAGE_SIZE = 25;

export default async function ActivitiesPage({ searchParams }: PageProps<"/relatorios/atividades">) {
  const { supabase } = await requirePage("relatorios");
  const sp = await searchParams;
  const period = resolvePeriod(sp.de, sp.ate);
  const userId = parseOptionalId(sp.colaborador);
  const dptoId = parseOptionalId(sp.dpto);
  const source = typeof sp.fonte === "string" && ACTIVITY_ADAPTERS.some((a) => a.id === sp.fonte) ? sp.fonte : ACTIVITY_ADAPTERS[0]!.id;
  const page = parsePage(sp.pagina);

  const [options, result] = await Promise.all([
    loadFilterOptions(supabase),
    fetchActivities(supabase, { source, from: period.from, to: period.to, userId, dptoId, page, pageSize: PAGE_SIZE }),
  ]);
  const base = { de: period.from, ate: period.to, colaborador: userId, dpto: dptoId };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight md:text-[32px]">Atividades nas aplicações</h1>
        <p className="mt-1.5 text-base text-muted">O que foi feito dentro das aplicações integradas, no seu escopo.</p>
      </div>
      <ReportTabs current="atividades" />
      <ReportFiltersForm
        period={period}
        filters={{ from: period.from, to: period.to, appId: null, userId, dptoId }}
        options={options}
        action="/relatorios/atividades"
        showApp={false}
      />
      <nav aria-label="Fonte de atividades" className="flex flex-wrap gap-2">
        {ACTIVITY_ADAPTERS.map((a) => (
          <Link
            key={a.id}
            href={`/relatorios/atividades${buildQuery({ ...base, fonte: a.id })}`}
            aria-current={a.id === source ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm no-underline ${
              a.id === source ? "border-brand bg-brand-soft font-medium text-text" : "border-control text-text hover:bg-surface-2"
            }`}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      <p className="text-xs text-muted">
        Atividades vêm das aplicações e são conciliadas pelo e-mail corporativo; colaboradores com e-mail diferente na aplicação
        não aparecem. Somente colaboradores do seu escopo são consultados.
      </p>

      {result.status === "nao_suportado" ? (
        <Notice tone="info">{result.message}</Notice>
      ) : result.status === "indisponivel" ? (
        <ErrorState title="Integração indisponível">{result.message}</ErrorState>
      ) : result.status === "vazio" ? (
        <EmptyState title="Sem atividades no período" />
      ) : (
        <section aria-label="Atividades" className="rounded-[var(--radius-card)] border border-border bg-surface">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Data e hora</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Colaborador</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Tipo</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((i) => (
                  <tr key={`${i.source}:${i.id}`} className="border-b border-border last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3">{formatDateTime(i.occurredAt)}</td>
                    <td className="px-5 py-3">{i.userName}</td>
                    <td className="px-5 py-3">{i.type}</td>
                    <td className="px-5 py-3">{i.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={result.total}
            hrefFor={(p) => `/relatorios/atividades${buildQuery({ ...base, fonte: source, pagina: p })}`}
          />
        </section>
      )}
    </div>
  );
}
