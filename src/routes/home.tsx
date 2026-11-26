import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import {
  Callout,
  CapabilityMatrix,
  LABELS,
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
import { MAX_PICK, MIN_PICK } from "../components/compare/model.ts";

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
  const title = `Framework Compare: how ${data.frameworks.length} web frameworks support ${data.features.length} performance features`;
  const description = `See how ${data.frameworks.length} web meta-frameworks support ${data.features.length} performance features, from built in (1st-party) to build it yourself (Manual). Labels come from each framework's documentation. They describe capability, not measured speed.`;
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
  const otherCount = features.length - fcpCount;
  const maxPoints = LABELS["first-party"].points;

  return (
    <>
      <PageHeader
        eyebrow="Capability reference · scored from documentation"
        title={`How ${frameworks.length} web frameworks support ${features.length} performance features`}
        lede={
          <>
            We read each framework's docs and gave every feature one label. <strong>1st-party</strong> means it's built
            in ({LABELS["first-party"].points} points). <strong>Experimental</strong> means it's built in but flagged or
            unstable, and <strong>Third-party</strong> means you add a package ({LABELS.experimental.points} point each).{" "}
            <strong>Manual</strong> means you build it yourself ({LABELS.manual.points} points). Add them up for a score
            out of {maxTotal}. These scores come from documentation, not from measuring anything.
          </>
        }
        meta={
          <>
            <NavLink to={{ route: "methodology" }} class="link">
              Methodology: how labels and scores are assigned
            </NavLink>
            <NavLink to={{ route: "measured" }} class="link">
              Measured: first-paint timings from Lighthouse
            </NavLink>
            <NavLink to={{ route: "benchmark" }} class="link">
              Benchmark: our latest PageSpeed Insights run
            </NavLink>
          </>
        }
        aside={
          <StatGroup cols={2} class="lg:w-80">
            <Stat label="Frameworks" value={frameworks.length} hint={`${coreCount} core, ${frameworks.length - coreCount} additional`} />
            <Stat label="Features" value={features.length} hint={`${fcpCount} first-paint levers, ${otherCount} other`} />
            <Stat label="Labels" value={cells.length} hint="one per framework and feature" />
            <Stat label="Top score" value={topScore} unit={`/${maxTotal}`} hint={listNames(leaders.map((f) => f.name))} />
          </StatGroup>
        }
      />

      <Container class="pt-6">
        <Callout kind="caveat" title="Capability, not speed">
          <p>
            A label records what the documentation says a framework provides and how much of it you have to build
            yourself. It does not tell you how fast a site built with that framework will be, and a higher score does
            not mean a faster site. Timings from real deployments are on the{" "}
            <NavLink to={{ route: "measured" }}>Measured</NavLink> and <NavLink to={{ route: "benchmark" }}>Benchmark</NavLink>{" "}
            pages.
          </p>
        </Callout>
      </Container>

      <Section
        id="matrix"
        index="01"
        title="Capability matrix"
        intro={
          <>
            Features run down the side and frameworks across the top, highest score first. Each cell links to the
            steps for enabling that feature in that framework.
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
          1st-party is worth {LABELS["first-party"].points} points, Experimental and Third-party{" "}
          {LABELS.experimental.points}, Manual {LABELS.manual.points}. First-paint levers are the features that
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
            Each row adds up one framework's points from the matrix. Frameworks with the same total share a rank. The{" "}
            {coreCount} core frameworks have a full how-to section for every feature. The{" "}
            {frameworks.length - coreCount} additional ones are scored from shorter notes on their documentation.
          </>
        }
      >
        <RankingTable frameworks={frameworks} maxTotal={maxTotal} />
      </Section>

      <Section
        id="features"
        index="03"
        title={`The ${features.length} features`}
        intro={`What each row of the matrix covers, and how many of the ${frameworks.length} frameworks build it in as 1st-party.`}
        actions={
          <NavLink to={{ route: "compare" }} class="link">
            Compare {MIN_PICK} to {MAX_PICK} frameworks side by side
          </NavLink>
        }
      >
        <FeatureIndex features={features} frameworkCount={frameworks.length} />
      </Section>
    </>
  );
}
