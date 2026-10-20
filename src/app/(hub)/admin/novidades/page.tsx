import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalUuid, parsePage } from "@/lib/reports/pagination";
import { formatDateTime } from "@/lib/reports/period";
import { utcToZonedLocal } from "@/lib/time";
import { NoteForm } from "./form";

export const metadata: Metadata = { title: "Novidades (admin)" };
const PAGE_SIZE = 20;
const isScheduled = (iso: string) => Date.parse(iso) > Date.now();

export default async function AdminNewsPage({ searchParams }: PageProps<"/admin/novidades">) {
  const { supabase, user } = await requirePage("admin");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  const editId = parseOptionalUuid(sp.editar);
  const [{ data: news, count }, { data: editing }] = await Promise.all([
    supabase
      .from("luzia_news")
      .select("id, title, version, published_at", { count: "exact" })
      .order("published_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    editId ? supabase.from("luzia_news").select("*").eq("id", editId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <>
      <PageHeader title="Novidades" description="Conteúdo exibido como texto puro; HTML não é interpretado. As novidades do hub antigo não foram migradas." />
      <div className={`grid gap-8 ${user.adminReadOnly ? "" : "lg:grid-cols-[1fr_1fr]"}`}>
        {user.adminReadOnly ? null : (
          <section aria-labelledby="form-novidade">
            <h2 id="form-novidade" className="mb-3 font-semibold">
              {editing ? "Editar novidade" : "Nova novidade"}
            </h2>
            <NoteForm
              key={editing?.id ?? "nova"}
              note={
                editing
                  ? { id: editing.id, title: editing.title, body: editing.body, version: editing.version, publishLocal: utcToZonedLocal(editing.published_at) }
                  : undefined
              }
              defaultPublishLocal={utcToZonedLocal(new Date().toISOString())}
            />
            {editing ? (
              <p className="mt-3 text-sm">
                <Link href="/admin/novidades">Cancelar edição</Link>
              </p>
            ) : null}
          </section>
        )}
        <section aria-labelledby="hist-novidades">
          <h2 id="hist-novidades" className="mb-3 font-semibold">
            Histórico
          </h2>
          {!news?.length ? (
            <p className="text-sm text-muted">Nenhuma novidade cadastrada no hub novo.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {news.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-muted">
                      {formatDateTime(n.published_at)}
                      {n.version ? ` · v${n.version}` : ""}
                      {isScheduled(n.published_at) ? " · agendada" : ""}
                    </p>
                  </div>
                  {user.adminReadOnly ? null : (
                    <Link href={`/admin/novidades?editar=${n.id}`} aria-label={`Editar ${n.title}`}>
                      Editar
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/novidades?pagina=${p}`} />
        </section>
      </div>
    </>
  );
}
