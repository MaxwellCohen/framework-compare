import type { ArtDirection, Deployment, Feature, Framework, Host, Label } from "../../data/types.ts";
import { featureNo } from "../Chips.tsx";
import { LabelBadge } from "../LabelBadge.tsx";
import { ExternalLink, NavLink } from "../links.tsx";
import { Card } from "../Page.tsx";
import { ArtDirectionBlock, ManualExample } from "../ManualExample.tsx";
import { Prose } from "../Prose.tsx";
import { ScoreMeter } from "../Score.tsx";

export interface ScorecardRow {
  feature: Pick<Feature, "id" | "number" | "name" | "shortName">;
  label: Label;
  bodyHtml: string;
  exampleHtml: string | null;
  artDirection: ArtDirection | null;
  gotchasHtml: string | null;
  /** Computed in the loader, e.g. "1st-party, like 8 of the other 14 frameworks. None scores higher." */
  comparison: string;
}

/**
 * One feature group of a framework's scorecard: a row per feature with the
 * linked feature name, the label, how the label sits among all frameworks, and
 * the how-to inside a closed `<details>` (in the HTML either way).
 */
export function ScorecardGroup({
  id,
  title,
  score,
  max,
  frameworkId,
  rows,
}: {
  id: string;
  title: string;
  score: number;
  max: number;
  frameworkId: Framework["id"];
  rows: ScorecardRow[];
}) {
  return (
    <Card as="section" id={id} title={title} aside={<ScoreMeter value={score} max={max} />} flush class="scroll-mt-4">
      <ul>
        {rows.map((row) => (
          <li key={row.feature.id} class="border-b border-rule px-4 py-3 last:border-b-0">
            <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
              <NavLink
                to={{ route: "feature", id: row.feature.id, hash: frameworkId }}
                class="link min-w-0 font-semibold text-ink"
              >
                <span class="num mr-2 text-xs font-normal text-ink-3">{featureNo(row.feature.number)}</span>
                {row.feature.name}
              </NavLink>
              <LabelBadge label={row.label} />
            </div>
            <p class="mt-1 text-sm text-ink-3">{row.comparison}</p>
            <details class="group mt-2">
              <summary class="w-fit cursor-pointer text-sm text-ink-2 underline decoration-rule-strong underline-offset-2 hover:text-ink">
                <span class="group-open:hidden">Show the how-to</span>
                <span class="hidden group-open:inline">Hide the how-to</span>
              </summary>
              <Prose html={row.bodyHtml} size="sm" class="mt-3 max-w-prose pb-1" />
              {row.exampleHtml && <ManualExample html={row.exampleHtml} class="mb-1" />}
              {row.artDirection && <ArtDirectionBlock art={row.artDirection} class="mb-1" />}
              {row.gotchasHtml && (
                <aside class="mt-3 mb-1 max-w-prose border-l-2 border-rule-strong pl-3" aria-label="Gotchas">
                  <p class="eyebrow mb-1">Gotchas</p>
                  <Prose html={row.gotchasHtml} size="sm" />
                </aside>
              )}
            </details>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const HOSTS: { id: Host; name: string }[] = [
  { id: "vercel", name: "Vercel" },
  { id: "netlify", name: "Netlify" },
  { id: "cloudflare", name: "Cloudflare" },
];

/**
 * The port's deployments, one entry per branch with a link per host. A table
 * in meaning; laid out as a grid so it stacks on phones instead of scrolling.
 */
export function Deployments({ deployments }: { deployments: Deployment[] }) {
  return (
    <ul class="rounded-sm border border-rule-strong bg-surface">
      {deployments.map((d) => (
        <li
          key={d.branch}
          class="grid gap-x-8 gap-y-3 border-b border-rule px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]"
        >
          <div class="min-w-0">
            <p class="eyebrow">Branch</p>
            <p class="num text-sm font-semibold break-words text-ink">{d.branch}</p>
            {d.note && <p class="mt-0.5 text-sm text-ink-2">{d.note}</p>}
          </div>
          <dl class="grid min-w-0 gap-x-6 gap-y-2 sm:grid-cols-3">
            {HOSTS.map((host) => (
              <div key={host.id} class="min-w-0">
                <dt class="eyebrow">{host.name}</dt>
                <dd class="num text-xs break-all">
                  {d.urls[host.id] ? (
                    <ExternalLink href={d.urls[host.id]!}>{d.urls[host.id]!.replace(/^https?:\/\//, "")}</ExternalLink>
                  ) : (
                    <span class="text-ink-3">Not deployed</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}
