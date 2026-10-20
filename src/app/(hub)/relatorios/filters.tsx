import { buttonClass } from "@/components/ui/button";
import { controlClass, SelectField } from "@/components/ui/field";
import type { FilterOptions, ReportFilters } from "@/features/reports/queries";
import type { Period } from "@/lib/reports/period";

/** Filtros numa faixa acima do conteúdo; GET preserva o estado na URL (compartilhável, funciona sem JS). */
export function ReportFiltersForm({
  period,
  filters,
  options,
  action = "/relatorios",
  showApp = true,
}: {
  period: Period;
  filters: ReportFilters;
  options: FilterOptions;
  action?: string;
  showApp?: boolean;
}) {
  return (
    <form
      method="get"
      action={action}
      className={`grid gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 md:p-5 sm:grid-cols-2 ${
        showApp ? "xl:grid-cols-[minmax(16rem,1.4fr)_1fr_1fr_1fr_auto]" : "xl:grid-cols-[minmax(16rem,1.4fr)_1fr_1fr_auto]"
      }`}
    >
      <fieldset className="flex flex-col gap-1.5 sm:col-span-2 xl:col-span-1">
        <legend className="mb-1.5 text-sm font-medium">Período</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col">
            <span className="sr-only">Data inicial</span>
            <input name="de" type="date" defaultValue={period.from} required className={controlClass} aria-label="Data inicial" />
          </label>
          <label className="flex flex-col">
            <span className="sr-only">Data final</span>
            <input name="ate" type="date" defaultValue={period.to} required className={controlClass} aria-label="Data final" />
          </label>
        </div>
      </fieldset>
      <SelectField id="dpto" label="Departamento" defaultValue={filters.dptoId ?? ""}>
        <option value="">Todos no meu escopo</option>
        {options.dptos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
      <SelectField id="colaborador" label="Colaborador" defaultValue={filters.userId ?? ""}>
        <option value="">Todos no meu escopo</option>
        {options.users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </SelectField>
      {showApp ? (
        <SelectField id="app" label="Aplicação" defaultValue={filters.appId ?? ""}>
          <option value="">Todas</option>
          {options.apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      ) : null}
      <div className="flex items-end sm:col-span-2 xl:col-span-1">
        <button type="submit" className={buttonClass("primary", "w-full px-6")}>
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
