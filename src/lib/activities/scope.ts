import { HUB_TZ, zonedLocalToUtc } from "../time";
import type { ScopeUser } from "./types";

/** Instante UTC da meia-noite de uma data civil (padrão: São Paulo). */
export function civilMidnightUtc(isoDate: string, timeZone = HUB_TZ): string {
  const utc = zonedLocalToUtc(isoDate, timeZone);
  if (!utc) throw new Error("data inválida");
  return utc;
}

/** Aplica filtros opcionais sobre o escopo autorizado (nunca o amplia). */
export function narrowScope(scope: readonly ScopeUser[], filters: { userId: number | null; dptoId: number | null }): ScopeUser[] {
  return scope.filter(
    (u) => (filters.userId === null || u.userId === filters.userId) && (filters.dptoId === null || u.dptoId === filters.dptoId),
  );
}
