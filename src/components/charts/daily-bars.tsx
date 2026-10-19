"use client";

import { useState } from "react";
import { formatCivilDay } from "@/lib/reports/period";

/** Série única (aberturas por dia). Tooltip por barra no hover e no foco; tabela equivalente abaixo. */
export function DailyBars({ data, title }: { data: { day: string; total: number }[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 720;
  const height = 180;
  const pad = { top: 12, right: 8, bottom: 24, left: 36 };
  const max = Math.max(1, ...data.map((d) => d.total));
  const step = (width - pad.left - pad.right) / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(18, step - 2));
  const plotH = height - pad.top - pad.bottom;
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.ceil(data.length / 8);
  const current = active !== null ? data[active] : null;

  return (
    <figure className="relative">
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="group" aria-label={title} onPointerLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
              {t.toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * step + (step - barW) / 2;
          const top = y(d.total);
          const h = pad.top + plotH - top;
          const r = Math.min(4, barW / 2, h);
          return (
            <g
              key={d.day}
              tabIndex={0}
              role="img"
              aria-label={`${formatCivilDay(d.day)}: ${d.total.toLocaleString("pt-BR")} aberturas`}
              onPointerEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              {/* Área de toque maior que a barra: coluna inteira. */}
              <rect x={pad.left + i * step} y={pad.top} width={step} height={plotH} fill="transparent" />
              {h > 0 ? (
                <path
                  d={`M${x},${pad.top + plotH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + plotH} Z`}
                  fill="var(--chart)"
                  opacity={active === null || active === i ? 1 : 0.55}
                />
              ) : null}
              {active === i ? <rect x={pad.left + i * step} y={pad.top} width={step} height={plotH} fill="none" stroke="var(--focus)" strokeWidth={1.5} /> : null}
              {i % labelEvery === 0 ? (
                <text x={pad.left + i * step + step / 2} y={height - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                  {formatCivilDay(d.day)}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} stroke="var(--border)" />
      </svg>
      {current ? (
        <div
          role="status"
          className="pointer-events-none absolute right-2 top-0 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow"
        >
          <strong className="block text-base">{current.total.toLocaleString("pt-BR")}</strong>
          <span className="text-muted">aberturas em {formatCivilDay(current.day)}</span>
        </div>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Ver em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-1 font-medium">Dia</th>
                <th scope="col" className="py-1 text-right font-medium">Aberturas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1">{formatCivilDay(d.day)}</td>
                  <td className="py-1 text-right tabular-nums">{d.total.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
