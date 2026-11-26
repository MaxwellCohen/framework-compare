import type { RouteComponentProps } from "@pracht/core";
import {
  Container,
  LabelBadge,
  LABEL_ORDER,
  LABELS,
  NavLink,
  PageHeader,
  Tag,
} from "../components/index.ts";
import site from "../data/site.json";
import {
  DocSection,
  RankingTable,
  Toc,
  VersionList,
} from "../components/methodology/parts.tsx";
import type { FeatureId } from "../data/types.ts";
import { markdownAlternate, pageLd } from "../agents.ts";

export async function loader() {
  const {
    capability,
    featureTests,
    frameworks,
    getFramework,
    hasPort,
    measured,
    MAX_SCORE,
  } = await import("../data/index.ts");
  const top = capability.ranking[0];
  const topFw = getFramework(top.frameworkId)!;
  const slim = (f: (typeof frameworks)[number]) => ({
    id: f.id,
    name: f.name,
    shortName: f.shortName,
    version: f.version,
    versionNotes: f.versionNotes,
  });

  const tie = capability.ranking.find((r, i) =>
    capability.ranking.some((o, j) => j !== i && o.rank === r.rank),
  );
  return {
    example: {
      name: topFw.name,
      id: topFw.id,
      fcpScore: top.fcpScore,
      otherScore: top.otherScore,
      total: top.total,
      completeness: top.completeness,
      cells: capability.features
        .filter((f) => f.group === "fcp")
        .map((f) => {
          const c = capability.cells.find(
            (c) => c.frameworkId === top.frameworkId && c.featureId === f.id,
          )!;
          return { id: f.id, name: f.name, label: c.label, points: c.points };
        }),
    },
    tie: tie
      ? {
          rank: tie.rank,
          total: tie.total,
          names: capability.ranking
            .filter((r) => r.rank === tie.rank)
            .map((r) => getFramework(r.frameworkId)!.name),
          next: capability.ranking.find((r) => r.rank > tie.rank)?.rank,
        }
      : null,
    ranking: capability.ranking.map((r) => {
      const f = getFramework(r.frameworkId)!;
      return {
        ...r,
        framework: { id: f.id, name: f.name, shortName: f.shortName },
        tied: capability.ranking.some(
          (o) => o.frameworkId !== r.frameworkId && o.rank === r.rank,
        ),
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
      dates: [
        ...new Set(featureTests.frameworks.map((r) => r.testedAt.slice(0, 10))),
      ].sort(),
    },
    fcpCount: capability.features.filter((f) => f.group === "fcp").length,
    otherCount: capability.features.filter((f) => f.group === "other").length,
    max: MAX_SCORE,
    measuredCount: new Set([
      ...measured.runs.flatMap((r) => r.samples.map((s) => s.frameworkId)),
      ...measured.averages.map((a) => a.frameworkId),
    ]).size,
  };
}

export function head() {
  const title =
    "Methodology: how labels, scores and the ranking work — Framework Compare";
  const description =
    "How Framework Compare labels what each framework supports, how the labels add up to scores and a ranking, and which versions were checked. Every label links the vendor’s own documentation.";
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate("/methodology")],
    script: [pageLd("WebPage", "/methodology", title, description)],
  };
}

/** What "pass" means for each feature test (the same rule in every port). */
const PASS_RULES: { id: FeatureId; name: string; pass: string }[] = [
  {
    id: "css-inlining",
    name: "CSS inlining",
    pass: "The route's HTML has an inline <style> with the route's CSS, and no render-blocking stylesheet link for that CSS.",
  },
  {
    id: "font-optimization",
    name: "Fonts",
    pass: "No request goes to Google Fonts, @font-face sets font-display, and the page preloads the font or ships a size-adjusted fallback.",
  },
  {
    id: "image-pipeline",
    name: "Images",
    pass: "The <img> has a srcset with at least two widths, width and height, lazy loading when offscreen, and its srcset URLs return AVIF or WebP.",
  },
  {
    id: "caching",
    name: "Caching",
    pass: "A route that returns a timestamp or counter returns the same value inside the TTL and a new one after it expires or is invalidated.",
  },
  {
    id: "route-prefetching",
    name: "Prefetching",
    pass: "Hovering a link or scrolling it into view requests the target route's code or data before the click.",
  },
  {
    id: "islands",
    name: "Islands",
    pass: "The interactive island works after hydration, and no JavaScript the page loads contains a marker string from the static component.",
  },
  {
    id: "render-modes",
    name: "Render modes",
    pass: "Two routes in one app render differently: one prerendered (HTML in the build output, same timestamp on every request) and one per request or client-only.",
  },
  {
    id: "reactivity",
    name: "Reactivity",
    pass: "Updating state changes the bound text while the component's render counter stays at 1.",
  },
  {
    id: "bundle-analysis",
    name: "Bundle analysis",
    pass: "The documented analyzer command or plugin writes a report file (HTML or JSON).",
  },
  {
    id: "third-party-scripts",
    name: "Scripts",
    pass: "A stand-in third-party script loads with the documented strategy, is not parser-blocking in <head>, and runs (sets its global, or runs in a worker).",
  },
  {
    id: "multi-host-deployment",
    name: "Multi-host",
    pass: "The port builds for at least two host targets with the framework's adapters, and each build writes its expected output.",
  },
];

const TOC = [
  { hash: "about", label: "What this site is and is not" },
  { hash: "labels", label: "How to read the labels" },
  { hash: "feature-tests", label: "How we test labels" },
  { hash: "scoring", label: "How scoring works" },
  { hash: "ranking", label: "Completeness score and ranking" },
  { hash: "versions", label: "Versions checked" },
];

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const total = data.frameworks.length;
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Methodology"
        lede={`How each of the ${total} frameworks gets a label for each of the ${data.featureCount} features, how the labels add up to scores and a ranking, and which versions were checked.`}
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
          <DocSection
            id="about"
            index="01"
            title="What this site is and is not"
          >
            <p class="max-w-prose text-ink-2">
              The site’s measured numbers are on two pages.{" "}
              <NavLink to={{ route: "measured" }} class="link">
                FCP bands
              </NavLink>{" "}
              uses mobile Lighthouse runs of the Books demo app in{" "}
              {data.measuredCount} frameworks to explain why First Contentful
              Paint (FCP) clusters into bands.{" "}
              <NavLink to={{ route: "benchmark" }} class="link">
                Benchmark
              </NavLink>{" "}
              has our latest PageSpeed Insights run. No label, score or rank on
              this page uses them.
            </p>
            {data.noPort.length > 0 && (
              <p class="mt-3 max-w-prose text-ink-2">
                {total - data.noPort.length} of the {total} frameworks have a
                port of the Books demo app. No Books port yet:{" "}
                {data.noPort.join(", ")}. These are labeled and ranked from
                vendor docs like the rest, and have no deployments, benchmark
                runs or FCP data.
              </p>
            )}
          </DocSection>

          <DocSection id="labels" index="02" title="How to read the labels">
            <p class="mb-5 max-w-prose text-ink-2">
              Each framework gets one of four labels for each feature, taken
              from its own documentation.
            </p>
            <div class="overflow-x-auto rounded-sm border border-rule-strong bg-surface">
              <table class="w-full min-w-[30rem] border-collapse text-sm">
                <thead>
                  <tr class="border-b border-rule-strong text-left">
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Label
                    </th>
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Meaning
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-rule">
                  {LABEL_ORDER.map((label) => (
                    <tr key={label}>
                      <td class="px-4 py-2.5 whitespace-nowrap">
                        <LabelBadge label={label} />
                      </td>
                      <td class="num px-4 py-2.5 text-ink">
                        {LABELS[label].points}
                      </td>
                      <td class="px-4 py-2.5 text-ink-2">
                        {LABELS[label].description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 class="mt-8 mb-2 font-semibold text-ink">
              How a cell gets its label
            </h3>
            <ul class="max-w-prose list-disc space-y-2 pl-5 text-ink-2">
              {site.labelRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </DocSection>

          <DocSection id="feature-tests" index="03" title="How we test labels">
            <div class="max-w-prose space-y-4 text-ink-2">
              <p>
                {data.tests.ports} Books ports have a <code>feature-tests</code>{" "}
                branch, with one route per feature under{" "}
                <code>/feature-tests/</code> and one Playwright spec per
                feature. The route uses the feature the way the label says: the
                framework's own API for 1st-party, its flagged option for
                Experimental, the cited package for Third-party, and
                hand-written code for Manual.
              </p>
              <p>
                The spec runs against a production build served locally, in
                Chrome. Bundle analysis and multi-host deployment are checked on
                the build output instead of a page. Pass means the spec saw the
                behaviour below. Fail means it did not, and the card shows what
                it saw instead.
              </p>
            </div>
            <dl class="mt-5 max-w-prose divide-y divide-rule rounded-sm border border-rule-strong bg-surface text-sm">
              {PASS_RULES.map((r) => (
                <div
                  key={r.id}
                  class="grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
                >
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
              The latest run covers {data.tests.ports} ports and{" "}
              {data.tests.results} cells, on {data.tests.dates.join(" and ")}.{" "}
              <span class="num">{data.tests.passed}</span> passed and{" "}
              <span class="num">{data.tests.failed.length}</span> failed
              {data.tests.failed.length ? ": " : "."}
              {data.tests.failed.map((f, i) => (
                <>
                  {i > 0 &&
                    (i === data.tests.failed.length - 1 ? " and " : ", ")}
                  <NavLink
                    to={{
                      route: "feature",
                      id: f.featureId,
                      hash: f.frameworkId,
                    }}
                    class="link"
                  >
                    {f.framework} {f.feature.toLowerCase()}
                  </NavLink>
                </>
              ))}
              {data.tests.failed.length ? "." : ""} A test result does not
              change a label or a score. When a test contradicts a label, we
              check the vendor docs again and fix the label if the docs support
              the change.
            </p>
          </DocSection>

          <DocSection
            id="scoring"
            index="04"
            title="How scoring works, with a worked example"
          >
            <div class="max-w-prose space-y-4 text-ink-2">
              <p>
                A label is worth its points: 1st-party 2, Experimental and
                Third-party 1, Manual 0. The {data.fcpCount} FCP levers add up
                to a score out of {data.max.fcp}, and the {data.otherCount}{" "}
                other features to a score out of {data.max.other}. Every feature
                counts the same.
              </p>
              <p>
                To check a score by hand, read down a framework’s column in the
                matrix and add the points. Here is {data.example.name}’s FCP
                levers score:
              </p>
            </div>
            <div class="mt-5 max-w-prose overflow-x-auto rounded-sm border border-rule-strong bg-surface">
              <table class="w-full min-w-[26rem] border-collapse text-sm">
                <thead>
                  <tr class="border-b border-rule-strong text-left">
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      {data.example.name}, FCP levers
                    </th>
                    <th scope="col" class="eyebrow px-4 py-2 font-normal">
                      Label
                    </th>
                    <th
                      scope="col"
                      class="eyebrow px-4 py-2 text-right font-normal"
                    >
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-rule">
                  {data.example.cells.map((c) => (
                    <tr key={c.id}>
                      <td class="px-4 py-2.5">
                        <NavLink
                          to={{
                            route: "feature",
                            id: c.id as FeatureId,
                            hash: data.example.id,
                          }}
                          class="link"
                        >
                          {c.name}
                        </NavLink>
                      </td>
                      <td class="px-4 py-2.5 whitespace-nowrap">
                        <LabelBadge label={c.label} showPoints={false} />
                      </td>
                      <td class="num px-4 py-2.5 text-right text-ink">
                        {c.points}
                      </td>
                    </tr>
                  ))}
                  <tr class="border-t border-rule-strong">
                    <th
                      scope="row"
                      class="px-4 py-2.5 text-left font-semibold text-ink"
                      colSpan={2}
                    >
                      Total
                    </th>
                    <td class="num px-4 py-2.5 text-right font-semibold text-ink">
                      {data.example.fcpScore}
                      <span class="font-normal text-ink-3">
                        /{data.max.fcp}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </DocSection>

          <DocSection
            id="ranking"
            index="05"
            title="Completeness score and ranking"
          >
            <div class="max-w-prose space-y-4 text-ink-2">
              <p>
                The total is the two scores added together, out of{" "}
                {data.max.fcp + data.max.other}. Completeness is the total
                divided by {data.max.fcp + data.max.other}, rounded to a whole
                percent. For {data.example.name}:{" "}
                <span class="num">
                  {data.example.fcpScore} + {data.example.otherScore} ={" "}
                  {data.example.total}
                </span>
                , and{" "}
                <span class="num">
                  {data.example.total} / {data.max.fcp + data.max.other}
                </span>{" "}
                rounds to <span class="num">{data.example.completeness}%</span>.
              </p>
              <p>
                Frameworks are ranked by total. Equal totals share a rank, and
                the next rank skips ahead
                {data.tie && data.tie.next
                  ? `: ${data.tie.names.join(" and ")} both have ${data.tie.total} points and share rank ${data.tie.rank}, so the next framework is ${data.tie.next}`
                  : ""}
                .
              </p>
              <p>
                The score counts how many speed features a framework gives you,
                not how fast its pages are. No measurement goes into it. For
                measured numbers, see{" "}
                <NavLink to={{ route: "benchmark" }} class="link">
                  Benchmark
                </NavLink>
                .
              </p>
            </div>
            <h3 class="mt-8 mb-3 font-semibold text-ink">The ranking</h3>
            <RankingTable rows={data.ranking} max={data.max} />
            <p class="mt-2 max-w-prose text-xs text-ink-3">
              “=” marks a tied rank. Each name links to that framework’s page.
            </p>
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
        </div>
      </Container>
    </>
  );
}
