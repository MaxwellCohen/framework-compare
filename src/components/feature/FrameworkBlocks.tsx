import type { ArtDirection, Feature, Framework, Label } from "../../data/types.ts";
import { LabelBadge, LabelGlyph, LABELS } from "../LabelBadge.tsx";
import { NavLink } from "../links.tsx";
import { Card } from "../Page.tsx";
import { ArtDirectionBlock, ManualExample } from "../ManualExample.tsx";
import { Prose } from "../Prose.tsx";

export type BlockFramework = Pick<Framework, "id" | "name" | "shortName" | "group">;

export interface FeatureBlock {
  framework: BlockFramework;
  label: Label;
  bodyHtml: string;
  exampleHtml: string | null;
  artDirection: ArtDirection | null;
  gotchasHtml: string | null;
}

type FeatureRef = Pick<Feature, "id">;

/** Tier-coloured glyph with the label as hidden text. */
function Mark({ label }: { label: Label }) {
  return (
    <span class={`badge tier-${label}`}>
      <LabelGlyph label={label} />
      <span class="sr-only">{LABELS[label].text}:</span>
    </span>
  );
}

/**
 * The one-row overview of a feature: every framework's label as a small linked
 * chip that jumps to its block further down the page. Core and additional
 * frameworks are two labelled runs of the same row.
 */
export function FrameworkOverview({
  feature,
  blocks,
  class: cls = "",
}: {
  feature: FeatureRef;
  blocks: FeatureBlock[];
  class?: string;
}) {
  return (
    <nav aria-label="Frameworks on this page" class={cls}>
      <ul class="flex flex-wrap gap-1.5">
        {blocks.map((b) => (
          <li key={b.framework.id}>
            <NavLink
              to={{ route: "feature", id: feature.id, hash: b.framework.id }}
              class="inline-flex items-center gap-1.5 rounded-sm border border-rule-strong bg-surface px-2 py-1 text-sm whitespace-nowrap hover:border-ink"
            >
              <Mark label={b.label} />
              <span class="text-ink">{b.framework.shortName}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Jump nav for the long list of framework blocks: a sticky column beside the
 * blocks from `lg` up. Plain anchors, no JavaScript. Below `lg` it is hidden;
 * `FrameworkOverview` and each block's "Overview" link do the same job there.
 */
export function FeatureJumpNav({ feature, blocks }: { feature: FeatureRef; blocks: FeatureBlock[] }) {
  const list = (
    <ul class="mt-1.5 border-l border-rule">
      {blocks.map((b) => (
        <li key={b.framework.id}>
          <NavLink
            to={{ route: "feature", id: feature.id, hash: b.framework.id }}
            class="-ml-px flex items-center gap-2 border-l border-transparent py-1 pl-3 text-sm text-ink-2 hover:border-ink hover:text-ink"
          >
            <Mark label={b.label} />
            <span>{b.framework.shortName}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
  return (
    <nav
      aria-label="Jump to a framework"
      class="sticky top-4 hidden max-h-[calc(100dvh-2rem)] self-start overflow-y-auto pr-2 lg:block"
    >
      <p class="eyebrow">Frameworks</p>
      {list}
      <p class="mt-5 text-sm">
        <NavLink to={{ route: "feature", id: feature.id, hash: "overview" }} class="link text-ink-2">
          Back to overview
        </NavLink>
      </p>
    </nav>
  );
}

/**
 * One framework's how-to for a feature. `id` is the framework id: matrix cells
 * across the site link to `/features/<featureId>#<frameworkId>`. When the block
 * is the URL's hash target it gets a heavy frame (CSS `:target`), and
 * `scroll-margin-top` leaves room above it.
 */
export function FrameworkBlock({ feature, block }: { feature: FeatureRef; block: FeatureBlock }) {
  const fw = block.framework;
  return (
    <Card
      as="article"
      id={fw.id}
      title={fw.name}
      to={{ route: "framework", id: fw.id }}
      aside={
        <>
          <LabelBadge label={block.label} />
          <NavLink
            to={{ route: "feature", id: feature.id, hash: "overview" }}
            class="eyebrow underline decoration-rule-strong underline-offset-2 hover:text-ink lg:hidden"
            aria-label="Back to the overview of all frameworks"
          >
            Overview
          </NavLink>
        </>
      }
      class="scroll-mt-14 target:border-ink target:shadow-[0_0_0_2px_var(--color-ink)] [&:target>div:first-child]:bg-sunken"
    >
      <Prose html={block.bodyHtml} size="sm" class="max-w-prose" />
      {block.exampleHtml && <ManualExample html={block.exampleHtml} />}
      {block.artDirection && <ArtDirectionBlock art={block.artDirection} id={`${fw.id}-art-direction`} />}
      {block.gotchasHtml && (
        <aside class="mt-4 max-w-prose border-l-2 border-rule-strong pl-3" aria-label={`${fw.name} gotchas`}>
          <p class="eyebrow mb-1">Gotchas</p>
          <Prose html={block.gotchasHtml} size="sm" />
        </aside>
      )}
    </Card>
  );
}
