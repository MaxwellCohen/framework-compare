import { Fragment, type ComponentChildren } from "preact";
import { cwvStatus, formatMetric, hasStatus, METRIC_NAME, STATUS_TEXT, CWV_THRESHOLDS, type BenchMetricKey, type CwvMetric, type CwvStatus } from "./format.ts";

/* --------------------------------------------------------------------------
   Small benchmark atoms. No NavLink and no data imports, so islands can use
   them (src/islands/BenchTable.tsx).
   -------------------------------------------------------------------------- */

/**
 * Core Web Vitals status glyph, Lighthouse's shapes: circle good, square needs
 * improvement, triangle poor. Colour (`.cwv-*` in global.css) only reinforces
 * the shape. Carries its status as visually hidden text.
 */
export function StatusMark({ status, label = true }: { status: CwvStatus; label?: boolean }) {
  return (
    <>
      <svg
        viewBox="0 0 10 10"
        width="9"
        height="9"
        class={`cwv-${status} inline-block flex-none text-[var(--cwv)]`}
        aria-hidden="true"
        focusable="false"
        fill="currentColor"
      >
        {status === "good" && <circle cx="5" cy="5" r="4.25" />}
        {status === "ni" && <rect x="1" y="1" width="8" height="8" rx="0.5" />}
        {status === "poor" && <path d="M5 0.6 9.6 9.2H0.4z" />}
      </svg>
      {label && <span class="sr-only">({STATUS_TEXT[status].toLowerCase()})</span>}
    </>
  );
}

/**
 * One metric value: number, unit, and a status glyph for the metrics with
 * thresholds (FCP, LCP, TBT, CLS, INP, TTFB).
 * Missing values print "—". Text stays in ink; only the glyph is coloured.
 */
export function MetricValue({
  metric,
  value,
  unit = true,
  class: cls = "",
}: {
  metric: BenchMetricKey;
  value: number | null | undefined;
  /** Print the unit after the number. */
  unit?: boolean;
  class?: string;
}) {
  const f = formatMetric(metric, value);
  if (!f) {
    return (
      <span class={`num text-ink-3 ${cls}`} title="No data">
        <span aria-hidden="true">—</span>
        <span class="sr-only">no data</span>
      </span>
    );
  }
  const status = hasStatus(metric) ? cwvStatus(metric, value) : null;
  const text = `${f.text}${f.unit ? ` ${f.unit}` : ""}`;
  return (
    <span
      class={`num inline-flex items-center justify-end gap-1 whitespace-nowrap ${cls}`}
      title={`${METRIC_NAME[metric]}: ${text}${status ? ` (${STATUS_TEXT[status].toLowerCase()})` : ""}`}
    >
      {status && <StatusMark status={status} />}
      <span>
        {f.text}
        {unit && f.unit && <span class="text-ink-3"> {f.unit}</span>}
      </span>
    </span>
  );
}

const THRESHOLD_TEXT: Record<CwvMetric, (i: 0 | 1) => string> = {
  fcp: (i) => `${CWV_THRESHOLDS.fcp[i] / 1000} s`,
  lcp: (i) => `${CWV_THRESHOLDS.lcp[i] / 1000} s`,
  tbt: (i) => `${CWV_THRESHOLDS.tbt[i]} ms`,
  cls: (i) => String(CWV_THRESHOLDS.cls[i]),
  inp: (i) => `${CWV_THRESHOLDS.inp[i]} ms`,
  ttfb: (i) => `${CWV_THRESHOLDS.ttfb[i] / 1000} s`,
};

/** Key for the status glyphs, with the thresholds per metric. */
export function StatusKey({
  class: cls = "",
  metrics = ["fcp", "lcp", "tbt", "cls"],
  children,
}: {
  class?: string;
  /** Metrics whose thresholds the key lists. */
  metrics?: CwvMetric[];
  children?: ComponentChildren;
}) {
  const item = "flex items-center gap-1.5";
  return (
    <div class={`text-xs text-ink-2 ${cls}`}>
      <ul class="flex flex-wrap gap-x-4 gap-y-1" aria-label="Core Web Vitals status key">
        <li class={item}>
          <StatusMark status="good" label={false} />
          Good
        </li>
        <li class={item}>
          <StatusMark status="ni" label={false} />
          Needs improvement
        </li>
        <li class={item}>
          <StatusMark status="poor" label={false} />
          Poor
        </li>
        {children}
      </ul>
      <p class="num mt-1 text-2xs text-ink-3">
        {metrics.map((m, i) => (
          <Fragment key={m}>
            {i > 0 && " · "}
            <span class="whitespace-nowrap">
              {m.toUpperCase()} {THRESHOLD_TEXT[m](0)} / {THRESHOLD_TEXT[m](1)}
            </span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
