import type { ComponentChildren } from "preact";

/**
 * Score as a row of unit squares — one square per point, so 20/24 is countable,
 * not just proportional. Pass `fcp` + `other` for the split form (10 critical-path
 * points in ink, then 14 "other" points in grey), or `value` + `max` for a single run.
 *
 *   <ScoreBar fcp={8} other={12} />            split, with "20/24"
 *   <ScoreBar value={8} max={10} />            single
 *   <ScoreBar fcp={8} other={12} size="sm" showValue={false} />   table-row form
 */
export function ScoreBar(
  props: (
    | { fcp: number; other: number; fcpMax?: number; otherMax?: number }
    | { value: number; max: number }
  ) & {
    size?: "sm" | "md";
    /** Print the "20/24" figure after the bar. Default true. */
    showValue?: boolean;
    class?: string;
  },
) {
  const { size = "md", showValue = true, class: cls = "" } = props;
  const split = "fcp" in props;
  const fcpMax = split ? (props.fcpMax ?? 10) : 0;
  const otherMax = split ? (props.otherMax ?? 14) : 0;
  const value = split ? props.fcp + props.other : props.value;
  const max = split ? fcpMax + otherMax : props.max;
  const label = split
    ? `${value} of ${max} points: ${props.fcp} of ${fcpMax} from first-paint levers, ${props.other} of ${otherMax} from other features`
    : `${value} of ${max} points`;

  return (
    <span class={`scorebar ${size === "sm" ? "scorebar-sm" : ""} ${cls}`} role="img" aria-label={label} title={label}>
      {split ? (
        <>
          <span class="scorebar-seg" style={{ "--n": fcpMax, "--v": props.fcp }} />
          <span class="scorebar-seg scorebar-seg-other" style={{ "--n": otherMax, "--v": props.other }} />
        </>
      ) : (
        <span class="scorebar-seg" style={{ "--n": max, "--v": value }} />
      )}
      {showValue && (
        <span class="num text-sm pl-1" aria-hidden="true">
          <span class="font-semibold text-ink">{value}</span>
          <span class="text-ink-3">/{max}</span>
        </span>
      )}
    </span>
  );
}

/**
 * Compact numeric score: "20/24" in mono with an optional percent. Use in table
 * cells and chips where a bar is too wide.
 */
export function ScoreMeter({
  value,
  max,
  percent,
  class: cls = "",
}: {
  value: number;
  max: number;
  /** Whole percent to print after the fraction, e.g. `completeness`. */
  percent?: number;
  class?: string;
}) {
  return (
    <span class={`num whitespace-nowrap ${cls}`}>
      <span class="font-semibold text-ink">{value}</span>
      <span class="text-ink-3">/{max}</span>
      {percent !== undefined && <span class="text-ink-3 pl-2">{percent}%</span>}
    </span>
  );
}

/**
 * Rank marker: "#1" in a small mono box. Rank 1 is inverted. `tied` prefixes "="
 * for shared ranks.
 */
export function RankBadge({
  rank,
  tied = false,
  size = "md",
  class: cls = "",
}: {
  rank: number;
  tied?: boolean;
  size?: "sm" | "md";
  class?: string;
}) {
  const dims = size === "sm" ? "min-w-6 h-5 px-1 text-2xs" : "min-w-8 h-6 px-1.5 text-xs";
  const tone = rank === 1 ? "bg-ink text-paper border-ink" : "border-rule-strong text-ink-2";
  return (
    <span
      class={`num inline-flex items-center justify-center rounded-xs border font-semibold ${dims} ${tone} ${cls}`}
      aria-label={`${tied ? "Tied for rank" : "Rank"} ${rank}`}
    >
      <span aria-hidden="true">
        {tied ? "=" : "#"}
        {rank}
      </span>
    </span>
  );
}

/**
 * Stat tile: a labelled figure. Use in a grid (`grid gap-px` inside a `Card flush`,
 * or `StatGroup`) for page-level numbers: total score, rank, completeness, FCP.
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  class: cls = "",
}: {
  label: string;
  /** The figure. Keep it short: "20", "83", "1.2". */
  value: ComponentChildren;
  /** Small suffix set after the value: "/24", "%", "s". */
  unit?: string;
  /** One line of context under the figure. */
  hint?: ComponentChildren;
  class?: string;
}) {
  return (
    <div class={`bg-paper px-4 py-3 ${cls}`}>
      <div class="eyebrow">{label}</div>
      <div class="mt-1 flex items-baseline gap-1">
        <span class="font-display text-2xl tabular-nums lining-nums text-ink">{value}</span>
        {unit && <span class="num text-sm text-ink-3">{unit}</span>}
      </div>
      {hint && <div class="mt-0.5 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

/** Hairline-divided row of `Stat` tiles (2 columns on phones, `cols` from `sm` up). */
export function StatGroup({
  children,
  cols = 4,
  class: cls = "",
}: {
  children: ComponentChildren;
  cols?: 2 | 3 | 4 | 5;
  class?: string;
}) {
  const colClass = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5" }[cols];
  return (
    <div
      class={`grid grid-cols-2 ${colClass} gap-px overflow-hidden rounded-sm border border-rule-strong bg-rule ${cls}`}
    >
      {children}
    </div>
  );
}
