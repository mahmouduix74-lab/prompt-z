/**
 * Small hand-drawn charts for the admin dashboard: one series each, thin marks, a recessive grid,
 * and a hover tooltip on every mark. Colours come from the CSS variables set on .admin-root.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const fmt = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? '–' : new Intl.NumberFormat('en-US').format(n));
export const compact = (n: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    setWidth(ref.current.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Rounds the top of the axis to a clean number, and gives about 4 ticks up to it (whole numbers: these are counts). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw);
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

interface Tip {
  x: number;
  y: number;
  title: string;
  value: string;
}

function Tooltip({ tip, width }: { tip: Tip | null; width: number }) {
  if (!tip) return null;
  // Keep the box inside the chart: flip to the left of the pointer near the right edge.
  const left = tip.x > width - 150 ? tip.x - 12 : tip.x + 12;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg whitespace-nowrap"
      style={{ left, top: Math.max(0, tip.y - 44), transform: tip.x > width - 150 ? 'translateX(-100%)' : undefined }}
    >
      <div className="text-zinc-500 dark:text-zinc-400">{tip.title}</div>
      <div className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{tip.value}</div>
    </div>
  );
}

const PAD = { top: 12, right: 12, bottom: 26, left: 36 };

/** The first and last day labels sit inside the plot instead of overflowing its edges. */
const anchor = (i: number, count: number) => (i === 0 && count > 1 ? 'start' : i === count - 1 && count > 1 ? 'end' : 'middle');

/** Every few days, plus the last day; a regular label too close to the last one is skipped. */
const showLabel = (i: number, count: number, every: number) => i === count - 1 || (i % every === 0 && count - 1 - i >= every * 0.75);

interface SeriesProps {
  labels: string[];
  /** Full date for the tooltip, one per label. */
  titles: string[];
  values: number[];
  /** Unit after the number in the tooltip, e.g. "prompts". */
  unit: string;
  height?: number;
}

/** Change over time for one measure: a 2px line over a light wash, with a crosshair on hover. */
export function LineChart({ labels, titles, values, unit, height = 220 }: SeriesProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...values, 0));
  const top = ticks[ticks.length - 1] || 1;
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (values.length > 1 ? (i / (values.length - 1)) * w : w / 2);
  const y = (v: number) => PAD.top + h - (v / top) * h;
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = values.length ? `${line}L${x(values.length - 1).toFixed(1)},${PAD.top + h}L${x(0).toFixed(1)},${PAD.top + h}Z` : '';
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(w / 64))));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    const i = values.length > 1 ? Math.round(((px - PAD.left) / w) * (values.length - 1)) : 0;
    setHover(Math.min(values.length - 1, Math.max(0, i)));
  };

  return (
    <div ref={ref} className="relative w-full" dir="ltr">
      {width > 0 && (
        <svg width={width} height={height} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 dark:fill-zinc-400 text-[11px] tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {labels.map((l, i) =>
            showLabel(i, labels.length, every) ? (
              <text key={i} x={x(i)} y={height - 8} textAnchor={anchor(i, labels.length)} className="fill-zinc-500 dark:fill-zinc-400 text-[11px]">
                {l}
              </text>
            ) : null
          )}
          <path d={area} fill="var(--series)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--series)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} stroke="var(--crosshair)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(values[hover])} r={5} fill="var(--series)" stroke="var(--surface)" strokeWidth={2} />
            </>
          )}
          {/* The latest value, labelled at the end of the line */}
          {values.length > 0 && hover == null && (
            <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={4} fill="var(--series)" stroke="var(--surface)" strokeWidth={2} />
          )}
        </svg>
      )}
      <Tooltip tip={hover != null ? { x: x(hover), y: y(values[hover]), title: titles[hover], value: `${fmt(values[hover])} ${unit}` } : null} width={width} />
    </div>
  );
}

/** Counts per day as columns (e.g. new accounts), each column its own hover target. */
export function ColumnChart({ labels, titles, values, unit, height = 220 }: SeriesProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...values, 0));
  const top = ticks[ticks.length - 1] || 1;
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = height - PAD.top - PAD.bottom;
  const band = values.length ? w / values.length : w;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v: number) => PAD.top + h - (v / top) * h;
  const every = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(w / 64))));
  const r = Math.min(4, barW / 2);

  return (
    <div ref={ref} className="relative w-full" dir="ltr">
      {width > 0 && (
        <svg width={width} height={height} onPointerLeave={() => setHover(null)} className="block touch-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={PAD.left + w} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 dark:fill-zinc-400 text-[11px] tabular-nums">
                {compact(t)}
              </text>
            </g>
          ))}
          {values.map((v, i) => {
            const cx = PAD.left + band * i + band / 2;
            const bh = Math.max(0, PAD.top + h - y(v));
            const x0 = cx - barW / 2;
            const yTop = PAD.top + h - bh;
            // Rounded data end, square at the baseline.
            const d =
              bh > r
                ? `M${x0},${PAD.top + h}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + barW - r}Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r}V${PAD.top + h}Z`
                : `M${x0},${PAD.top + h}V${yTop}H${x0 + barW}V${PAD.top + h}Z`;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={h} fill="transparent" />
                {v > 0 && <path d={d} fill="var(--series)" opacity={hover == null || hover === i ? 1 : 0.55} />}
                {showLabel(i, labels.length, every) && (
                  <text x={cx} y={height - 8} textAnchor={anchor(i, labels.length)} className="fill-zinc-500 dark:fill-zinc-400 text-[11px]">
                    {labels[i]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip
        tip={hover != null ? { x: PAD.left + band * hover + band / 2, y: y(values[hover]), title: titles[hover], value: `${fmt(values[hover])} ${unit}` } : null}
        width={width}
      />
    </div>
  );
}

/** A ranked list as horizontal bars: label, bar, count and share. */
export function BarList({ rows, empty }: { rows: { key: string; label: string; n: number }[]; empty: string }) {
  const total = rows.reduce((s, r) => s + r.n, 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p className="py-6 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${fmt(r.n)} (${Math.round((r.n / total) * 100)}%)`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-zinc-700 dark:text-zinc-200">{r.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{fmt(r.n)}</span>
              <span className="ms-2 inline-block w-10 text-end">{Math.round((r.n / total) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[var(--track)]">
            <div className="h-2 rounded-full bg-[var(--series)] transition-[width] duration-500" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A 12-point-ish trend line for a stat tile, in a muted hue with the latest point in the accent. */
export function Sparkline({ values }: { values: number[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const height = 32;
  const max = Math.max(1, ...values);
  const x = (i: number) => (values.length > 1 ? (i / (values.length - 1)) * (width - 4) + 2 : width / 2);
  const y = (v: number) => height - 3 - (v / max) * (height - 6);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  return (
    <div ref={ref} className="h-8 w-full" dir="ltr" aria-hidden>
      {width > 0 && values.length > 1 && (
        <svg width={width} height={height} className="block overflow-visible">
          <path d={d} fill="none" stroke="var(--spark)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3} fill="var(--series)" />
        </svg>
      )}
    </div>
  );
}

/** Animates a number up from zero once, for the stat tiles. */
export function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setValue(target);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
