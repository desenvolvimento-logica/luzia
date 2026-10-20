"use client";

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { formatCivilDay } from "@/lib/reports/period";

interface Point {
  day: string;
  total: number;
}

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/**
 * Série única (aberturas por dia): linha 2 px com área suave, eixos discretos, cruz que acompanha o ponteiro
 * e as setas do teclado; tabela equivalente abaixo. Cores: --chart (≥3:1 nos dois temas).
 */
export function DailyLine({ data, title }: { data: Point[]; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLElement>(null);
  const gradId = useId();
  // O viewBox acompanha a largura real: texto dos eixos fica em 12 px em qualquer tela.
  const [width, setWidth] = useState(760);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width < 520;
  const height = narrow ? 200 : 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.total)));
  const x = (i: number) => pad.left + (data.length <= 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v: number) => pad.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max].map((t) => Math.round(t));
  const labelEvery = Math.max(1, Math.ceil(data.length / (narrow ? 4 : 10)));

  const { line, area } = useMemo(() => {
    const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.total).toFixed(1)}`);
    return {
      line: pts.length ? `M${pts.join(" L")}` : "",
      area: pts.length ? `M${x(0).toFixed(1)},${pad.top + plotH} L${pts.join(" L")} L${x(data.length - 1).toFixed(1)},${pad.top + plotH} Z` : "",
    };
    // x/y dependem apenas de data, max e da largura medida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, max, width, height]);

  function pick(clientX: number) {
    const svg = svgRef.current;
    if (!svg || data.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    const ratio = (px - pad.left) / plotW;
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  }

  function onKey(e: KeyboardEvent) {
    if (data.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      setActive((a) => Math.min(data.length - 1, Math.max(0, (a ?? (delta > 0 ? -1 : data.length)) + delta)));
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(data.length - 1);
    else if (e.key === "Escape") setActive(null);
  }

  const current = active !== null ? data[active] : null;
  const tipLeft = active !== null ? (x(active) / width) * 100 : 0;

  return (
    <figure className="relative" ref={boxRef}>
      <figcaption className="sr-only">{title}</figcaption>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none outline-none"
        role="img"
        aria-label={`${title}. Use as setas para percorrer os dias.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="var(--muted)">
              {t.toLocaleString("pt-BR")}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text key={d.day} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} fontSize={12} fill="var(--muted)">
              {formatCivilDay(d.day)}
            </text>
          ) : null,
        )}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {current && active !== null ? (
          <g>
            <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + plotH} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(active)} cy={y(current.total)} r={5} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        ) : null}
      </svg>
      {current ? (
        <div
          role="status"
          className="pointer-events-none absolute top-1 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: `clamp(4rem, ${tipLeft}%, calc(100% - 4rem))` }}
        >
          <strong className="block text-base tabular-nums">{current.total.toLocaleString("pt-BR")}</strong>
          <span className="text-muted">aberturas em {formatCivilDay(current.day)}</span>
        </div>
      ) : null}
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-muted">Ver em tabela</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th scope="col" className="py-1.5 font-medium">Dia</th>
                <th scope="col" className="py-1.5 text-right font-medium">Aberturas</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.day} className="border-t border-border">
                  <td className="py-1.5">{formatCivilDay(d.day)}</td>
                  <td className="py-1.5 text-right tabular-nums">{d.total.toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
