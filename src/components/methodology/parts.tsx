import type { ComponentChildren } from "preact";
import type { Framework, RankingRow } from "../../data/types.ts";
import { FrameworkName } from "../Chips.tsx";
import { Matrix, MatrixCell, MatrixColHeader, MatrixHead, MatrixRow, MatrixRowHeader } from "../Matrix.tsx";
import { Prose } from "../Prose.tsx";
import { RankBadge } from "../Score.tsx";
import { NavLink } from "../links.tsx";

export interface TocItem {
  hash: string;
  label: string;
}

/**
 * On-page table of contents: plain anchors. A bordered list above the content
 * on small screens, a sticky side column from `lg` up.
 */
export function Toc({ items }: { items: TocItem[] }) {
  return (
    <nav aria-label="On this page" class="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <p class="eyebrow mb-2">On this page</p>
      <ol class="grid gap-x-6 border-l border-rule-strong text-sm sm:max-lg:grid-cols-2">
        {items.map((item, i) => (
          <li key={item.hash}>
            <NavLink
              to={{ route: "methodology", hash: item.hash }}
              class="flex gap-2.5 py-1 pl-3 text-ink-2 underline decoration-rule-strong underline-offset-2 hover:text-ink hover:decoration-accent"
            >
              <span class="num text-xs leading-5 text-ink-3" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * A methodology section. Same heading style as the kit's `Section`, without its
 * own `Container` so it can sit beside the table of contents. `scroll-mt` keeps
 * the heading clear of the viewport edge when reached through its anchor.
 */
export function DocSection({
  id,
  index,
  title,
  children,
}: {
  id: string;
  index: string;
  title: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} class="scroll-mt-6 border-t border-rule py-8 first:border-t-0 first:pt-0">
      <h2 id={`${id}-title`} class="mb-4 font-display text-xl text-ink text-balance">
        <span class="num mr-3 align-middle text-sm text-ink-3">{index}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

type FwRef = Pick<Framework, "id" | "name" | "shortName">;

/** The completeness ranking: rank, framework, the two sub-scores, total, completeness. */
export function RankingTable({ rows }: { rows: (RankingRow & { framework: FwRef; tied: boolean })[] }) {
  const frac = (value: number, max: number, strong = false) => (
    <span class={`num whitespace-nowrap ${strong ? "font-semibold text-ink" : ""}`}>
      {value}
      <span class="font-normal text-ink-3">/{max}</span>
    </span>
  );
  return (
    <Matrix label={`Completeness ranking of all ${rows.length} frameworks`}>
      <MatrixHead corner="Rank and framework">
        <MatrixColHeader title="Points from the five FCP levers, out of 10">FCP levers</MatrixColHeader>
        <MatrixColHeader title="Points from the seven other features, out of 14">Other features</MatrixColHeader>
        <MatrixColHeader title="Sum of the two scores, out of 24">Total</MatrixColHeader>
        <MatrixColHeader title="Total divided by 24, rounded to a whole percent">Completeness</MatrixColHeader>
      </MatrixHead>
      <tbody>
        {rows.map((r) => (
          <MatrixRow key={r.frameworkId}>
            <MatrixRowHeader to={{ route: "framework", id: r.frameworkId }}>
              <RankBadge rank={r.rank} tied={r.tied} size="sm" />
              <span class="font-semibold underline decoration-rule-strong underline-offset-2">{r.framework.name}</span>
            </MatrixRowHeader>
            <MatrixCell>{frac(r.fcpScore, 10)}</MatrixCell>
            <MatrixCell>{frac(r.otherScore, 14)}</MatrixCell>
            <MatrixCell>{frac(r.total, 24, true)}</MatrixCell>
            <MatrixCell>
              <span class="num">{r.completeness}%</span>
            </MatrixCell>
          </MatrixRow>
        ))}
      </tbody>
    </Matrix>
  );
}

/** Versions checked for one group of frameworks: name, version string, notes. */
export function VersionList({
  title,
  aside,
  frameworks,
}: {
  title: string;
  aside: string;
  frameworks: (FwRef & Pick<Framework, "version" | "versionNotes">)[];
}) {
  return (
    <div class="rounded-sm border border-rule-strong bg-surface">
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
        <h3 class="font-semibold text-ink">{title}</h3>
        <span class="text-xs text-ink-3">{aside}</span>
      </div>
      <dl class="divide-y divide-rule">
        {frameworks.map((f) => (
          <div key={f.id} class="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[10.5rem_minmax(0,1fr)]">
            <dt>
              <FrameworkName framework={f} />
            </dt>
            <dd class="min-w-0">
              <div class="num text-sm text-ink [overflow-wrap:anywhere]">{f.version}</div>
              {f.versionNotes && <div class="mt-1 text-sm text-ink-2 text-pretty [overflow-wrap:anywhere]">{f.versionNotes}</div>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The lower-confidence claims as a numbered list; each item has an anchor (`#claim-N`). */
export function ClaimList({ claims }: { claims: string[] }) {
  return (
    <ol class="border-t border-rule">
      {claims.map((html, i) => (
        <li
          key={i}
          id={`claim-${i + 1}`}
          class="grid scroll-mt-6 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 border-b border-rule py-3.5 target:bg-sunken"
        >
          <span class="num pt-px text-sm text-ink-3" aria-hidden="true">
            {String(i + 1).padStart(2, "0")}
          </span>
          <Prose size="sm" html={html} class="text-pretty [overflow-wrap:anywhere]" />
        </li>
      ))}
    </ol>
  );
}
