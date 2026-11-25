import type { ComponentChildren } from "preact";
import { MarkerKey } from "../measured/LaneChart.tsx";
import { CWV_THRESHOLDS, seconds } from "./format.ts";
import { MetricValue } from "./parts.tsx";

/* --------------------------------------------------------------------------
   FCP → LCP range chart, CSS only. One group per framework, one row per build.
   Each row draws FCP as a hollow ring and LCP as a filled dot on one shared
   seconds axis, joined by a line: the wait between first paint and the largest
   paint. Shading marks where LCP "needs improvement" and is "poor" by the Core
   Web Vitals thresholds. Every value is printed beside its row, so the chart is
   its own table view. Same tokens and marker classes as LaneChart/DotChart.
   -------------------------------------------------------------------------- */

export interface RangeRow {
  key: string;
  /** Build name, e.g. "baseline". */
  name: string;
  /** Hover text for the name, e.g. the branch. */
  title?: string;
  /** Small note under the name, e.g. "Vercel only". */
  note?: string;
  /** ms */
  fcp: number | null;
  /** ms */
  lcp: number | null;
}

export interface RangeGroup {
  key: string;
  label: ComponentChildren;
  /** Plain-text name for hover titles. */
  name: string;
  rows: RangeRow[];
}

const HOLLOW = "[background:var(--color-paper)] [box-shadow:inset_0_0_0_2px_var(--series),0_0_0_2px_var(--color-paper)]";

/** Axis end in seconds and tick step for the largest value: at least 5 s so both LCP thresholds show. */
export function rangeDomain(maxMs: number | null): { max: number; ticks: number[] } {
  const s = Math.max(5, Math.ceil((maxMs ?? 0) / 1000));
  const step = s <= 8 ? 1 : s <= 16 ? 2 : 5;
  const max = Math.ceil(s / step) * step;
  return { max, ticks: Array.from({ length: max / step + 1 }, (_, i) => i * step) };
}

export function RangeChart({
  groups,
  max,
  ticks,
  title,
  legend,
  caption,
}: {
  groups: RangeGroup[];
  /** Axis end, seconds (axis starts at 0). */
  max: number;
  ticks: number[];
  title?: ComponentChildren;
  legend?: ComponentChildren;
  caption?: ComponentChildren;
}) {
  const x = (ms: number) => `${(Math.min(1, Math.max(0, ms / 1000 / max)) * 100).toFixed(2)}%`;
  const [lcpGood, lcpNi] = CWV_THRESHOLDS.lcp;
  const zones = [
    { key: "ni", from: lcpGood, to: lcpNi, cls: "bg-ink/5" },
    { key: "poor", from: lcpNi, to: max * 1000, cls: "bg-ink/10" },
  ];

  return (
    <figure class="min-w-0">
      {(title || legend) && (
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          {title && <div class="font-semibold text-ink">{title}</div>}
          {legend}
        </div>
      )}
      <div
        class="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 text-sm sm:grid-cols-[minmax(7rem,max-content)_max-content_minmax(10rem,1fr)_max-content]"
        role="list"
      >
        {/* Axis tick labels, above the plot column. */}
        <div class="relative col-span-full mx-[7px] h-5 num text-2xs text-ink-3 sm:col-span-1 sm:col-start-3" aria-hidden="true">
          {ticks.map((t) => (
            <span key={t} class="absolute bottom-1 -translate-x-1/2 whitespace-nowrap" style={{ left: x(t * 1000) }}>
              {t}s
            </span>
          ))}
        </div>

        {groups.map((g) => (
          <div
            key={g.key}
            role="listitem"
            class="col-span-full grid grid-cols-subgrid items-center border-t border-rule py-1.5"
            style={{ "--n": g.rows.length }}
          >
            <div class="col-span-full min-w-0 self-center pb-1 sm:col-span-1 sm:[grid-row:span_var(--n)] sm:pb-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">{g.label}</div>
            </div>
            {g.rows.map((r) => {
              const both = r.fcp != null && r.lcp != null;
              const lo = both ? Math.min(r.fcp!, r.lcp!) : 0;
              const hi = both ? Math.max(r.fcp!, r.lcp!) : 0;
              return (
                <div key={r.key} class="col-span-full grid grid-cols-subgrid items-center gap-y-0.5 sm:col-[2/-1]">
                  <div class="col-start-1 row-start-1 min-w-0 text-xs text-ink-2">
                    <span class="num" title={r.title}>
                      {r.name}
                    </span>
                    {r.note && <span class="num ml-1.5 text-2xs text-ink-3 sm:ml-0 sm:block sm:leading-3">{r.note}</span>}
                  </div>
                  <div class="col-start-2 row-start-1 flex items-center justify-end gap-3 text-xs sm:col-start-3">
                    <span class="inline-flex items-center gap-1">
                      <span class="text-2xs text-ink-3">FCP</span>
                      <MetricValue metric="fcp" value={r.fcp} unit={false} class="min-w-[5ch] text-ink-2" />
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <span class="text-2xs text-ink-3">LCP</span>
                      <MetricValue metric="lcp" value={r.lcp} unit={false} class="min-w-[5ch] font-semibold text-ink" />
                    </span>
                  </div>
                  <div class="relative col-span-full row-start-2 mx-[7px] h-[1.375rem] sm:col-span-1 sm:col-start-2 sm:row-start-1" aria-hidden="true">
                    {zones.map((z) => (
                      <span key={z.key} class={`absolute inset-y-0 ${z.cls}`} style={{ left: x(z.from), width: `calc(${x(z.to)} - ${x(z.from)})` }} />
                    ))}
                    {ticks.map((t) => (
                      <span key={t} class="absolute inset-y-0 w-px bg-rule" style={{ left: x(t * 1000) }} />
                    ))}
                    {both && (
                      <span
                        class="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3"
                        style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }}
                      />
                    )}
                    {r.fcp != null && (
                      <span
                        class={`chart-dot series-0 ${HOLLOW}`}
                        style={{ "--x": x(r.fcp) }}
                        title={`${g.name}, ${r.name}: FCP ${seconds(r.fcp)} s`}
                      />
                    )}
                    {r.lcp != null && (
                      <span class="chart-dot series-0" style={{ "--x": x(r.lcp) }} title={`${g.name}, ${r.name}: LCP ${seconds(r.lcp)} s`} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {caption && <figcaption class="mt-2.5 text-xs text-ink-3 text-pretty">{caption}</figcaption>}
    </figure>
  );
}

/** Key for RangeChart: FCP ring, LCP dot, LCP threshold shading. */
export function RangeKey() {
  const item = "flex items-center gap-1.5";
  return (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      <li class={item}>
        <MarkerKey series={0} hollow />
        FCP
      </li>
      <li class={item}>
        <MarkerKey series={0} />
        LCP
      </li>
      <li class={item}>
        <span class="inline-block h-3 w-4 bg-ink/5 outline outline-1 outline-rule" aria-hidden="true" />
        LCP needs improvement ({CWV_THRESHOLDS.lcp[0] / 1000}–{CWV_THRESHOLDS.lcp[1] / 1000} s)
      </li>
      <li class={item}>
        <span class="inline-block h-3 w-4 bg-ink/10 outline outline-1 outline-rule" aria-hidden="true" />
        LCP poor (over {CWV_THRESHOLDS.lcp[1] / 1000} s)
      </li>
    </ul>
  );
}
