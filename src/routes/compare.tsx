import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import { Container, NavLink, PageHeader } from "../components/index.ts";
import { encodeLabel, MAX_PICK, MIN_PICK, type CompareFeature, type CompareFramework } from "../components/compare/model.ts";
import CompareView from "../islands/CompareView.tsx";

/**
 * The compact matrix for the island: names, scores and one label code per cell
 * for every framework, plus feature names and one-line summaries. No `*Html`.
 */
export async function loader() {
  const { features, frameworksByRank, getCell } = await import("../data/index.ts");
  const ranked = frameworksByRank();

  const frameworks: CompareFramework[] = ranked.map((f) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    group: f.group,
    fcpScore: f.fcpScore,
    otherScore: f.otherScore,
    total: f.total,
    completeness: f.completeness,
    rank: f.rank,
    tied: ranked.some((o) => o.id !== f.id && o.rank === f.rank),
    labels: features.map((feature) => encodeLabel(getCell(f.id, feature.id).label)).join(""),
  }));

  const compareFeatures: CompareFeature[] = features.map((f) => ({
    id: f.id,
    number: f.number,
    name: f.name,
    shortName: f.shortName,
    group: f.group,
    summary: f.summary,
  }));

  return {
    frameworks,
    features: compareFeatures,
    // Default selection: the top three by rank.
    initial: ranked.slice(0, 3).map((f) => f.id),
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const title = "Compare frameworks side by side — Framework Compare";
  const description = `Pick ${MIN_PICK} to ${MAX_PICK} of ${data.frameworks.length} web meta-frameworks and see their labels for ${data.features.length} performance features side by side, plus a list of the features where they differ. Labels come from vendor documentation, not from measurements.`;
  return {
    title,
    meta: [
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  };
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Matrix", to: { route: "home" } }, { label: "Compare" }]}
        title="Compare frameworks side by side"
        lede={
          <>
            Pick {MIN_PICK} to {MAX_PICK} frameworks to see their scores, their columns of the capability matrix and
            the features where their labels differ. Labels describe what each framework's documentation says it
            provides, not how fast it is. The{" "}
            <NavLink to={{ route: "methodology" }} class="link">
              Methodology
            </NavLink>{" "}
            page explains how labels are scored.
          </>
        }
      />
      <noscript>
        <Container class="pt-6">
          <p class="border-l-[3px] border-rule-strong bg-sunken px-4 py-3 text-ink-2">
            Changing the selection needs JavaScript. Without it, this page compares the top three frameworks by
            rank. The{" "}
            <NavLink to={{ route: "home", hash: "matrix" }} class="underline underline-offset-2">
              full matrix
            </NavLink>{" "}
            shows all {data.frameworks.length}.
          </p>
        </Container>
      </noscript>
      <CompareView frameworks={data.frameworks} features={data.features} initial={data.initial} />
    </>
  );
}
