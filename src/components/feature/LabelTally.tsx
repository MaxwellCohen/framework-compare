import type { Label } from "../../data/types.ts";
import { LabelBadge, LABEL_ORDER } from "../LabelBadge.tsx";

/**
 * How many items carry each of the four labels: "● First-party 9  ◐ Experimental 1 …".
 * Used for "frameworks by label" on a feature page and "12 features by label"
 * on a framework page. Labels with a zero count stay in the list (dimmed) so the
 * four always appear in the same order.
 */
export function LabelTally({
  counts,
  of,
  noun,
  class: cls = "",
}: {
  counts: Record<Label, number>;
  /** The total the counts add up to (the number of frameworks, or of features). */
  of: number;
  /** Plural noun for the accessible name, e.g. "frameworks". */
  noun: string;
  class?: string;
}) {
  return (
    <ul class={`flex flex-wrap items-center gap-x-4 gap-y-2 ${cls}`} aria-label={`${of} ${noun} by label`}>
      {LABEL_ORDER.map((label) => (
        <li key={label} class={`flex items-center gap-1.5 ${counts[label] === 0 ? "opacity-55" : ""}`}>
          <LabelBadge label={label} size="sm" />
          <span class="num text-sm font-semibold text-ink">{counts[label]}</span>
        </li>
      ))}
      <li class="num text-xs text-ink-3">of {of}</li>
    </ul>
  );
}
