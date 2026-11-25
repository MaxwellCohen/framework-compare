import type { ArtDirection } from "../data/types.ts";
import { LabelBadge } from "./LabelBadge.tsx";
import { Prose } from "./Prose.tsx";

/**
 * A site-authored code sample, set apart from the quoted source how-to above
 * it so readers can tell the two apart.
 */
export function ManualExample({
  html,
  title = "Build it yourself: example",
  class: className = "",
}: {
  html: string;
  title?: string;
  class?: string;
}) {
  return (
    <div class={`mt-4 max-w-prose border-l-2 border-rule-strong pl-3 ${className}`}>
      <p class="eyebrow">{title}</p>
      <p class="mt-1 text-xs text-ink-3">
        Written for this site as a starting point. It is not part of the source comparison.
      </p>
      <Prose html={html} size="sm" class="mt-2" />
    </div>
  );
}

/**
 * Art direction for one framework: the source's former "<picture>" cell,
 * shown under its image-pipeline how-to. The label is informational: it
 * does not count toward the score.
 */
export function ArtDirectionBlock({ art, id, class: className = "" }: { art: ArtDirection; id?: string; class?: string }) {
  return (
    <section id={id} class={`mt-6 max-w-prose scroll-mt-14 border-t border-rule pt-4 ${className}`}>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-sm font-semibold text-ink">Art direction with &lt;picture&gt;</h4>
        <LabelBadge label={art.label} size="sm" />
      </div>
      <p class="mt-1 text-xs text-ink-3">
        Serving a different crop or format per screen size. Not scored: the label shows how much the framework
        does for you.
      </p>
      <Prose html={art.bodyHtml} size="sm" class="mt-3" />
      {art.exampleHtml && <ManualExample html={art.exampleHtml} title="Example" />}
    </section>
  );
}
