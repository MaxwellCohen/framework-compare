import type { Feature, FeatureGroup } from "../../data/types.ts";
import { featureNo } from "../Chips.tsx";
import { NavLink } from "../links.tsx";

export type IndexedFeature = Pick<Feature, "id" | "number" | "name" | "group" | "summary"> & {
  /** How many frameworks are labelled 1st-party for this feature. */
  firstParty: number;
};

const GROUPS: { id: FeatureGroup; title: string }[] = [
  { id: "fcp", title: "First-paint levers" },
  { id: "other", title: "Other features" },
];

/** Compact index of the features, split into the two groups; each entry links to its feature page. */
export function FeatureIndex({ features, frameworkCount }: { features: IndexedFeature[]; frameworkCount: number }) {
  return (
    <div class="space-y-7">
      {GROUPS.map((group) => {
        const rows = features.filter((f) => f.group === group.id);
        if (!rows.length) return null;
        return (
          <div key={group.id}>
            <h3 class="eyebrow mb-2 !text-ink-2">
              {group.title} · {rows.length}
            </h3>
            <ul class="grid overflow-hidden rounded-sm border border-rule-strong bg-paper sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((f) => (
                <li key={f.id} class="-mr-px -mb-px flex border-r border-b border-rule">
                  <NavLink
                    to={{ route: "feature", id: f.id }}
                    class="group flex w-full flex-col gap-1.5 px-4 py-3 hover:bg-surface"
                  >
                    <span class="flex items-baseline gap-2">
                      <span class="num text-xs text-ink-3">{featureNo(f.number)}</span>
                      <span class="font-semibold text-ink underline-offset-4 decoration-1 group-hover:underline">
                        {f.name}
                      </span>
                    </span>
                    <span class="text-sm text-ink-2 text-pretty">{f.summary}</span>
                    <span class="num mt-auto pt-1 text-xs text-ink-3">
                      <span class="font-semibold text-ink">{f.firstParty}</span> of {frameworkCount} 1st-party
                    </span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
