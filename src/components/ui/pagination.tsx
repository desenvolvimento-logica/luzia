import Link from "next/link";

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const link = "rounded-md border border-border px-3 py-2 text-sm min-h-10 inline-flex items-center hover:bg-surface-2";
  return (
    <nav aria-label="Paginação" className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">
        Página {page} de {pages} · {total.toLocaleString("pt-BR")} registros
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={link} href={hrefFor(page - 1)} rel="prev">
            Anterior
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={link} href={hrefFor(page + 1)} rel="next">
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
