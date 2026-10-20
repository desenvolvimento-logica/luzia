import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { requirePage } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/reports/period";
import { parsePage } from "@/lib/reports/pagination";

export const metadata: Metadata = { title: "Novidades" };
const PAGE_SIZE = 10;

export default async function NewsPage({ searchParams }: PageProps<"/novidades">) {
  const { supabase } = await requirePage();
  const page = parsePage((await searchParams).pagina);
  const from = (page - 1) * PAGE_SIZE;
  // O RLS só devolve novidades já publicadas (agendadas ficam visíveis apenas a administradores).
  const { data, count, error } = await supabase
    .from("luzia_news")
    .select("id, title, body, version, published_at", { count: "exact" })
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  return (
    <>
      <PageHeader title="Novidades" description="Mudanças e avisos do Luz.IA." />
      {error ? (
        <ErrorState>Não foi possível carregar as novidades.</ErrorState>
      ) : !data?.length ? (
        <EmptyState title="Nenhuma novidade publicada" />
      ) : (
        <ol className="flex flex-col gap-4">
          {data.map((n) => (
            <li key={n.id} className="rounded-lg border border-border bg-surface p-5">
              <article>
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold">{n.title}</h2>
                  {n.version ? <span className="rounded bg-surface-2 px-2 py-0.5 text-xs">v{n.version}</span> : null}
                  <time dateTime={n.published_at} className="text-xs text-muted">
                    {formatDateTime(n.published_at)}
                  </time>
                </header>
                {/* Texto puro: nenhum HTML do conteúdo é interpretado. */}
                <p className="mt-2 whitespace-pre-line text-sm">{n.body}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/novidades?pagina=${p}`} />
    </>
  );
}
