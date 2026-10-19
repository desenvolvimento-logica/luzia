import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { requirePage } from "@/lib/auth/session";
import { parseOptionalId, parsePage } from "@/lib/reports/pagination";
import { formatDateTime } from "@/lib/reports/period";
import { utcToZonedLocal } from "@/lib/time";
import { NoteForm } from "./form";

export const metadata: Metadata = { title: "Novidades (admin)" };
const PAGE_SIZE = 20;
const isScheduled = (iso: string) => Date.parse(iso) > Date.now();

export default async function AdminNotesPage({ searchParams }: PageProps<"/admin/novidades">) {
  const { supabase } = await requirePage("admin");
  const sp = await searchParams;
  const page = parsePage(sp.pagina);
  const editId = parseOptionalId(sp.editar);
  const [{ data: notes, count }, { data: editing }] = await Promise.all([
    supabase
      .from("patch_notes")
      .select("note_id, note_title, note_version, dt_publish", { count: "exact" })
      .order("dt_publish", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    editId ? supabase.from("patch_notes").select("*").eq("note_id", editId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <PageHeader title="Novidades" description="Conteúdo exibido como texto puro; HTML não é interpretado." />
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section aria-labelledby="form-novidade">
          <h2 id="form-novidade" className="mb-3 font-semibold">
            {editing ? "Editar novidade" : "Nova novidade"}
          </h2>
          <NoteForm
            key={editing?.note_id ?? "nova"}
            note={
              editing
                ? {
                    id: editing.note_id,
                    title: editing.note_title,
                    body: editing.note_body,
                    version: editing.note_version,
                    publishLocal: utcToZonedLocal(editing.dt_publish),
                  }
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
        <section aria-labelledby="hist-novidades">
          <h2 id="hist-novidades" className="mb-3 font-semibold">
            Histórico
          </h2>
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {(notes ?? []).map((n) => (
              <li key={n.note_id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{n.note_title}</p>
                  <p className="text-xs text-muted">
                    {formatDateTime(n.dt_publish)}
                    {n.note_version ? ` · v${n.note_version}` : ""}
                    {isScheduled(n.dt_publish) ? " · agendada" : ""}
                  </p>
                </div>
                <Link href={`/admin/novidades?editar=${n.note_id}`} aria-label={`Editar ${n.note_title}`}>
                  Editar
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} hrefFor={(p) => `/admin/novidades?pagina=${p}`} />
        </section>
      </div>
    </>
  );
}
