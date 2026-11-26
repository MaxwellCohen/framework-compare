import { notFound } from "@pracht/core";
import type { HeadArgs, LoaderArgs, RouteComponentProps } from "@pracht/core";
import {
  Container,
  ExternalLink,
  FrameworkName,
  NavLink,
  NO_PORT,
  PageHeader,
  Pager,
  Prose,
  RankBadge,
  ScoreBar,
  Section,
  Stat,
  StatGroup,
  Tag,
} from "../../components/index.ts";
import { LabelTally } from "../../components/feature/LabelTally.tsx";
import { Deployments, ScorecardGroup, type ScorecardRow } from "../../components/framework/Scorecard.tsx";
import { BuildTable, type BuildTableRow } from "../../components/benchmark/BuildTable.tsx";
import { StatusKey } from "../../components/benchmark/parts.tsx";
import { COLD_DOC_MS, longDate } from "../../components/benchmark/format.ts";
import { HostTable, type HostTableRow } from "../../components/benchmark/HostTable.tsx";
import { FieldTable, type FieldTableRow } from "../../components/benchmark/FieldTable.tsx";
import {
  benchBranchRank,
  benchBuildName,
  benchBuildsFor,
  benchHostRank,
  benchPathRank,
  benchmark,
  cells,
  featuresInGroup,
  frameworks,
  frameworksByRank,
  getCell,
  getCellTest,
  getFramework,
  getTestRun,
  LABEL_TEXT,
  MAX_SCORE,
  MAX_TOTAL,
} from "../../data/index.ts";
import type { FeatureGroup, Framework, Label } from "../../data/index.ts";
import { markdownAlternate, pageLd } from "../../agents.ts";

function pagerItem(f: Framework | undefined) {
  return f ? { id: f.id, name: f.name, rank: f.rank } : null;
}

export async function loader({ params }: LoaderArgs) {
  const fw = getFramework(params.id);
  if (!fw) throw notFound(`No framework "${params.id}"`);

  const count = frameworks.length;
  const tally = { "first-party": 0, experimental: 0, "third-party": 0, manual: 0 } satisfies Record<Label, number>;
  let notOutscored = 0;
  let featureCount = 0;

  const rowsFor = (group: FeatureGroup): ScorecardRow[] =>
    featuresInGroup(group).map((feature) => {
      const cell = getCell(fw.id, feature.id);
      const all = cells.filter((c) => c.featureId === feature.id);
      const same = all.filter((c) => c.label === cell.label).length;
      const higher = all.filter((c) => c.points > cell.points).length;
      tally[cell.label] += 1;
      featureCount += 1;
      if (higher === 0) notOutscored += 1;
      const text = LABEL_TEXT[cell.label];
      return {
        feature: { id: feature.id, number: feature.number, name: feature.name, shortName: feature.shortName },
        label: cell.label,
        bodyHtml: cell.bodyHtml,
        exampleHtml: cell.exampleHtml,
        artDirection: cell.artDirection,
        gotchasHtml: cell.gotchasHtml,
        test: getCellTest(fw.id, feature.id),
        comparison:
          (same === 1
            ? `${text}: the only framework of ${count} with this label. `
            : `${text}, like ${same - 1} of the other ${count - 1} frameworks. `) +
          (higher === 0
            ? "None scores higher."
            : `${higher} ${higher === 1 ? "framework scores" : "frameworks score"} higher.`),
      };
    });

  const groups = [
    { id: "first-paint", title: "First-paint levers", score: fw.fcpScore, max: MAX_SCORE.fcp, rows: rowsFor("fcp") },
    { id: "other", title: "Other features", score: fw.otherScore, max: MAX_SCORE.other, rows: rowsFor("other") },
  ];

  const ranked = frameworksByRank();
  const index = ranked.findIndex((f) => f.id === fw.id);
  const tiedWith = ranked
    .filter((f) => f.id !== fw.id && f.rank === fw.rank)
    .map((f) => ({ id: f.id, name: f.name, shortName: f.shortName }));


  // Latest benchmark run: this framework's builds on every page, or null.
  const run = benchmark.latest;
  const benchRows: BuildTableRow[] = benchBuildsFor(fw.id).map((b) => ({
    key: `${b.branch}|${b.path}`,
    frameworkId: b.frameworkId,
    framework: fw.name,
    href: null,
    build: benchBuildName(b.branch, b.frameworkId),
    branch: b.branch,
    buildRank: benchBranchRank(b.branch, b.frameworkId),
    path: b.path,
    perf: b.perf,
    fcp: b.fcp,
    fcpObs: b.fcpObs ?? null,
    lcp: b.lcp,
    tbt: b.tbt,
    cls: b.cls,
    si: b.si,
    tti: b.tti ?? null,
    doc: b.doc,
    hosts: [...b.hosts].sort((x, y) => benchHostRank(x) - benchHostRank(y)),
  }));
  // The same run before averaging: one row per build, page and host.
  const targets = (run?.targets ?? [])
    .filter((t) => t.frameworkId === fw.id)
    .sort(
      (a, b) =>
        benchBranchRank(a.branch, a.frameworkId) - benchBranchRank(b.branch, b.frameworkId) ||
        benchPathRank(a.path) - benchPathRank(b.path) ||
        benchHostRank(a.host) - benchHostRank(b.host),
    );
  const hostRows: HostTableRow[] = targets.map((t) => ({
    key: `${t.branch}|${t.path}|${t.host}`,
    build: benchBuildName(t.branch, t.frameworkId),
    branch: t.branch,
    path: t.path,
    host: t.host,
    url: t.url,
    median: t.median,
    runs: t.runs,
    usedRuns: t.usedRuns,
    coldSuspect: t.coldSuspect,
    error: t.error,
  }));
  const fieldRows: FieldTableRow[] = targets
    .filter((t) => t.field)
    .map((t) => ({
      key: `${t.branch}|${t.path}|${t.host}`,
      build: benchBuildName(t.branch, t.frameworkId),
      branch: t.branch,
      path: t.path,
      host: t.host,
      url: t.url,
      field: t.field!,
    }));
  const bench =
    run && benchRows.length
      ? {
          date: run.date,
          dateText: longDate(run.date),
          runsPerTarget: run.runsPerTarget,
          hostCount: run.hosts.length,
          paths: [...new Set(benchRows.map((r) => r.path))].sort((a, b) => benchPathRank(a) - benchPathRank(b)),
          rows: benchRows,
          hostRows,
          fieldRows,
        }
      : null;

  const testRun = getTestRun(fw.id);
  const testRows = groups.flatMap((g) => g.rows).filter((r) => r.test && r.test.status !== "n/a");
  const tests = testRun
    ? {
        url: testRun.testsUrl,
        repo: testRun.repo,
        shortCommit: testRun.resultsCommit.slice(0, 7),
        date: testRun.testedAt.slice(0, 10),
        tested: testRows.length,
        passed: testRows.filter((r) => r.test!.status === "pass").length,
        failed: testRows.filter((r) => r.test!.status === "fail").map((r) => r.feature.name),
      }
    : null;

  return {
    bench,
    tests,
    framework: {
      id: fw.id,
      name: fw.name,
      shortName: fw.shortName,
      group: fw.group,
      version: fw.version,
      versionNotes: fw.versionNotes,
      fcpScore: fw.fcpScore,
      otherScore: fw.otherScore,
      total: fw.total,
      completeness: fw.completeness,
      rank: fw.rank,
      app: fw.app,
      repo: fw.repo,
      deployments: fw.deployments,
      links: fw.links,
    },
    max: { fcp: MAX_SCORE.fcp, other: MAX_SCORE.other, total: MAX_TOTAL },
    count,
    featureCount,
    tiedWith,
    groups,
    tally,
    notOutscored,
    prev: pagerItem(ranked[index - 1]),
    next: pagerItem(ranked[index + 1]),
  };
}

export function getStaticPaths() {
  return frameworks.map((f) => ({ id: f.id }));
}

export function head({ data }: HeadArgs<typeof loader>) {
  const { framework: fw, max, count } = data;
  const path = `/frameworks/${fw.id}`;
  const title = `${fw.name}: ${fw.total}/${max.total} on documented performance features — Framework Compare`;
  const description =
    `What ${fw.name}'s documentation says it provides for ${data.featureCount} performance features: ` +
    `${fw.total} of ${max.total} points (${fw.fcpScore}/${max.fcp} first paint, ${fw.otherScore}/${max.other} other), ` +
    `rank ${fw.rank} of ${count}. How to enable each feature` +
    (fw.app ? `, and links to the ${fw.app} port.` : `. ${NO_PORT}.`);
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate(path)],
    script: [pageLd("TechArticle", path, title, description, fw.name)],
  };
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const { framework: fw, max, count, tiedWith, groups, prev, next } = data;
  const tied = tiedWith.length > 0;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Ranking", to: { route: "home", hash: "ranking" } }, { label: fw.name }]}
        title={fw.name}
        lede={
          <>
            {fw.name} scores {fw.total} of {max.total} points. That is {fw.fcpScore} of {max.fcp} on the{" "}
            {groups[0].rows.length} features that affect first paint (the moment the browser first draws content), and{" "}
            {fw.otherScore} of {max.other} on the {groups[1].rows.length} other features.
          </>
        }
        meta={
          <>
            <RankBadge rank={fw.rank} tied={tied} />
            <span class="text-sm text-ink-2">
              {tied ? "Tied for rank" : "Rank"} {fw.rank} of {count}
              {tied && (
                <>
                  {" "}
                  with{" "}
                  {tiedWith.map((o, i) => (
                    <>
                      {i > 0 && ", "}
                      <FrameworkName framework={o} class="font-normal" />
                    </>
                  ))}
                </>
              )}
            </span>
            <ScoreBar fcp={fw.fcpScore} other={fw.otherScore} fcpMax={max.fcp} otherMax={max.other} />
          </>
        }
        aside={
          <StatGroup cols={4} class="lg:w-[30rem]">
            <Stat label="Total" value={fw.total} unit={`/${max.total}`} />
            <Stat label="Completeness" value={fw.completeness} unit="%" />
            <Stat label="First-paint" value={fw.fcpScore} unit={`/${max.fcp}`} />
            <Stat label="Other" value={fw.otherScore} unit={`/${max.other}`} />
          </StatGroup>
        }
      />

      <Container class="border-b border-rule py-5">
        <dl class="grid max-w-[56rem] gap-x-8 gap-y-3 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
          <dt class="eyebrow sm:pt-0.5">Version checked</dt>
          <dd class="num break-words text-ink">{fw.version}</dd>
          {fw.versionNotes && (
            <>
              <dt class="eyebrow sm:pt-0.5">Version notes</dt>
              <dd class="text-ink-2">{fw.versionNotes}</dd>
            </>
          )}
          <dt class="eyebrow sm:pt-0.5">Performance guide</dt>
          <dd class="text-ink-2">
            <ExternalLink href={fw.links.performanceGuide.url}>{fw.links.performanceGuide.title}</ExternalLink>
            {fw.links.performanceGuide.note && (
              <span class="block text-xs text-ink-3">{fw.links.performanceGuide.note}.</span>
            )}
          </dd>
          <dt class="eyebrow sm:pt-0.5">Issues</dt>
          <dd class="text-ink-2">
            <ExternalLink href={fw.links.issues}>{fw.links.issues.replace(/^https?:\/\//, "")}</ExternalLink>
          </dd>
        </dl>
      </Container>

      <Section
        id="scorecard"
        title="Scorecard"
        intro={`All ${data.featureCount} features, in two groups. Each row shows ${fw.name}'s label, how that label compares across all ${count} frameworks, and how to enable the feature. Feature names link to ${fw.name}'s entry on that feature's page.`}
        class="scroll-mt-4"
      >
        <div class="max-w-[56rem]">
          <div id="comparison" class="mb-6 grid scroll-mt-4 gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <p class="eyebrow mb-2">
                {fw.name}'s labels across {data.featureCount} features
              </p>
              <LabelTally counts={data.tally} of={data.featureCount} noun="features" />
            </div>
            <div>
              <p class="eyebrow mb-2">How it compares</p>
              <p class="text-sm text-ink-2">
                On <span class="num font-semibold text-ink">{data.notOutscored}</span> of {data.featureCount} features, no
                framework has a higher-scoring label than {fw.name}. On the other{" "}
                <span class="num font-semibold text-ink">{data.featureCount - data.notOutscored}</span>, at least one
                does.
              </p>
            </div>
            {data.tests && (
              <div class="sm:col-span-2">
                <p class="eyebrow mb-2">Tested in our port</p>
                <p class="text-sm text-ink-2">
                  The {fw.app} port passes{" "}
                  <span class="num font-semibold text-ink">
                    {data.tests.passed}/{data.tests.tested}
                  </span>{" "}
                  feature tests
                  {data.tests.failed.length ? ` (failed: ${data.tests.failed.join(", ")})` : ""}. Run on{" "}
                  <span class="num">{data.tests.date}</span> at{" "}
                  <ExternalLink href={data.tests.url}>
                    <span class="num">
                      {data.tests.repo}@{data.tests.shortCommit}
                    </span>
                  </ExternalLink>
                  .{" "}
                  <NavLink to={{ route: "methodology", hash: "feature-tests" }} class="link">
                    How we test labels
                  </NavLink>
                </p>
              </div>
            )}
          </div>
          <div class="grid gap-6">
            {groups.map((g) => (
              <ScorecardGroup key={g.id} frameworkId={fw.id} {...g} />
            ))}
          </div>
          <p class="mt-4 text-sm text-ink-3">
            1st-party scores 2 points, Experimental and Third-party 1, Manual 0.{" "}
            <NavLink to={{ route: "methodology", hash: "scoring" }} class="link">
              How scoring works
            </NavLink>
          </p>
        </div>
      </Section>

      <Section
        id="port"
        title="The port"
        intro={
          fw.app
            ? "The books demo app built with this framework, and where each branch is deployed."
            : undefined
        }
        class="scroll-mt-4 border-t border-rule"
      >
        {fw.app === null ? (
          <div class="max-w-[56rem]">
            <p class="font-semibold text-ink">{NO_PORT}</p>
            <p class="mt-1 max-w-prose text-sm text-ink-2">
              {fw.name} has no repository, deployments, benchmark runs or FCP band data on this site. Its labels and
              score come from the vendor documentation at the version checked above.
            </p>
          </div>
        ) : (
        <div class="max-w-[56rem]">
          <dl class="mb-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[max-content_minmax(0,1fr)]">
            <dt class="eyebrow sm:pt-0.5">App</dt>
            <dd class="num font-semibold text-ink">{fw.app}</dd>
            <dt class="eyebrow sm:pt-0.5">Repository</dt>
            <dd class="num break-all">
              {fw.repo ? (
                <ExternalLink href={fw.repo}>{fw.repo.replace(/^https?:\/\//, "")}</ExternalLink>
              ) : (
                <span class="text-ink-3">Not listed</span>
              )}
            </dd>
          </dl>
          {fw.deployments.length > 0 ? (
            <Deployments deployments={fw.deployments} />
          ) : (
            <p class="text-sm text-ink-3">No deployments are listed for this port.</p>
          )}
        </div>
        )}
      </Section>

      {fw.app === null && (
        <Section id="benchmark" title="Latest benchmark" class="scroll-mt-4 border-t border-rule">
          <p class="font-semibold text-ink">{NO_PORT}</p>
          <p class="mt-1 max-w-prose text-sm text-ink-2">
            The{" "}
            <NavLink to={{ route: "benchmark" }} class="link">
              benchmark
            </NavLink>{" "}
            runs against deployed ports, so there are no numbers for {fw.name}.
          </p>
        </Section>
      )}

      {data.bench && (
        <Section
          id="benchmark"
          title="Latest benchmark"
          intro={
            <>
              Mobile Lighthouse lab results from PageSpeed Insights on{" "}
              <time dateTime={data.bench.date}>{data.bench.dateText}</time>: the median of {data.bench.runsPerTarget}{" "}
              {data.bench.runsPerTarget === 1 ? "run" : "runs"} per host, averaged across the hosts listed. The{" "}
              <NavLink to={{ route: "benchmark", hash: "metrics" }} class="link">
                benchmark page
              </NavLink>{" "}
              explains each metric and has every other framework.
            </>
          }
          actions={
            <NavLink to={{ route: "benchmark" }} class="link">
              All frameworks
            </NavLink>
          }
          class="scroll-mt-4 border-t border-rule"
        >
          <div class="grid gap-8 [&>*]:min-w-0">
            <div>
              <BuildTable
                rows={data.bench.rows}
                paths={data.bench.paths}
                hostCount={data.bench.hostCount}
                showFramework={false}
                label={`${fw.name}: latest benchmark per build and page`}
              />
              <StatusKey class="mt-3" />
            </div>
            <div>
              <h3 id="benchmark-hosts" class="mb-1 font-semibold text-ink">
                Per host
              </h3>
              <p class="mb-3 max-w-[44rem] text-sm text-ink-2">
                The medians above before averaging. Runs is how many measured runs went into each median. Host names link to
                the deployment.
              </p>
              <HostTable
                groups={[{ key: fw.id, name: fw.name, rows: data.bench.hostRows }]}
                coldMs={COLD_DOC_MS}
                label={`${fw.name}: latest benchmark per build, page and host`}
              />
            </div>
            {data.bench.fieldRows.length > 0 && (
              <div>
                <h3 id="benchmark-field" class="mb-1 font-semibold text-ink">
                  Field data from real visits
                </h3>
                <p class="mb-3 max-w-[44rem] text-sm text-ink-2">
                  Chrome UX Report data for the URLs with enough real Chrome traffic: the 75th percentile of visits over the
                  last 28 days.
                </p>
                <FieldTable groups={[{ key: fw.id, name: fw.name, rows: data.bench.fieldRows }]} />
                <StatusKey class="mt-3" metrics={["lcp", "inp", "cls", "fcp", "ttfb"]} />
              </div>
            )}
          </div>
        </Section>
      )}

      <Section class="border-t border-rule">
        <Pager
          prev={
            prev
              ? { label: prev.name, kicker: `Rank ${prev.rank}`, to: { route: "framework", id: prev.id } }
              : undefined
          }
          next={
            next
              ? { label: next.name, kicker: `Rank ${next.rank}`, to: { route: "framework", id: next.id } }
              : undefined
          }
        />
        <p class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-2">
          <NavLink to={{ route: "compare" }} class="link">
            Compare {fw.name} with other frameworks
          </NavLink>
          <NavLink to={{ route: "home", hash: "ranking" }} class="link">
            Full ranking
          </NavLink>
        </p>
      </Section>
    </>
  );
}
