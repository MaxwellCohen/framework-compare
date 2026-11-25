import type { RouteComponentProps } from "@pracht/core";
import { Callout, Container, LabelBadge, LABELS, NavLink, PageHeader, Prose, Tag } from "../components/index.ts";
import { ClaimList, DocSection, RankingTable, Toc, VersionList } from "../components/methodology/parts.tsx";
import type { Label } from "../data/types.ts";

export async function loader() {
  const { capability, frameworks, getFramework, measured, MAX_SCORE } = await import("../data/index.ts");
  const m = capability.methodology;
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
    core: frameworks.filter((f) => f.group === "core").map(slim),
    additional: frameworks.filter((f) => f.group === "additional").map(slim),
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
          "How Framework Compare labels what each framework supports, how the scores and the completeness ranking are calculated, which versions were checked, and which claims are uncertain. Labels come from vendor documentation, read with AI assistance. They describe capability, not measured speed.",
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
  { hash: "additional-frameworks", label: "Additional frameworks" },
  { hash: "lower-confidence", label: "Lower-confidence claims" },
];

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const total = data.core.length + data.additional.length;
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
            <Tag>Capability, not measurement</Tag>
          </>
        }
      />

      <Container class="grid gap-x-12 gap-y-8 py-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:py-10">
        <aside class="min-w-0">
          <Toc items={TOC} />
        </aside>

        <div class="min-w-0 max-w-[52rem]">
          <DocSection id="about" index="01" title="What this site is and is not">
            <Callout kind="caveat" title="Capability from documentation, not measurement">
              <Prose size="sm" html={data.disclaimerHtml} />
            </Callout>
            <p class="mt-4 max-w-prose text-ink-2">
              The site’s only measured numbers are on the{" "}
              <NavLink to={{ route: "measured" }} class="link">
                Measured
              </NavLink>{" "}
              page: lab results for mobile Lighthouse First Contentful Paint (FCP), from the Books demo app built in{" "}
              {data.measuredCount} frameworks. No label, score or rank on this page uses them.
            </p>
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
              Points count documented capabilities. They do not measure speed. “=” marks a tied rank. Each name links to that
              framework’s page.
            </p>
          </DocSection>

          <DocSection id="reading" index="05" title="Reading the other-features scores">
            <p class="mb-4 max-w-prose text-sm text-ink-3">
              The source’s summary of the {data.otherFeatureCount} “other features” (the ones that are not FCP levers, max{" "}
              {data.otherMax} points) for the {data.core.length} core frameworks.
            </p>
            <div class="max-w-prose">
              <Prose html={data.otherFeaturesSummaryHtml} />
            </div>
          </DocSection>

          <DocSection id="versions" index="06" title="Versions checked">
            <p class="mb-5 max-w-prose text-ink-2">
              The labels describe these versions. Core frameworks have full how-to sections in the source. Additional frameworks
              are scored from shorter documentation notes (see{" "}
              <NavLink to={{ route: "methodology", hash: "additional-frameworks" }} class="link">
                Additional frameworks
              </NavLink>
              ).
            </p>
            <div class="grid gap-5">
              <VersionList
                title={`Core frameworks (${data.core.length})`}
                aside="Version used in the Books demo app, with notes"
                frameworks={data.core}
              />
              <VersionList
                title={`Additional frameworks (${data.additional.length})`}
                aside="Version the documentation was read at"
                frameworks={data.additional}
              />
            </div>
          </DocSection>

          <DocSection id="additional-frameworks" index="07" title="Additional frameworks">
            <div class="max-w-prose">
              <Prose html={data.additionalFrameworksHtml} />
            </div>
          </DocSection>

          <DocSection id="lower-confidence" index="08" title="Lower-confidence claims">
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
