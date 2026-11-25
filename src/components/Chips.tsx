import type { Feature, Framework, Label } from "../data/types.ts";
import { LabelGlyph, LABELS } from "./LabelBadge.tsx";
import { NavLink } from "./links.tsx";
import { RankBadge } from "./Score.tsx";

type FrameworkRef = Pick<Framework, "id" | "name" | "shortName">;
type FeatureRef = Pick<Feature, "id" | "number" | "name" | "shortName">;

/** Two-digit feature number: 1 → "01". */
export function featureNo(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Inline framework name linking to its page. Use in running text and table cells.
 * `short` uses `shortName`; `link={false}` renders plain text (e.g. on its own page).
 */
export function FrameworkName({
  framework,
  short = false,
  link = true,
  class: cls = "",
}: {
  framework: FrameworkRef;
  short?: boolean;
  link?: boolean;
  class?: string;
}) {
  const text = short ? framework.shortName : framework.name;
  if (!link) return <span class={cls}>{text}</span>;
  return (
    <NavLink to={{ route: "framework", id: framework.id }} class={`link font-semibold ${cls}`}>
      {text}
    </NavLink>
  );
}

/**
 * Boxed framework chip: optional rank, the name, optional "20/24" score.
 * Use for lists of frameworks (compare picker results, "also first-party in…").
 */
export function FrameworkChip({
  framework,
  rank,
  tied,
  score,
  max = 22,
  short = false,
  link = true,
  class: cls = "",
}: {
  framework: FrameworkRef;
  rank?: number;
  tied?: boolean;
  /** Total points; printed as "score/max". */
  score?: number;
  max?: number;
  short?: boolean;
  link?: boolean;
  class?: string;
}) {
  const body = (
    <>
      {rank !== undefined && <RankBadge rank={rank} tied={tied} size="sm" />}
      <span class="font-semibold text-ink">{short ? framework.shortName : framework.name}</span>
      {score !== undefined && (
        <span class="num text-xs text-ink-3">
          {score}/{max}
        </span>
      )}
    </>
  );
  const box = `inline-flex items-center gap-2 rounded-sm border border-rule-strong bg-surface px-2 py-1 text-sm whitespace-nowrap ${cls}`;
  if (!link) return <span class={box}>{body}</span>;
  return (
    <NavLink to={{ route: "framework", id: framework.id }} class={`${box} hover:border-ink`}>
      {body}
    </NavLink>
  );
}

/**
 * Inline feature name with its two-digit number, linking to the feature page.
 */
export function FeatureName({
  feature,
  short = false,
  link = true,
  class: cls = "",
}: {
  feature: FeatureRef;
  short?: boolean;
  link?: boolean;
  class?: string;
}) {
  const body = (
    <>
      <span class="num mr-2 text-xs text-ink-3">{featureNo(feature.number)}</span>
      {short ? feature.shortName : feature.name}
    </>
  );
  if (!link) return <span class={cls}>{body}</span>;
  return (
    <NavLink to={{ route: "feature", id: feature.id }} class={`hover:text-accent ${cls}`}>
      {body}
    </NavLink>
  );
}

/**
 * Boxed feature chip. Pass `label` to prefix the tier glyph — e.g. a framework's
 * strongest or weakest features at a glance.
 */
export function FeatureChip({
  feature,
  label,
  short = true,
  link = true,
  class: cls = "",
}: {
  feature: FeatureRef;
  label?: Label;
  short?: boolean;
  link?: boolean;
  class?: string;
}) {
  const body = (
    <>
      {label ? (
        <span class={`badge tier-${label}`}>
          <LabelGlyph label={label} />
          <span class="sr-only">{LABELS[label].text}:</span>
        </span>
      ) : (
        <span class="num text-xs text-ink-3">{featureNo(feature.number)}</span>
      )}
      <span class="text-ink">{short ? feature.shortName : feature.name}</span>
    </>
  );
  const box = `inline-flex items-center gap-2 rounded-sm border border-rule-strong bg-surface px-2 py-1 text-sm whitespace-nowrap ${cls}`;
  if (!link) return <span class={box}>{body}</span>;
  return (
    <NavLink to={{ route: "feature", id: feature.id }} class={`${box} hover:border-ink`}>
      {body}
    </NavLink>
  );
}
