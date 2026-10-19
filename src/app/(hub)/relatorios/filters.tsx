import { buttonClass } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import type { FilterOptions, ReportFilters } from "@/features/reports/queries";
import type { Period } from "@/lib/reports/period";

/** Filtros em uma linha acima do conteúdo; GET preserva o estado na URL (compartilhável, sem JS). */
export function ReportFiltersForm({
  period,
  filters,
  options,
  action = "/relatorios",
}: {
  period: Period;
  filters: ReportFilters;
  options: FilterOptions;
  action?: string;
}) {
  return (
    <form method="get" action={action} className="mb-4 grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6">
      <TextField id="de" label="De" type="date" defaultValue={period.from} required />
      <TextField id="ate" label="Até" type="date" defaultValue={period.to} required />
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
      <SelectField id="app" label="Aplicação" defaultValue={filters.appId ?? ""}>
        <option value="">Todas</option>
        {options.apps.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </SelectField>
      <div className="flex items-end">
        <button type="submit" className={buttonClass("primary", "w-full")}>
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}
