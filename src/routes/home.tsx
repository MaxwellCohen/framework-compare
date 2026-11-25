import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import {
  Callout,
  CapabilityMatrix,
  Container,
  LabelLegend,
  NavLink,
  PageHeader,
  Section,
  Stat,
  StatGroup,
} from "../components/index.ts";
import { FeatureIndex } from "../components/home/FeatureIndex.tsx";
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
  const title = "Framework Bench: what 15 web frameworks provide for 12 performance features";
  const description = `A capability matrix of ${data.frameworks.length} web meta-frameworks across ${data.features.length} performance features, labelled 1st-party, Experimental, Third-party or Manual from vendor documentation. The labels describe documented capability; they are not speed measurements.`;
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
  const coreCount = frameworks.filter((f) => f.group === "core").length;
  const fcpCount = features.filter((f) => f.group === "fcp").length;

  return (
    <>
      <PageHeader
        eyebrow="Capability reference · scored from documentation"
        title={`What ${frameworks.length} web frameworks give you, out of the box, for ${features.length} performance features`}
        lede={
          <>
            Each framework gets one label per feature (1st-party, Experimental, Third-party or Manual), taken from
            its vendor documentation. The labels add up to a score out of {maxTotal}. Nothing on this page was
            measured.
          </>
        }
        meta={
          <>
            <NavLink to={{ route: "methodology" }} class="link">
              Methodology: the labels and the scoring rubric
            </NavLink>
            <NavLink to={{ route: "measured" }} class="link">
              Measured: Lighthouse lab data
            </NavLink>
          </>
        }
        aside={
          <StatGroup cols={2} class="lg:w-80">
            <Stat label="Frameworks" value={frameworks.length} hint={`${coreCount} core, ${frameworks.length - coreCount} additional`} />
            <Stat label="Features" value={features.length} hint={`${fcpCount} first-paint levers, ${features.length - fcpCount} other`} />
            <Stat label="Cells" value={cells.length} hint="one label each" />
            <Stat label="Top score" value={topScore} unit={`/${maxTotal}`} hint={listNames(leaders.map((f) => f.name))} />
          </StatGroup>
        }
      />

      <Container class="pt-6">
        <Callout kind="caveat" title="Capability, not speed">
          <p>
            A label records what the documentation says a framework provides and how much of it you have to build
            yourself. It does not say how fast a site built with that framework is, and a higher score is not a
            performance result. Timings from real deployments are on the{" "}
            <NavLink to={{ route: "measured" }}>Measured</NavLink> page.
          </p>
        </Callout>
      </Container>

      <Section
        id="matrix"
        index="01"
        title="Capability matrix"
        intro={
          <>
            Features in rows, frameworks in columns, ordered by total score. Each cell links to the how-to for that
            framework on the feature page.
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
          1st-party scores 2 points, Experimental and Third-party 1, Manual 0. The five first-paint levers add up
          to 10 points and the seven other features to 14. To read a few columns side by side, use{" "}
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
            The matrix summed per framework. Frameworks with the same total share a rank. The {coreCount} core
            frameworks have a full how-to section for every feature; the {frameworks.length - coreCount} additional
            ones are scored from shorter documentation notes.
          </>
        }
      >
        <RankingTable frameworks={frameworks} maxTotal={maxTotal} />
      </Section>

      <Section
        id="features"
        index="03"
        title="The 12 features"
        intro="What each row of the matrix means, and how many of the 15 frameworks provide it 1st-party."
        actions={
          <NavLink to={{ route: "compare" }} class="link">
            Compare 2 to 4 frameworks side by side
          </NavLink>
        }
      >
        <FeatureIndex features={features} frameworkCount={frameworks.length} />
      </Section>
    </>
  );
}
