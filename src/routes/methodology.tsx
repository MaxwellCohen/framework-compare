import type { RouteComponentProps } from "@pracht/core";
import { Callout, Container, LabelBadge, LABELS, NavLink, PageHeader, Prose, Tag } from "../components/index.ts";
import { ClaimList, DocSection, RankingTable, Toc, VersionList } from "../components/methodology/parts.tsx";
import type { FeatureId, Label } from "../data/types.ts";

export async function loader() {
  const { capability, featureTests, frameworks, getFramework, hasPort, measured, MAX_SCORE } = await import("../data/index.ts");
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
    tests: {
      ports: featureTests.frameworks.length,
      results: featureTests.results.filter((r) => r.status !== "n/a").length,
      passed: featureTests.results.filter((r) => r.status === "pass").length,
      failed: featureTests.results
        .filter((r) => r.status === "fail")
        .map((r) => ({
          frameworkId: r.frameworkId,
          featureId: r.featureId,
          framework: getFramework(r.frameworkId)!.shortName,
          feature: capability.features.find((f) => f.id === r.featureId)!.name,
        })),
      dates: [...new Set(featureTests.frameworks.map((r) => r.testedAt.slice(0, 10)))].sort(),
    },
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
          "How Framework Compare labels what each framework supports, how the scores and the completeness ranking are calculated, which versions were checked, and which claims are uncertain. Every label comes from the vendor’s own documentation.",
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

/** What "pass" means for each feature test (the same rule in every port). */
const PASS_RULES: { id: FeatureId; name: string; pass: string }[] = [
  { id: "css-inlining", name: "CSS inlining", pass: "The route's HTML has an inline <style> with the route's CSS, and no render-blocking stylesheet link for that CSS." },
  { id: "font-optimization", name: "Fonts", pass: "No request goes to Google Fonts, @font-face sets font-display, and the page preloads the font or ships a size-adjusted fallback." },
  { id: "image-pipeline", name: "Images", pass: "The <img> has a srcset with at least two widths, width and height, lazy loading when offscreen, and its srcset URLs return AVIF or WebP." },
  { id: "caching", name: "Caching", pass: "A route that returns a timestamp or counter returns the same value inside the TTL and a new one after it expires or is invalidated." },
  { id: "route-prefetching", name: "Prefetching", pass: "Hovering a link or scrolling it into view requests the target route's code or data before the click." },
  { id: "islands", name: "Islands", pass: "The interactive island works after hydration, and no JavaScript the page loads contains a marker string from the static component." },
  { id: "render-modes", name: "Render modes", pass: "Two routes in one app render differently: one prerendered (HTML in the build output, same timestamp on every request) and one per request or client-only." },
  { id: "reactivity", name: "Reactivity", pass: "Updating state changes the bound text while the component's render counter stays at 1." },
  { id: "bundle-analysis", name: "Bundle analysis", pass: "The documented analyzer command or plugin writes a report file (HTML or JSON)." },
  { id: "third-party-scripts", name: "Scripts", pass: "A stand-in third-party script loads with the documented strategy, is not parser-blocking in <head>, and runs (sets its global, or runs in a worker)." },
  { id: "multi-host-deployment", name: "Multi-host", pass: "The port builds for at least two host targets with the framework's adapters, and each build writes its expected output." },
];

const TOC = [
  { hash: "about", label: "What this site is and is not" },
  { hash: "labels", label: "How to read the labels" },
  { hash: "feature-tests", label: "How we test labels" },
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

          <DocSection id="feature-tests" index="03" title="How we test labels">
            <div class="max-w-prose space-y-4 text-ink-2">
              <p>
                Every framework has a port of the Books demo app. Each port has a <code>feature-tests</code> branch with one
                route per feature under <code>/feature-tests/</code> and one Playwright spec per feature. The route uses the
                feature the way the label says: the framework's own API for 1st-party, its flagged option for
                Experimental, the cited package for Third-party, and hand-written code for Manual.
              </p>
              <p>
                The spec runs against a production build served locally, in Chrome. Bundle analysis and multi-host
                deployment are checked on the build output instead of a page. Pass means the spec saw the behaviour
                below. Fail means it did not, and the card shows what it saw instead.
              </p>
            </div>
            <dl class="mt-5 max-w-prose divide-y divide-rule rounded-sm border border-rule-strong bg-surface text-sm">
              {PASS_RULES.map((r) => (
                <div key={r.id} class="grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                  <dt class="font-semibold text-ink">
                    <NavLink to={{ route: "feature", id: r.id }} class="link">
                      {r.name}
                    </NavLink>
                  </dt>
                  <dd class="text-ink-2">{r.pass}</dd>
                </div>
              ))}
            </dl>
            <p class="mt-5 max-w-prose text-ink-2">
              The latest run covers {data.tests.ports} ports and {data.tests.results} cells, on{" "}
              {data.tests.dates.join(" and ")}. <span class="num">{data.tests.passed}</span> passed and{" "}
              <span class="num">{data.tests.failed.length}</span> failed
              {data.tests.failed.length ? ": " : "."}
              {data.tests.failed.map((f, i) => (
                <>
                  {i > 0 && (i === data.tests.failed.length - 1 ? " and " : ", ")}
                  <NavLink to={{ route: "feature", id: f.featureId, hash: f.frameworkId }} class="link">
                    {f.framework} {f.feature.toLowerCase()}
                  </NavLink>
                </>
              ))}
              {data.tests.failed.length ? "." : ""} A test result does not change a label or a score. When a test
              contradicts a label, we check the vendor docs and fix the label in the source document.
            </p>
          </DocSection>

          <DocSection id="scoring" index="04" title="How scoring works, with a worked example">
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

          <DocSection id="ranking" index="05" title="Completeness score and ranking">
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

          <DocSection id="reading" index="06" title="Reading the other-features scores">
            <p class="mb-4 max-w-prose text-sm text-ink-3">
              The source’s summary of the {data.otherFeatureCount} “other features” (the ones that are not FCP levers, max{" "}
              {data.otherMax} points).
            </p>
            <div class="max-w-prose">
              <Prose html={data.otherFeaturesSummaryHtml} />
            </div>
          </DocSection>

          <DocSection id="versions" index="07" title="Versions checked">
            <p class="mb-5 max-w-prose text-ink-2">
              The labels describe these versions.
            </p>
            <VersionList
              title={`Frameworks (${data.frameworks.length})`}
              aside="Version checked, with notes"
              frameworks={data.frameworks}
            />
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
