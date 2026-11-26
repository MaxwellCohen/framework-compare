import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import {
  CapabilityMatrix,
  LABELS,
  LabelLegend,
  NavLink,
  PageHeader,
  Section,
  Stat,
  StatGroup,
} from "../components/index.ts";
import { RankingTable } from "../components/home/RankingTable.tsx";

/**
 * Returns only what the page prints: scores and names per framework, names and
 * one-line summaries per feature, and label + points per cell. No `*Html` bodies.
 */
export async function loader() {
  const { cells, features, frameworksByRank, MAX_TOTAL } = await import("../data/index.ts");
  const ranked = frameworksByRank();

  return {
    maxTotal: MAX_TOTAL,
    // Columns of the matrix and rows of the ranking, both in rank order
    // (ties keep the source document's column order).
    frameworks: ranked.map((f) => ({
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
    })),
    features: features.map((f) => ({
      id: f.id,
      number: f.number,
      name: f.name,
      shortName: f.shortName,
      group: f.group,
      summary: f.summary,
      firstParty: cells.filter((c) => c.featureId === f.id && c.label === "first-party").length,
    })),
    cells: cells.map((c) => ({
      frameworkId: c.frameworkId,
      featureId: c.featureId,
      label: c.label,
      points: c.points,
    })),
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const title = `Framework Compare: the speed features meta-frameworks give you`;
  const description = `Compare the ${data.features.length} features ${data.frameworks.length} meta-frameworks offer to make sites fast, from CSS inlining and image optimization to route prefetching and islands. See which ones each framework builds in and which you have to add yourself.`;
  return {
    title,
    meta: [
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  };
}

/** "Nuxt and Astro", "A, B and C". */
function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const { frameworks, features, cells, maxTotal } = data;
  const topScore = frameworks[0].total;
  const leaders = frameworks.filter((f) => f.total === topScore);
  const fcpCount = features.filter((f) => f.group === "fcp").length;
  const otherCount = features.length - fcpCount;
  const maxPoints = LABELS["first-party"].points;

  return (
    <>
      <PageHeader
        eyebrow="Performance features, compared"
        title={`The speed features meta-frameworks give you`}
        lede={
          <>
            Frameworks ship features to make your site fast: inlined CSS, image optimization, route prefetching,
            islands and more. This
            compares {features.length} of them across {frameworks.length} frameworks. For each one, we checked the
            framework's docs and gave it a label. <strong>1st-party</strong> means it's built
            in ({LABELS["first-party"].points} points). <strong>Experimental</strong> means it's built in but flagged or
            unstable, and <strong>Third-party</strong> means you add a package ({LABELS.experimental.points} point each).{" "}
            <strong>Manual</strong> means you build it yourself ({LABELS.manual.points} points). Add them up for a score
            out of {maxTotal}: the higher it is, the more speed features come built in.
          </>
        }
        meta={
          <>
            <NavLink to={{ route: "methodology" }} class="link">
              Methodology: how labels and scores are assigned
            </NavLink>
            <NavLink to={{ route: "measured" }} class="link">
              FCP bands: why first paint comes in steps
            </NavLink>
            <NavLink to={{ route: "benchmark" }} class="link">
              Benchmark: our latest PageSpeed Insights run
            </NavLink>
          </>
        }
        aside={
          <StatGroup cols={2} class="lg:w-80">
            <Stat label="Frameworks" value={frameworks.length} hint="each with its own port of the books demo" />
            <Stat label="Features" value={features.length} hint={`${fcpCount} first-paint levers, ${otherCount} other`} />
            <Stat label="Labels" value={cells.length} hint="one per framework and feature" />
            <Stat label="Top score" value={topScore} unit={`/${maxTotal}`} hint={listNames(leaders.map((f) => f.name))} />
          </StatGroup>
        }
      />

      <Section
        id="matrix"
        index="01"
        title="Capability matrix"
        intro={
          <>
            Speed features run down the side and frameworks across the top, highest score first. Each cell links to
            the steps for turning that feature on in that framework.
          </>
        }
        actions={<LabelLegend />}
      >
        <CapabilityMatrix
          frameworks={frameworks}
          features={features}
          cells={cells}
          label={`Capability matrix: ${features.length} features by ${frameworks.length} frameworks`}
        />
        <p class="mt-3 max-w-prose text-sm text-ink-2">
          First-paint levers are the features that
          decide how soon the browser shows the first content on screen. Together the {fcpCount} levers are worth up
          to {fcpCount * maxPoints} points, and the {otherCount} other features up to {otherCount * maxPoints}. To put a
          few frameworks side by side, use{" "}
          <NavLink to={{ route: "compare" }} class="link">
            Compare
          </NavLink>
          .
        </p>
      </Section>

      <Section
        id="ranking"
        index="02"
        title="Ranking"
        intro={
          <>
            Each row adds up one framework's points from the matrix. Frameworks with the same total share a rank.
          </>
        }
      >
        <RankingTable frameworks={frameworks} maxTotal={maxTotal} />
      </Section>
    </>
  );
}
