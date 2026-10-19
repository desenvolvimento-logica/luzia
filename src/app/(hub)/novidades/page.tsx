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
    .from("patch_notes")
    .select("note_id, note_title, note_body, note_version, dt_publish", { count: "exact" })
    .lte("dt_publish", new Date().toISOString())
    .order("dt_publish", { ascending: false })
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
            <li key={n.note_id} className="rounded-lg border border-border bg-surface p-5">
              <article>
                <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-lg font-semibold">{n.note_title}</h2>
                  {n.note_version ? <span className="rounded bg-surface-2 px-2 py-0.5 text-xs">v{n.note_version}</span> : null}
                  <time dateTime={n.dt_publish} className="text-xs text-muted">
                    {formatDateTime(n.dt_publish)}
                  </time>
                </header>
                {/* Texto puro: nenhum HTML do conteúdo é interpretado. */}
                <p className="mt-2 whitespace-pre-line text-sm">{n.note_body}</p>
              </article>
            </li>
          ))}
        </ol>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/novidades?pagina=${p}`} />
    </>
  );
}
