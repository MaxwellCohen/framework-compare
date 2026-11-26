import type { Label, Points } from "../data/types.ts";
import site from "../data/site.json";

/**
 * The four capability labels. Shape carries the meaning, colour reinforces it:
 *
 *   first-party   filled circle        built in, stable            2 pts
 *   experimental  half-filled circle   built in, behind a flag     1 pt
 *   third-party   half-filled diamond  needs an external package   1 pt
 *   manual        empty ring           you write it yourself       0 pts
 *
 * Circle = ships with the framework, diamond = comes from outside;
 * fill amount = points.
 *
 * The text lives in src/data/site.json so scripts/build-agent-files.mjs prints
 * the same definitions in /llms.txt, the markdown pages and /api/*.json.
 */
export const LABELS = site.labels as Record<Label, { text: string; short: string; points: Points; description: string }>;

export const LABEL_ORDER: Label[] = ["first-party", "experimental", "third-party", "manual"];

/** The bare 16×16 glyph for a label. Decorative: pair it with text or an accessible name. */
export function LabelGlyph({ label }: { label: Label }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="currentColor">
      {label === "first-party" && <circle cx="8" cy="8" r="6.25" />}
      {label === "experimental" && (
        <>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.5" />
          <path d="M8 2.5a5.5 5.5 0 0 0 0 11z" />
        </>
      )}
      {label === "third-party" && (
        <>
          <path d="M8 1.6 14.4 8 8 14.4 1.6 8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="miter" />
          <path d="M8 1.6 1.6 8 8 14.4z" />
        </>
      )}
      {label === "manual" && <circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.25" />}
    </svg>
  );
}

function pts(points: Points) {
  return `${points} ${points === 1 ? "pt" : "pts"}`;
}

/**
 * Capability label. The site's central visual atom — use it wherever a label is shown.
 *
 * - `size="cell"`: glyph only, fills a matrix cell (tinted background). The label
 *   and points are exposed as visually-hidden text and as a tooltip.
 * - `size="sm"`: glyph + short text ("1st-party"), for chips and table rows.
 * - `size="full"` (default): glyph + text + points ("1st-party | 2 pts").
 */
export function LabelBadge({
  label,
  size = "full",
  showPoints,
  class: cls = "",
}: {
  label: Label;
  size?: "cell" | "sm" | "full";
  /** Defaults to true for `full`, false otherwise. */
  showPoints?: boolean;
  class?: string;
}) {
  const meta = LABELS[label];
  if (size === "cell") {
    return (
      <span class={`badge badge-cell tier-${label} ${cls}`} title={`${meta.text}, ${pts(meta.points)}`}>
        <LabelGlyph label={label} />
        <span class="sr-only">
          {meta.text}, {pts(meta.points)}
        </span>
      </span>
    );
  }
  const withPoints = showPoints ?? size === "full";
  return (
    <span class={`badge badge-${size} tier-${label} ${cls}`}>
      <LabelGlyph label={label} />
      <span>{meta.text}</span>
      {withPoints && <span class="badge-pts num">{pts(meta.points)}</span>}
    </span>
  );
}

/**
 * Key for the four labels. Put one next to every matrix.
 * `detailed` adds the one-line definition of each label (methodology, feature pages).
 */
export function LabelLegend({ detailed = false, class: cls = "" }: { detailed?: boolean; class?: string }) {
  if (detailed) {
    return (
      <dl class={`grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr] ${cls}`}>
        {LABEL_ORDER.map((label) => (
          <>
            <dt>
              <LabelBadge label={label} />
            </dt>
            <dd class="text-ink-2 text-sm self-center">{LABELS[label].description}</dd>
          </>
        ))}
      </dl>
    );
  }
  return (
    <ul class={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${cls}`} aria-label="Label key">
      {LABEL_ORDER.map((label) => (
        <li key={label}>
          <LabelBadge label={label} size="sm" showPoints />
        </li>
      ))}
    </ul>
  );
}
