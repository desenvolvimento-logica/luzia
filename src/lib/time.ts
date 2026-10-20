// Conversões de fuso via Intl (sem tabela própria). Armazenamento sempre em UTC.
export const HUB_TZ = "America/Sao_Paulo";

export function offsetMinutes(instant: Date, timeZone: string): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

const LOCAL = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm" no fuso informado → ISO UTC. Null se inválido. */
export function zonedLocalToUtc(local: string, timeZone = HUB_TZ): string | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const asUtc = new Date(`${m[1]}T${m[2] ?? "00"}:${m[3] ?? "00"}:00Z`);
  if (Number.isNaN(asUtc.getTime()) || asUtc.toISOString().slice(0, 10) !== m[1]) return null;
  const first = asUtc.getTime() - offsetMinutes(asUtc, timeZone) * 60_000;
  // Segunda passada corrige datas de mudança de horário (casos históricos de horário de verão).
  const second = asUtc.getTime() - offsetMinutes(new Date(first), timeZone) * 60_000;
  return new Date(second).toISOString();
}

/** ISO UTC → "YYYY-MM-DDTHH:mm" no fuso informado (valor de <input type="datetime-local">). */
export function utcToZonedLocal(iso: string, timeZone = HUB_TZ): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() + offsetMinutes(d, timeZone) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** Ano corrente em São Paulo (rodapés). */
export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: HUB_TZ, year: "numeric" }).format(now));
}
