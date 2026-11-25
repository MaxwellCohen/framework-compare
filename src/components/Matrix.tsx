import type { ComponentChildren } from "preact";
import type { Cell, Feature, FeatureGroup, Framework } from "../data/types.ts";
import { featureNo } from "./Chips.tsx";
import { LabelBadge, LABELS } from "./LabelBadge.tsx";
import { NavLink, type Target } from "./links.tsx";

/* --------------------------------------------------------------------------
   Primitives. Structure:

   <Matrix label="…">
     <MatrixHead corner="Feature">
       <MatrixColHeader to={…} vertical>Next.js</MatrixColHeader> …
     </MatrixHead>
     <tbody>
       <MatrixGroupRow span={15}>First-paint levers</MatrixGroupRow>
       <MatrixRow>
         <MatrixRowHeader to={…}>CSS inlining</MatrixRowHeader>
         <MatrixCell to={…} label="Next.js, CSS inlining: First-party"> … </MatrixCell> …
       </MatrixRow>
     </tbody>
     <tfoot> <MatrixRow> … </MatrixRow> </tfoot>
   </Matrix>

   Sticky header row and first column, row + column highlight on hover/focus,
   and horizontal scroll are all CSS (`.mx*` in global.css) — no JavaScript.
   -------------------------------------------------------------------------- */

/**
 * Scrollable table frame. `label` names the scroll region for assistive tech and
 * becomes the table caption (visually hidden). `scrollHint` shows a "scroll
 * sideways" line under the table below the `lg` breakpoint — turn it off for
 * narrow tables (≤ 4 columns).
 */
export function Matrix({
  label,
  children,
  scrollHint = true,
  class: cls = "",
}: {
  label: string;
  children: ComponentChildren;
  scrollHint?: boolean;
  class?: string;
}) {
  return (
    <div class={cls}>
      <div class="mx-wrap">
        <div class="mx-scroll" tabIndex={0} role="group" aria-label={`${label} (scrollable table)`}>
          <table class="mx">
            <caption class="sr-only">{label}</caption>
            {children}
          </table>
        </div>
      </div>
      {scrollHint && (
        <p class="eyebrow mt-2 lg:hidden" aria-hidden="true">
          ← Scroll sideways for more columns →
        </p>
      )}
    </div>
  );
}

/** Header row. `corner` labels the first (row-header) column. */
export function MatrixHead({ corner, children }: { corner?: ComponentChildren; children: ComponentChildren }) {
  return (
    <thead>
      <tr>
        <th scope="col" class="mx-corner">
          <span class="eyebrow">{corner}</span>
        </th>
        {children}
      </tr>
    </thead>
  );
}

/**
 * Column header (`<th scope="col">`). `vertical` sets the label bottom-to-top so
 * 15 columns fit a laptop; use horizontal for ≤ 6 columns. `to` links the header.
 */
export function MatrixColHeader({
  children,
  to,
  vertical = false,
  title,
}: {
  children: ComponentChildren;
  to?: Target;
  vertical?: boolean;
  title?: string;
}) {
  const inner = <span class="mx-colhead-label">{children}</span>;
  return (
    <th scope="col" class={`mx-colhead ${vertical ? "mx-colhead-v" : ""}`} title={title}>
      {to ? <NavLink to={to}>{inner}</NavLink> : <span>{inner}</span>}
    </th>
  );
}

/** A body or footer row. */
export function MatrixRow({ children }: { children: ComponentChildren }) {
  return <tr>{children}</tr>;
}

/** Row header (`<th scope="row">`), sticky on the left. `to` links it. */
export function MatrixRowHeader({ children, to }: { children: ComponentChildren; to?: Target }) {
  return (
    <th scope="row" class="mx-rowhead">
      {to ? <NavLink to={to}>{children}</NavLink> : <span>{children}</span>}
    </th>
  );
}

/**
 * Data cell. With `to` the whole cell is a link (give it a `label` — the
 * accessible name, e.g. "Nuxt, CSS inlining: First-party, 2 points").
 * Children are usually `<LabelBadge size="cell">` or a mono number.
 */
export function MatrixCell({
  children,
  to,
  label,
  class: cls = "",
}: {
  children: ComponentChildren;
  to?: Target;
  label?: string;
  class?: string;
}) {
  return (
    <td class={`mx-cell ${cls}`}>
      {to ? (
        <NavLink to={to} aria-label={label} title={label}>
          {children}
        </NavLink>
      ) : (
        children
      )}
    </td>
  );
}

/** Full-width divider row that titles a group of rows. `span` = number of data columns. */
export function MatrixGroupRow({
  children,
  span,
  aside,
}: {
  children: ComponentChildren;
  span: number;
  /** Shown in the data area, e.g. "max 10 pts". */
  aside?: ComponentChildren;
}) {
  return (
    <tr class="mx-group">
      <th scope="rowgroup" class="eyebrow whitespace-nowrap !text-ink-2">
        {children}
      </th>
      <td colSpan={span} class="eyebrow px-2.5 text-left">
        {aside}
      </td>
    </tr>
  );
}

/* --------------------------------------------------------------------------
   The capability matrix itself, composed from the primitives.
   -------------------------------------------------------------------------- */

type MatrixFramework = Pick<Framework, "id" | "name" | "shortName" | "fcpScore" | "otherScore" | "total">;
type MatrixFeature = Pick<Feature, "id" | "number" | "name" | "shortName" | "group">;
type MatrixCellData = Pick<Cell, "frameworkId" | "featureId" | "label" | "points">;

const GROUPS: { id: FeatureGroup; title: string; max: string }[] = [
  { id: "fcp", title: "First-paint levers", max: "2 pts each · max 10" },
  { id: "other", title: "Other features", max: "2 pts each · max 14" },
];

/**
 * Features (rows) × frameworks (columns), one `LabelBadge` per cell.
 * Pass any subset: all 15 frameworks on the home page, 2–4 on compare, or a
 * subset of features. Columns render in the order given.
 *
 * Each cell links to the feature page at `#<frameworkId>` — feature pages
 * should put that id on each framework's how-to block.
 */
export function CapabilityMatrix({
  frameworks,
  features,
  cells,
  label = "Capability matrix: features by framework",
  grouped = true,
  totals = true,
  vertical,
  class: cls,
}: {
  frameworks: MatrixFramework[];
  features: MatrixFeature[];
  cells: MatrixCellData[];
  label?: string;
  /** Split rows under "First-paint levers" / "Other features" headings. */
  grouped?: boolean;
  /** Footer rows with first-paint, other, and total points per framework. */
  totals?: boolean;
  /** Vertical column headers. Defaults to true when there are more than 6 frameworks. */
  vertical?: boolean;
  class?: string;
}) {
  const byKey = new Map(cells.map((c) => [`${c.featureId}|${c.frameworkId}`, c]));
  const isVertical = vertical ?? frameworks.length > 6;
  const sections = grouped
    ? GROUPS.map((g) => ({ ...g, rows: features.filter((f) => f.group === g.id) })).filter((g) => g.rows.length)
    : [{ id: "all" as const, title: "", max: "", rows: features }];

  const footRow = (title: string, max: number, pick: (f: MatrixFramework) => number, strong = false) => (
    <MatrixRow>
      <MatrixRowHeader>
        <span class={strong ? "font-semibold" : ""}>{title}</span>
        <span class="num ml-auto text-xs text-ink-3">/{max}</span>
      </MatrixRowHeader>
      {frameworks.map((fw) => (
        <MatrixCell key={fw.id}>
          <span class={`num block ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{pick(fw)}</span>
        </MatrixCell>
      ))}
    </MatrixRow>
  );

  return (
    <Matrix label={label} scrollHint={frameworks.length > 4} class={cls}>
      <MatrixHead corner="Feature">
        {frameworks.map((fw) => (
          <MatrixColHeader key={fw.id} to={{ route: "framework", id: fw.id }} vertical={isVertical} title={fw.name}>
            {fw.shortName}
          </MatrixColHeader>
        ))}
      </MatrixHead>
      <tbody>
        {sections.map((section) => (
          <>
            {grouped && (
              <MatrixGroupRow span={frameworks.length} aside={section.max}>
                {section.title}
              </MatrixGroupRow>
            )}
            {section.rows.map((feature) => (
              <MatrixRow key={feature.id}>
                <MatrixRowHeader to={{ route: "feature", id: feature.id }}>
                  <span class="num text-xs text-ink-3">{featureNo(feature.number)}</span>
                  <span>{feature.shortName}</span>
                </MatrixRowHeader>
                {frameworks.map((fw) => {
                  const cell = byKey.get(`${feature.id}|${fw.id}`);
                  if (!cell) {
                    return (
                      <MatrixCell key={fw.id}>
                        <span class="text-ink-3" aria-label="No data">
                          –
                        </span>
                      </MatrixCell>
                    );
                  }
                  const meta = LABELS[cell.label];
                  return (
                    <MatrixCell
                      key={fw.id}
                      to={{ route: "feature", id: feature.id, hash: fw.id }}
                      label={`${fw.name}, ${feature.shortName}: ${meta.text}, ${meta.points} ${meta.points === 1 ? "point" : "points"}`}
                    >
                      <LabelBadge label={cell.label} size="cell" />
                    </MatrixCell>
                  );
                })}
              </MatrixRow>
            ))}
          </>
        ))}
      </tbody>
      {totals && (
        <tfoot>
          {footRow("First paint", 10, (f) => f.fcpScore)}
          {footRow("Other", 14, (f) => f.otherScore)}
          {footRow("Total", 24, (f) => f.total, true)}
        </tfoot>
      )}
    </Matrix>
  );
}
