import type { RouteComponentProps } from "@pracht/core";
import { Callout, Container, LabelBadge, LABELS, NavLink, PageHeader, Prose, Tag } from "../components/index.ts";
import { ClaimList, DocSection, RankingTable, Toc, VersionList } from "../components/methodology/parts.tsx";
import type { Label } from "../data/types.ts";

export async function loader() {
  const { capability, frameworks, getFramework, hasPort, measured, MAX_SCORE } = await import("../data/index.ts");
  const { disclaimerHtml: _disclaimer, additionalFrameworksHtml: _additional, ...m } = capability.methodology;
  const slim = (f: (typeof frameworks)[number]) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    version: f.version,
    versionNotes: f.versionNotes,
  });

  return {
    ...m,
    ranking: capability.ranking.map((r) => {
      const f = getFramework(r.frameworkId)!;
      return {
        ...r,
        framework: { id: f.id, name: f.name, shortName: f.shortName },
        tied: capability.ranking.some((o) => o.frameworkId !== r.frameworkId && o.rank === r.rank),
      };
    }),
    frameworks: frameworks.map(slim),
    noPort: frameworks.filter((f) => !hasPort(f)).map((f) => f.name),
    featureCount: capability.features.length,
    otherFeatureCount: capability.features.filter((f) => f.group === "other").length,
    otherMax: MAX_SCORE.other,
    measuredCount: new Set([
      ...measured.runs.flatMap((r) => r.samples.map((s) => s.frameworkId)),
      ...measured.averages.map((a) => a.frameworkId),
    ]).size,
  };
}

export function head() {
  return {
    title: "Methodology: how labels, scores and the ranking work — Framework Compare",
    meta: [
      {
        name: "description",
        content:
          "How Framework Compare labels what each framework supports, how the scores and the completeness ranking are calculated, which versions were checked, and which claims are uncertain. Labels come from vendor documentation, read with AI assistance.",
      },
    ],
  };
}

/** The source document's emoji marks and the site mark that replaces each. */
const MARKS: { source: string; sourceText: string; label: Label }[] = [
  { source: "✅", sourceText: "1st-party / built-in", label: "first-party" },
  { source: "🧪", sourceText: "Experimental", label: "experimental" },
  { source: "🧪", sourceText: "Third-party", label: "third-party" },
  { source: "🔧", sourceText: "Manual", label: "manual" },
];

const TOC = [
  { hash: "about", label: "What this site is and is not" },
  { hash: "labels", label: "How to read the labels" },
  { hash: "scoring", label: "How scoring works" },
  { hash: "ranking", label: "Completeness score and ranking" },
  { hash: "reading", label: "Reading the other-features scores" },
  { hash: "versions", label: "Versions checked" },
  { hash: "lower-confidence", label: "Lower-confidence claims" },
];

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const total = data.frameworks.length;
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Methodology"
        lede={`How each of the ${total} frameworks gets a label for each of the ${data.featureCount} features, how the labels add up to scores and a ranking, which versions were checked, and which claims are uncertain.`}
        meta={
          <>
            <Tag>From vendor documentation</Tag>
            <Tag>AI-assisted</Tag>
          </>
        }
      />

      <Container class="grid gap-x-12 gap-y-8 py-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-10">
        <aside class="min-w-0">
          <Toc items={TOC} />
        </aside>

        <div class="min-w-0 max-w-[52rem]">
          <DocSection id="about" index="01" title="What this site is and is not">
            <p class="max-w-prose text-ink-2">
              The site’s measured numbers are on two pages.{" "}
              <NavLink to={{ route: "measured" }} class="link">
                FCP bands
              </NavLink>{" "}
              uses mobile Lighthouse runs of the Books demo app in {data.measuredCount} frameworks to explain why First
              Contentful Paint (FCP) clusters into bands.{" "}
              <NavLink to={{ route: "benchmark" }} class="link">
                Benchmark
              </NavLink>{" "}
              has our latest PageSpeed Insights run. No label, score or rank on this page uses them.
            </p>
            {data.noPort.length > 0 && (
              <p class="mt-3 max-w-prose text-ink-2">
                {total - data.noPort.length} of the {total} frameworks have a port of the Books demo app. No Books port yet:{" "}
                {data.noPort.join(", ")}. These are labeled and ranked from vendor docs like the rest, and have no
                deployments, benchmark runs or FCP data.
              </p>
            )}
          </DocSection>

          <DocSection id="labels" index="02" title="How to read the labels">
            <div class="max-w-prose">
              <Prose html={data.labelsHtml} />
            </div>

            <h3 class="mt-8 mb-1 font-semibold text-ink">Marks used on this site</h3>
            <p class="mb-3 max-w-prose text-sm text-ink-2">
              The source document uses three emoji to mark cells. This site uses four marks, because it splits the source’s 🧪
              into Experimental and Third-party, depending on the word in each cell. Both score 1 point.
            </p>
            <div class="overflow-x-auto rounded-sm border border-rule-strong bg-surface">
              <table class="w-full min-w-[34rem] border-collapse text-sm">
                <thead>
                  <tr class="border-b border-rule-strong text-left">
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Source mark
                    </th>
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Site mark
                    </th>
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Short definition
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-rule">
                  {MARKS.map((mark) => (
                    <tr key={mark.label}>
                      <td class="px-4 py-2.5 whitespace-nowrap text-ink-2">
                        <span aria-hidden="true">{mark.source}</span> {mark.sourceText}
                      </td>
                      <td class="px-4 py-2.5 whitespace-nowrap">
                        <LabelBadge label={mark.label} />
                      </td>
                      <td class="px-4 py-2.5 text-ink-2">{LABELS[mark.label].description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p class="mt-2 max-w-prose text-xs text-ink-3">
              The short definitions are this site’s summaries. Where they differ, the rubric above is the one that counts.
            </p>
          </DocSection>

          <DocSection id="scoring" index="03" title="How scoring works, with a worked example">
            <Callout kind="caveat" title="This site scores 11 features, out of 22 points" class="mb-6 max-w-prose">
              <p>
                The source comparison scores 12 features out of 24 points. This site drops its “Art-directed /
                modern-format images (&lt;picture&gt;)” row from the score, so the text quoted below still counts 12
                features. Each framework’s art-direction how-to now appears, unscored, under{" "}
                <NavLink to={{ route: "feature", id: "image-pipeline" }}>Image pipeline</NavLink>. Scores, completeness
                and ranks on this site are recalculated without that row, so they can differ from the source’s ranking.
              </p>
            </Callout>
            <div class="max-w-prose">
              <Prose html={data.scoringHtml} />
            </div>
          </DocSection>

          <DocSection id="ranking" index="04" title="Completeness score and ranking">
            <div class="max-w-prose">
              <Prose html={data.rankingHtml} />
            </div>
            <h3 class="mt-8 mb-3 font-semibold text-ink">The ranking</h3>
            <RankingTable rows={data.ranking} />
            <p class="mt-2 max-w-prose text-xs text-ink-3">
              “=” marks a tied rank. Each name links to that
              framework’s page.
            </p>
          </DocSection>

          <DocSection id="reading" index="05" title="Reading the other-features scores">
            <p class="mb-4 max-w-prose text-sm text-ink-3">
              The source’s summary of the {data.otherFeatureCount} “other features” (the ones that are not FCP levers, max{" "}
              {data.otherMax} points).
            </p>
            <div class="max-w-prose">
              <Prose html={data.otherFeaturesSummaryHtml} />
            </div>
          </DocSection>

          <DocSection id="versions" index="06" title="Versions checked">
            <p class="mb-5 max-w-prose text-ink-2">
              The labels describe these versions.
            </p>
            <VersionList
              title={`Frameworks (${data.frameworks.length})`}
              aside="Version checked, with notes"
              frameworks={data.frameworks}
            />
          </DocSection>

          <DocSection id="lower-confidence" index="07" title="Lower-confidence claims">
            <p class="mb-5 max-w-prose text-ink-2">
              The source flags {data.lowerConfidenceClaims.length} claims as uncertain. They appear in source order, numbered
              here so you can link to each one. Emoji in the text are the source’s marks (see{" "}
              <NavLink to={{ route: "methodology", hash: "labels" }} class="link">
                labels
              </NavLink>
              ).
            </p>
            <ClaimList claims={data.lowerConfidenceClaims} />
          </DocSection>
        </div>
      </Container>
    </>
  );
}
