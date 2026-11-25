import type { FeatureGroup, FeatureId, FrameworkId, Label } from "../../data/types.ts";
import { href } from "../../pracht-routes.ts";
import { featureNo } from "../Chips.tsx";
import { LabelBadge, LABELS } from "../LabelBadge.tsx";
import { Matrix, MatrixGroupRow, MatrixHead, MatrixRow } from "../Matrix.tsx";
import type { CompareFeature, CompareFramework } from "./model.ts";

/*
 * Links for use inside an island. `NavLink` renders pracht's `<Link>`, which
 * throws when hydrated outside a route tree ("<Link route=...> must render
 * inside a pracht route tree"), so island code uses a plain `<a>` with a path
 * from the generated, typed `href()` helper instead.
 */
export function frameworkHref(id: FrameworkId) {
  return href("framework", { params: { id } });
}
export function featureHref(id: FeatureId, frameworkId?: FrameworkId) {
  return href("feature", { params: { id } }) + (frameworkId ? `#${frameworkId}` : "");
}

const GROUPS: { id: FeatureGroup; title: string; max: string }[] = [
  { id: "fcp", title: "First-paint levers", max: "2 pts each · max 10" },
  { id: "other", title: "Other features", max: "2 pts each · max 12" },
];

/**
 * The capability matrix narrowed to the picked frameworks. Same markup and
 * classes as the kit's `CapabilityMatrix` (it reuses the `Matrix` frame and the
 * `.mx-*` styles), but with plain anchors so it can hydrate inside the compare
 * island. `labelOf(framework, featureIndex)` supplies each cell.
 */
export function CompareMatrix({
  frameworks,
  features,
  labelOf,
  label,
  class: cls,
}: {
  frameworks: CompareFramework[];
  features: CompareFeature[];
  labelOf: (framework: CompareFramework, featureIndex: number) => Label;
  label: string;
  class?: string;
}) {
  const indexed = features.map((feature, index) => ({ feature, index }));
  const footRow = (title: string, max: number, pick: (f: CompareFramework) => number, strong = false) => (
    <MatrixRow>
      <th scope="row" class="mx-rowhead">
        <span>
          <span class={strong ? "font-semibold" : ""}>{title}</span>
          <span class="num ml-auto text-xs text-ink-3">/{max}</span>
        </span>
      </th>
      {frameworks.map((fw) => (
        <td key={fw.id} class="mx-cell">
          <span class={`num block ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{pick(fw)}</span>
        </td>
      ))}
    </MatrixRow>
  );

  return (
    <Matrix label={label} scrollHint={false} class={cls}>
      <MatrixHead corner="Feature">
        {frameworks.map((fw) => (
          <th key={fw.id} scope="col" class="mx-colhead" title={fw.name}>
            <a href={frameworkHref(fw.id)}>
              <span class="mx-colhead-label">{fw.shortName}</span>
            </a>
          </th>
        ))}
      </MatrixHead>
      <tbody>
        {GROUPS.map((group) => (
          <>
            <MatrixGroupRow span={frameworks.length} aside={group.max}>
              {group.title}
            </MatrixGroupRow>
            {indexed
              .filter(({ feature }) => feature.group === group.id)
              .map(({ feature, index }) => (
                <MatrixRow key={feature.id}>
                  <th scope="row" class="mx-rowhead">
                    <a href={featureHref(feature.id)}>
                      <span class="num text-xs text-ink-3">{featureNo(feature.number)}</span>
                      <span>{feature.shortName}</span>
                    </a>
                  </th>
                  {frameworks.map((fw) => {
                    const cellLabel = labelOf(fw, index);
                    const meta = LABELS[cellLabel];
                    const name = `${fw.name}, ${feature.shortName}: ${meta.text}, ${meta.points} ${meta.points === 1 ? "point" : "points"}`;
                    return (
                      <td key={fw.id} class="mx-cell">
                        <a href={featureHref(feature.id, fw.id)} aria-label={name} title={name}>
                          <LabelBadge label={cellLabel} size="cell" />
                        </a>
                      </td>
                    );
                  })}
                </MatrixRow>
              ))}
          </>
        ))}
      </tbody>
      <tfoot>
        {footRow("First paint", 10, (f) => f.fcpScore)}
        {footRow("Other", 12, (f) => f.otherScore)}
        {footRow("Total", 22, (f) => f.total, true)}
      </tfoot>
    </Matrix>
  );
}
