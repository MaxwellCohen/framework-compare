import type { ComponentChildren } from "preact";

/* --------------------------------------------------------------------------
   Horizontal chart primitives, CSS only (`.chart*` in global.css).

   Every row prints its values as text next to the plot, so the chart is its own
   table view: nothing is readable only by position or colour. Series are told
   apart by marker shape as well as hue (circle, square, diamond), and the legend
   is always shown when there is more than one series.
   -------------------------------------------------------------------------- */

export interface ChartSeries {
  /** Key into each row's `values`. */
  id: string;
  /** Legend text, e.g. "Vercel". */
  label: string;
}

export interface DotChartRow {
  key: string;
  /** Row label: text or a `FrameworkName` / `Tag` node. */
  label: ComponentChildren;
  /** One value per series id; `null`/missing renders "—". */
  values?: Record<string, number | null | undefined>;
  /** A min–max span drawn as a bar (FCP bands). */
  range?: { min: number; max: number };
}

interface ScaleProps {
  /** Axis extent in data units, e.g. `[0.8, 3]`. Not required to start at 0 for dots/ranges. */
  domain: [number, number];
  /** Gridline positions. Defaults to 5 even steps. */
  ticks?: number[];
  /** Unit suffix for axis labels and values. Default "s". */
  unit?: string;
  /** Decimal places for printed values. Default 1. */
  digits?: number;
}

function scale(domain: [number, number]) {
  const [min, max] = domain;
  return (v: number) => `${(Math.min(1, Math.max(0, (v - min) / (max - min))) * 100).toFixed(2)}%`;
}

function defaultTicks([min, max]: [number, number]) {
  return Array.from({ length: 5 }, (_, i) => +(min + ((max - min) * i) / 4).toFixed(2));
}

function Axis({ ticks, x, unit }: { ticks: number[]; x: (v: number) => string; unit: string }) {
  return (
    <div class="chart-row chart-axis" aria-hidden="true">
      <div class="chart-plot num text-2xs">
        {ticks.map((t) => (
          <span key={t} class="chart-tick" style={{ "--x": x(t) }}>
            {t}
            {unit}
          </span>
        ))}
      </div>
    </div>
  );
}

function Frame({
  title,
  caption,
  legend,
  children,
}: {
  title?: ComponentChildren;
  caption?: ComponentChildren;
  legend?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <figure class="min-w-0">
      {(title || legend) && (
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          {title && <div class="font-semibold text-ink">{title}</div>}
          {legend}
        </div>
      )}
      {children}
      {caption && <figcaption class="mt-2 text-xs text-ink-3">{caption}</figcaption>}
    </figure>
  );
}

/**
 * Dot plot: one row per item, one marker per series on a shared scale — e.g.
 * FCP seconds per host for each app. A row may also (or only) carry a `range`,
 * drawn as a span bar — e.g. FCP bands (0.9–2.8 s). `bands` shades reference
 * ranges behind every row.
 *
 *   <DotChart
 *     title="First Contentful Paint by host"
 *     series={[{ id: "vercel", label: "Vercel" }, { id: "netlify", label: "Netlify" }, { id: "cloudflare", label: "Cloudflare" }]}
 *     domain={[0.8, 3]} ticks={[1, 1.5, 2, 2.5, 3]}
 *     rows={[{ key: "nuxt", label: "Nuxt", values: { vercel: 1.2, netlify: 1.4, cloudflare: null } }]}
 *   />
 *
 * At most three series (the palette's all-pairs-safe limit); facet beyond that.
 */
export function DotChart({
  rows,
  series = [],
  domain,
  ticks = defaultTicks(domain),
  unit = "s",
  digits = 1,
  bands = [],
  title,
  caption,
}: ScaleProps & {
  rows: DotChartRow[];
  series?: ChartSeries[];
  /** Reference ranges shaded behind all rows. */
  bands?: { min: number; max: number }[];
  title?: ComponentChildren;
  caption?: ComponentChildren;
}) {
  const x = scale(domain);
  const fmt = (v: number) => v.toFixed(digits);
  const multi = series.length > 1;
  const cls = (i: number) => `series-${multi ? i + 1 : 0}`;

  const legend = multi && (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Series">
      {series.map((s, i) => (
        <li key={s.id} class="flex items-center gap-1.5">
          <span class={`chart-key ${cls(i)}`} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );

  return (
    <Frame title={title} caption={caption} legend={legend}>
      <div class="chart" role="list">
        <Axis ticks={ticks} x={x} unit={unit} />
        {rows.map((row) => (
          <div key={row.key} class="chart-row" role="listitem">
            <div class="chart-label">{row.label}</div>
            <div class="chart-plot" aria-hidden="true">
              {bands.map((b) => (
                <span key={b.min} class="chart-range chart-range-quiet" style={{ "--x0": x(b.min), "--x1": x(b.max) }} />
              ))}
              {ticks.map((t) => (
                <span key={t} class="chart-tick" style={{ "--x": x(t) }} />
              ))}
              {row.range ? (
                <span
                  class="chart-range"
                  style={{ "--x0": x(row.range.min), "--x1": x(row.range.max) }}
                  title={`${fmt(row.range.min)}–${fmt(row.range.max)} ${unit}`}
                />
              ) : (
                <span class="chart-track" />
              )}
              {series.map((s, i) => {
                const v = row.values?.[s.id];
                return v == null ? null : (
                  <span key={s.id} class={`chart-dot ${cls(i)}`} style={{ "--x": x(v) }} title={`${s.label}: ${fmt(v)} ${unit}`} />
                );
              })}
            </div>
            <div class="chart-values num text-xs text-ink-2">
              {row.range && (
                <span>
                  {fmt(row.range.min)}–{fmt(row.range.max)}
                  <span class="text-ink-3"> {unit}</span>
                </span>
              )}
              {series.map((s, i) => {
                const v = row.values?.[s.id];
                return (
                  <span key={s.id} class="inline-flex items-center gap-1 min-w-[2.6em] justify-end">
                    {multi && <span class={`chart-key ${cls(i)}`} aria-hidden="true" />}
                    <span class="sr-only">{s.label}: </span>
                    {v == null ? <span class="text-ink-3">—</span> : fmt(v)}
                    {v != null && <span class="sr-only"> {unit}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/**
 * Horizontal bar chart for one measure per row, always from zero — e.g. average
 * Lighthouse score or average FCP per build. `max` sets the axis end.
 *
 *   <BarChart max={100} unit="" digits={0} rows={[{ key: "a", label: "Astro", value: 98 }]} />
 */
export function BarChart({
  rows,
  max,
  ticks,
  unit = "s",
  digits = 1,
  title,
  caption,
}: {
  rows: { key: string; label: ComponentChildren; value: number | null }[];
  max: number;
  ticks?: number[];
  unit?: string;
  digits?: number;
  title?: ComponentChildren;
  caption?: ComponentChildren;
}) {
  const domain: [number, number] = [0, max];
  const x = scale(domain);
  const tk = ticks ?? defaultTicks(domain);
  return (
    <Frame title={title} caption={caption}>
      <div class="chart" role="list">
        <Axis ticks={tk} x={x} unit={unit} />
        {rows.map((row) => (
          <div key={row.key} class="chart-row" role="listitem">
            <div class="chart-label">{row.label}</div>
            <div class="chart-plot" aria-hidden="true">
              {tk.map((t) => (
                <span key={t} class="chart-tick" style={{ "--x": x(t) }} />
              ))}
              {row.value != null && <span class="chart-bar" style={{ "--x": x(row.value) }} />}
            </div>
            <div class="chart-values num text-xs text-ink">
              {row.value == null ? (
                <span class="text-ink-3">—</span>
              ) : (
                <span>
                  {row.value.toFixed(digits)}
                  {unit && <span class="text-ink-3"> {unit}</span>}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
