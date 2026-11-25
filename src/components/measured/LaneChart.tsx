import type { ComponentChildren } from "preact";

/* --------------------------------------------------------------------------
   Lane dot plot, CSS only. Page-specific companion to the kit's `DotChart`
   (same tokens, marker shapes and `.chart-dot` / `.chart-key` / `.series-N`
   classes from global.css), for two things `DotChart` cannot express:

   - each series gets its own lane inside a group, so equal values (very common
     at Lighthouse's 0.1 s resolution) do not hide each other;
   - a lane can carry a `from` value as well: a hollow marker joined to the
     filled one, i.e. the movement from a baseline build to an optimized build.

   Every value is printed as text beside its lane; a missing value prints "—".
   -------------------------------------------------------------------------- */

export interface Lane {
  key: string;
  /** Lane name shown beside the marker key (a host). Omit for single-lane groups. */
  name?: string;
  /** 1–3 picks a series colour and shape; 0 is the neutral ink circle. */
  series: 0 | 1 | 2 | 3;
  /** Earlier/baseline value, drawn hollow and joined to `value`. */
  from?: number | null;
  /** The value, or `null` when not measured. */
  value: number | null;
  /** Draw `value` hollow (a baseline build with no paired optimized build). */
  hollow?: boolean;
}

export interface LaneGroup {
  key: string;
  label: ComponentChildren;
  /** Small line under the label. */
  note?: ComponentChildren;
  lanes: Lane[];
}

export interface LaneBand {
  name: string;
  min: number;
  max: number;
}

const HOLLOW =
  "[background:var(--color-paper)] [box-shadow:inset_0_0_0_2px_var(--series),0_0_0_2px_var(--color-paper)]";

/** A marker key: the series shape, filled or hollow. */
export function MarkerKey({ series, hollow = false }: { series: 0 | 1 | 2 | 3; hollow?: boolean }) {
  return (
    <span
      class={`chart-key series-${series} ${hollow ? "[background:var(--color-paper)] [box-shadow:inset_0_0_0_2px_var(--series)]" : ""}`}
      aria-hidden="true"
    />
  );
}

export function LaneChart({
  groups,
  domain,
  ticks,
  unit = "s",
  digits = 1,
  bands = [],
  bandNames = true,
  named = true,
  paired = false,
  title,
  legend,
  caption,
  valueHeader,
}: {
  groups: LaneGroup[];
  domain: [number, number];
  ticks: number[];
  /** Unit suffix on axis ticks and in spoken values. */
  unit?: string;
  digits?: number;
  /** Reference ranges shaded behind every lane. */
  bands?: LaneBand[];
  /** Print the band names above the axis. */
  bandNames?: boolean;
  /** Lanes have names (hosts): adds the lane-name column from `sm` up. */
  named?: boolean;
  /** Any lane has a `from` value: reserves room for "2.6 → 1.2". */
  paired?: boolean;
  title?: ComponentChildren;
  legend?: ComponentChildren;
  caption?: ComponentChildren;
  /** Column header above the printed values, e.g. "FCP, s". */
  valueHeader?: string;
}) {
  const [min, max] = domain;
  const x = (v: number) => `${(Math.min(1, Math.max(0, (v - min) / (max - min))) * 100).toFixed(2)}%`;
  const fmt = (v: number) => v.toFixed(digits);

  const cols = named
    ? "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(6.5rem,max-content)_max-content_minmax(9rem,1fr)_max-content]"
    : "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(6.5rem,max-content)_minmax(7rem,1fr)_max-content]";
  const plotStart = named ? "col-start-1 sm:col-start-3" : "col-start-1 sm:col-start-2";

  return (
    <figure class="min-w-0">
      {(title || legend) && (
        <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          {title && <div class="font-semibold text-ink">{title}</div>}
          {legend}
        </div>
      )}
      <div class={`grid ${cols} gap-x-3 text-sm`} role="list">
        {/* Axis: band names, then tick labels. */}
        <div class={`${plotStart} relative mx-[7px] num text-2xs text-ink-3 ${bands.length && bandNames ? "h-9" : "h-5"}`} aria-hidden="true">
          {bandNames &&
            bands.map((b) => (
              <span
                key={b.name}
                class="absolute top-0 -translate-x-1/2 whitespace-nowrap text-ink-2"
                style={{ left: x((b.min + b.max) / 2) }}
              >
                {b.name}
              </span>
            ))}
          {ticks.map((t) => (
            <span key={t} class="absolute bottom-1 -translate-x-1/2 whitespace-nowrap" style={{ left: x(t) }}>
              {t}
              {unit}
            </span>
          ))}
        </div>
        <div class="num self-end pb-1 text-right text-2xs text-ink-3" aria-hidden="true">
          {valueHeader}
        </div>

        {groups.map((g) => (
          <div
            key={g.key}
            role="listitem"
            class="col-span-full grid grid-cols-subgrid items-center border-t border-rule py-1.5"
            style={{ "--n": g.lanes.length }}
          >
            <div class="col-span-full min-w-0 self-center pb-1 sm:col-span-1 sm:[grid-row:span_var(--n)] sm:pb-0">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1">{g.label}</div>
              {g.note && <div class="num mt-0.5 text-2xs text-ink-3">{g.note}</div>}
            </div>
            {g.lanes.map((lane) => {
              const hasFrom = lane.from != null && lane.value != null;
              const cls = `series-${lane.series}`;
              return (
                <>
                  {named && (
                    <div class="hidden items-center gap-1.5 text-xs text-ink-2 sm:flex" aria-hidden="true">
                      <MarkerKey series={lane.series} />
                      {lane.name}
                    </div>
                  )}
                  <div class="relative mx-[7px] h-[1.375rem]" aria-hidden="true">
                    {bands.map((b) => (
                      <span
                        key={b.name}
                        class="absolute inset-y-0 bg-ink/7"
                        style={{ left: x(b.min), width: `calc(${x(b.max)} - ${x(b.min)})` }}
                      />
                    ))}
                    {ticks.map((t) => (
                      <span key={t} class="absolute inset-y-0 w-px bg-rule" style={{ left: x(t) }} />
                    ))}
                    {hasFrom && (
                      <span
                        class="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3"
                        style={{
                          left: x(Math.min(lane.from!, lane.value!)),
                          width: `calc(${x(Math.max(lane.from!, lane.value!))} - ${x(Math.min(lane.from!, lane.value!))})`,
                        }}
                      />
                    )}
                    {hasFrom && <span class={`chart-dot ${cls} ${HOLLOW}`} style={{ "--x": x(lane.from!) }} />}
                    {lane.value != null && (
                      <span class={`chart-dot ${cls} ${lane.hollow ? HOLLOW : ""}`} style={{ "--x": x(lane.value) }} />
                    )}
                  </div>
                  <div class="num flex items-center justify-end gap-1.5 whitespace-nowrap text-xs text-ink-2">
                    {named && (
                      <span class="inline-flex sm:hidden" aria-hidden="true">
                        <MarkerKey series={lane.series} />
                      </span>
                    )}
                    {lane.name && <span class="sr-only">{lane.name}: </span>}
                    <span class={paired ? "inline-block min-w-[9ch] text-right" : "inline-block min-w-[3ch] text-right"}>
                      {lane.value == null ? (
                        <span class="text-ink-3" title="Not measured">
                          <span aria-hidden="true">—</span>
                          <span class="sr-only">not measured</span>
                        </span>
                      ) : (
                        <>
                          {hasFrom && (
                            <>
                              <span class="text-ink-3">{fmt(lane.from!)}</span>
                              <span class="text-ink-3" aria-hidden="true">
                                {" → "}
                              </span>
                              <span class="sr-only"> to </span>
                            </>
                          )}
                          <span class="font-semibold text-ink">{fmt(lane.value)}</span>
                          {unit && <span class="sr-only"> {unit}</span>}
                        </>
                      )}
                    </span>
                  </div>
                </>
              );
            })}
          </div>
        ))}
      </div>
      {caption && <figcaption class="mt-2.5 text-xs text-ink-3 text-pretty">{caption}</figcaption>}
    </figure>
  );
}
