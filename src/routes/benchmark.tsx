import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import { Callout, Container, ExternalLink, FrameworkName, NavLink, PageHeader, Section, Stat, StatGroup, Tag } from "../components/index.ts";
import type { BuildTableRow } from "../components/benchmark/BuildTable.tsx";
import { HostTable, type HostTableGroup } from "../components/benchmark/HostTable.tsx";
import { FieldTable, type FieldTableGroup } from "../components/benchmark/FieldTable.tsx";
import { MetricGuide } from "../components/benchmark/MetricGuide.tsx";
import { rangeDomain } from "../components/benchmark/RangeChart.tsx";
import { LaneChart, type LaneGroup } from "../components/measured/LaneChart.tsx";
import { StatusKey } from "../components/benchmark/parts.tsx";
import { COLD_DOC_MS, hostName, listText, longDate, pathName, utcTime } from "../components/benchmark/format.ts";
import { ANCHOR, JumpNav, RunLegend } from "../components/measured/parts.tsx";
import BenchTable from "../islands/BenchTable.tsx";
import type { FrameworkId } from "../data/types.ts";
import { href } from "../pracht-routes.ts";
import { markdownAlternate, pageLd } from "../agents.ts";


/** One change the optimized build makes; `framework` when it uses something the framework ships. */
interface Change {
  label: string;
  feature: string;
  framework: boolean;
}

const CHIP = "inline-block rounded-xs border px-1 leading-4 whitespace-nowrap";
const chipClass = (framework: boolean) =>
  framework ? `${CHIP} border-ink font-semibold text-ink` : `${CHIP} border-dashed border-rule text-ink-3`;

/** "LCP −2.8 s", or null when either build has no value or nothing changed. */
function saved(metric: string, v: { from: number | null; to: number | null }): string | null {
  if (v.from == null || v.to == null) return null;
  const d = v.from - v.to;
  if (Math.abs(d) < 0.05) return `${metric} about the same`;
  return `${metric} ${d > 0 ? "−" : "+"}${Math.abs(d).toFixed(1)} s`;
}

/**
 * Everything the page prints from the latest bench run, already grouped and
 * sorted. `latest` is null when no run has been imported.
 */
export async function loader() {
  const { benchmark, frameworks, benchBuildName, benchBranchRank, benchHostRank: hostRank, benchPathRank, BENCH_HOME_PATH, hasPort } =
    await import("../data/index.ts");
  const history = benchmark.history.map((h) => ({ date: h.date, dateText: longDate(h.date), targets: h.targets, withData: h.withData }));
  const run = benchmark.latest;
  const changes: Record<string, Change[]> = (await import("../../content/optimizations.json")).default as never;
  if (!run) return { latest: null, history, frameworkCount: frameworks.filter(hasPort).length, noPort: [] };

  const fwById = new Map(frameworks.map((f) => [f.id, f]));
  const fwOrder = (id: FrameworkId) => fwById.get(id)?.order ?? 999;
  const fwName = (id: FrameworkId) => fwById.get(id)?.name ?? id;
  const hosts = [...run.hosts].sort((a, b) => hostRank(a) - hostRank(b));
  const paths = [...run.paths].sort((a, b) => benchPathRank(a) - benchPathRank(b));
  const hostNote = (hs: string[]) =>
    hs.length >= hosts.length ? undefined : hs.length === 1 ? `${hostName(hs[0])} only` : listText(hs.map(hostName));

  // Main chart: the book list, one group per framework. Each lane runs from the
  // baseline build (framework defaults) to the fastest optimized build, for FCP
  // and LCP. Groups sort by the optimized LCP, fastest first.
  const home = run.builds.filter((b) => b.path === BENCH_HOME_PATH);
  const homeIds = [...new Set(home.map((b) => b.frameworkId))];
  const gains = homeIds
    .map((id) => {
      const f = fwById.get(id);
      const builds = home.filter((b) => b.frameworkId === id);
      const base = builds.find((b) => benchBuildName(b.branch, id) === "baseline");
      const opt = builds
        .filter((b) => b !== base && b.lcp != null)
        .sort((a, b) => a.lcp! - b.lcp! || benchBranchRank(a.branch, id) - benchBranchRank(b.branch, id))[0];
      return {
        key: id,
        framework: { id, name: f?.name ?? id, shortName: f?.shortName ?? id },
        build: opt ? benchBuildName(opt.branch, id) : null,
        changes: changes[id] ?? [],
        hosts: opt ? hostNote(opt.hosts) : undefined,
        fcp: { from: base?.fcp != null ? base.fcp / 1000 : null, to: opt?.fcp != null ? opt.fcp / 1000 : null },
        lcp: { from: base?.lcp != null ? base.lcp / 1000 : null, to: opt?.lcp != null ? opt.lcp / 1000 : null },
      };
    })
    .filter((g) => g.lcp.to != null)
    .sort((a, b) => a.lcp.to! - b.lcp.to! || (a.fcp.to ?? 99) - (b.fcp.to ?? 99) || fwOrder(a.key) - fwOrder(b.key));
  const chartMax = Math.max(0, ...gains.flatMap((g) => [g.fcp.from ?? 0, g.lcp.from ?? 0, g.lcp.to ?? 0]));

  // Builds table: every framework × build × path.
  const tableRows: BuildTableRow[] = run.builds.map((b) => ({
    key: `${b.frameworkId}|${b.branch}|${b.path}`,
    frameworkId: b.frameworkId,
    framework: fwName(b.frameworkId),
    href: fwById.has(b.frameworkId) ? href("framework", { params: { id: b.frameworkId } }) : null,
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
    hosts: [...b.hosts].sort((x, y) => hostRank(x) - hostRank(y)),
  }));

  // Per-host table: every target, grouped by framework.
  const targetIds = [...new Set(run.targets.map((t) => t.frameworkId))].sort((a, b) => fwOrder(a) - fwOrder(b));
  const hostGroups: HostTableGroup[] = targetIds.map((id) => ({
    key: id,
    name: fwName(id),
    rows: run.targets
      .filter((t) => t.frameworkId === id)
      .sort(
        (a, b) =>
          benchBranchRank(a.branch, a.frameworkId) - benchBranchRank(b.branch, b.frameworkId) ||
          a.branch.localeCompare(b.branch) ||
          benchPathRank(a.path) - benchPathRank(b.path) ||
          hostRank(a.host) - hostRank(b.host),
      )
      .map((t) => ({
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
      })),
  }));

  // CrUX field data: only targets PSI returned page-level data for.
  const fieldGroups: FieldTableGroup[] = hostGroups
    .map((g) => ({
      key: g.key,
      name: g.name,
      rows: run.targets
        .filter((t) => t.frameworkId === g.key && t.field)
        .sort(
          (a, b) =>
            benchBranchRank(a.branch, a.frameworkId) - benchBranchRank(b.branch, b.frameworkId) ||
            benchPathRank(a.path) - benchPathRank(b.path) ||
            hostRank(a.host) - hostRank(b.host),
        )
        .map((t) => ({
          key: `${t.branch}|${t.path}|${t.host}`,
          build: benchBuildName(t.branch, t.frameworkId),
          branch: t.branch,
          path: t.path,
          host: t.host,
          url: t.url,
          field: t.field!,
        })),
    }))
    .filter((g) => g.rows.length);

  const withDataIds = new Set(run.targets.filter((t) => t.median).map((t) => t.frameworkId));
  const slimFw = (f: (typeof frameworks)[number]) => ({ id: f.id, name: f.name, shortName: f.shortName });
  const noPort = frameworks.filter((f) => !hasPort(f)).sort((a, b) => a.order - b.order).map(slimFw);
  const missing = frameworks
    .filter((f) => hasPort(f) && !withDataIds.has(f.id))
    .sort((a, b) => a.order - b.order)
    .map(slimFw);

  return {
    frameworkCount: frameworks.filter(hasPort).length,
    noPort,
    history,
    latest: {
      date: run.date,
      dateText: longDate(run.date),
      started: utcTime(run.startedAt),
      finished: utcTime(run.finishedAt),
      tool: run.tool,
      strategy: run.strategy,
      runsPerTarget: run.runsPerTarget,
      psiRequests: run.psiRequests,
      aborted: run.aborted,
      hosts,
      paths,
      homePath: BENCH_HOME_PATH,
      targetCount: run.targets.length,
      withData: run.targets.filter((t) => t.median).length,
      errors: run.targets.filter((t) => t.error).length,
      coldSuspect: run.targets.filter((t) => t.coldSuspect).length,
      frameworksWithData: withDataIds.size,
      missing,
      buildCount: run.builds.length,
      gains,
      chartMax,
      tableRows,
      hostGroups,
      fieldGroups,
      fieldCount: fieldGroups.reduce((n, g) => n + g.rows.length, 0),
    },
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const l = data.latest;
  const title = l ? `Benchmark: PageSpeed Insights run of ${l.dateText} — Framework Compare` : "Benchmark — Framework Compare";
  const description = l
    ? `Mobile Lighthouse lab results (PageSpeed Insights) for the Books demo app in each framework, run on ${l.dateText}: Performance score, FCP, LCP, TBT, CLS, Speed Index, TTI and document time for ${l.withData} of ${l.targetCount} deployments. One run, one location; numbers vary from run to run.`
    : "Our own PageSpeed Insights benchmark of the Books demo app in each framework. No run has been published yet.";
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate("/benchmark")],
    script: [pageLd("WebPage", "/benchmark", title, description)],
  };
}

type Latest = NonNullable<Awaited<ReturnType<typeof loader>>["latest"]>;

function Reproduce({ history }: { history: { date: string; dateText: string; targets: number; withData: number }[] }) {
  const code = "num block overflow-x-auto rounded-sm border border-rule bg-sunken px-3 py-2 text-xs text-ink whitespace-pre";
  return (
    <div class="grid gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,44rem)_minmax(0,1fr)]">
      <div class="grid gap-4 text-ink-2">
        <p>
          The benchmark script calls the PageSpeed Insights API, so it needs an API key. Copy{" "}
          <code class="num text-sm">bench/.env.example</code> to <code class="num text-sm">bench/.env</code> and set{" "}
          <code class="num text-sm">PSI_API_KEY</code> (or <code class="num text-sm">PSI_GCP_PROJECT</code> to fetch a key with gcloud).
          Then, from the site's folder:
        </p>
        <div>
          <p class="eyebrow mb-1">Run, import and rebuild the data in one go</p>
          <code class={code}>npm run bench</code>
        </div>
        <div>
          <p class="eyebrow mb-1">Or run the script with your own options, then import</p>
          <code class={code}>{"node bench/cwv-bench.mjs --help\nnode bench/cwv-bench.mjs --hosts vercel --runs 3\nnpm run bench:import"}</code>
        </div>
        <p>
          <code class="num text-sm">bench:import</code> copies the newest run under <code class="num text-sm">bench/results</code> to{" "}
          <code class="num text-sm">content/benchmarks/&lt;date&gt;.json</code> and rebuilds this page's data. The newest file is
          shown here; older files stay listed below.
        </p>
      </div>
      <div class="grid content-start gap-4">
        <div>
          <p class="eyebrow mb-2">Runs on file</p>
          {history.length ? (
            <ul class="grid gap-1 text-sm">
              {[...history].reverse().map((h) => (
                <li key={h.date} class="flex flex-wrap gap-x-3">
                  <time dateTime={h.date} class="num text-ink">
                    {h.dateText}
                  </time>
                  <span class="num text-ink-3">
                    {h.withData} of {h.targets} targets with data
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p class="text-sm text-ink-3">None yet.</p>
          )}
        </div>
        <p class="text-sm text-ink-2">
          Why FCP clusters into bands, from the September Lighthouse runs, is on the{" "}
          <NavLink to={{ route: "measured" }} class="link">
            FCP bands
          </NavLink>{" "}
          page.
        </p>
      </div>
    </div>
  );
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const l = data.latest;

  if (!l) {
    return (
      <>
        <PageHeader
          eyebrow="Lab measurements"
          title="Benchmark"
          lede="Our own PageSpeed Insights run of every deployment of the Books demo app. No run has been imported yet, so there are no numbers to show."
        />
        <Container class="py-6">
          <Callout kind="note" title="No benchmark data">
            <p>
              No run has been imported yet. Follow the steps below to make one. Older lab numbers from September are on the{" "}
              <NavLink to={{ route: "measured" }}>FCP bands</NavLink> page.
            </p>
          </Callout>
        </Container>
      <Section id="reproduce" title="How to run it" class="border-t border-rule">
          <Reproduce history={data.history} />
        </Section>
      </>
    );
  }

  const runsText = `${l.runsPerTarget} measured ${l.runsPerTarget === 1 ? "run" : "runs"}`;
  const hostText = listText(l.hosts.map(hostName));
  const pathText = listText(l.paths.map((p) => `${pathName(p).toLowerCase()} (${p})`));
  const domain = rangeDomain(l.chartMax ? l.chartMax * 1000 : null);

  return (
    <>
      <PageHeader
        eyebrow="Lab measurements"
        title="Benchmark"
        lede={
          <>
            How much faster the same app gets in each meta-framework once it is optimized, and which of those gains the
            framework provides. We ran
            PageSpeed Insights against every deployment of the Books demo app on {l.dateText}. Each target is one
            build on one host and one page: the {pathText}. Each figure is the median of {runsText} per target, after a
            warm-up. Runs whose document took over {COLD_DOC_MS} ms count as cold and are left out of the median when
            other runs exist.
          </>
        }
        meta={
          <>
            <Tag>{l.tool}</Tag>
            <Tag>{l.strategy === "mobile" ? "Mobile emulation" : l.strategy}</Tag>
            <Tag>Lab data, one location</Tag>
            <Tag>
              <time dateTime={l.date}>{l.date}</time>
              {l.started && ` · ${l.started}`}
              {l.finished && `–${l.finished}`}
            </Tag>
          </>
        }
        aside={
          <StatGroup cols={3} class="lg:w-[28rem]">
            <Stat label="Targets with data" value={l.withData} unit={`/${l.targetCount}`} hint="build × host × page" />
            <Stat label="Frameworks" value={l.frameworksWithData} unit={`/${data.frameworkCount}`} hint="with any data" />
            <Stat label="Hosts" value={l.hosts.length} hint={hostText} />
          </StatGroup>
        }
      />

      {(l.aborted || l.errors > 0 || l.coldSuspect > 0 || l.missing.length > 0 || data.noPort.length > 0) && (
        <Container class="py-6">
          <Callout kind="caveat" title={`Coverage: ${l.withData} of ${l.targetCount} targets`}>
            {l.aborted && <p class="font-semibold text-ink">This run stopped early, so its results are partial.</p>}
            <p>
              {l.frameworksWithData} of {data.frameworkCount} frameworks with a Books port have data in this run.
              {l.errors > 0 && ` ${l.errors} ${l.errors === 1 ? "target" : "targets"} failed.`}
              {l.coldSuspect > 0 &&
                ` ${l.coldSuspect} ${l.coldSuspect === 1 ? "target was" : "targets were"} cold on every run, so ${l.coldSuspect === 1 ? "its" : "their"} median includes cold runs.`}
            </p>
            {l.missing.length > 0 && (
              <p>
                No data:{" "}
                {l.missing.map((f, i) => (
                  <>
                    {i > 0 && ", "}
                    <FrameworkName framework={f} />
                  </>
                ))}
                .
              </p>
            )}
            {data.noPort.length > 0 && (
              <p>
                No Books port yet:{" "}
                {data.noPort.map((f, i) => (
                  <>
                    {i > 0 && ", "}
                    <FrameworkName framework={f} />
                  </>
                ))}
                .
              </p>
            )}
          </Callout>
        </Container>
      )}

      <JumpNav
        route="benchmark"
        items={[
          { hash: "ranking", label: "Optimizations" },
          { hash: "builds", label: "All builds" },
          { hash: "hosts", label: "By host" },
          ...(l.fieldCount ? [{ hash: "field", label: "Field data" }] : []),
          { hash: "metrics", label: "Metrics" },
          { hash: "reproduce", label: "Run it" },
        ]}
      />

      <Section
        id="ranking"
        title="What each framework’s optimizations buy"
        class={ANCHOR}
        intro={
          <>
            Every framework runs the same Books app twice: once on its default settings, and once optimized. Each row shows
            what the optimized build bought on the {pathName(l.homePath).toLowerCase()} page (
            {l.homePath}): First Contentful Paint (FCP), when the first text appears, and Largest Contentful Paint (LCP), when
            the largest image or block of text appears. Under each name is what the optimized build changes. A solid tag
            uses something the framework ships, such as an image component or a config option. A dashed tag is
            hand-written or comes from a general library, so it would work in any framework. Frameworks are sorted by their
            optimized LCP, fastest first.
          </>
        }
      >
        {l.gains.length ? (
          <div class="max-w-[64rem]">
            <LaneChart
              groups={l.gains.map(
                (g): LaneGroup => ({
                  key: g.key,
                  label: <FrameworkName framework={g.framework} />,
                  note: (
                    <>
                      {[
                        g.fcp.from != null && g.fcp.from < 1 ? "fast FCP by default" : saved("FCP", g.fcp),
                        saved("LCP", g.lcp),
                        g.build && g.build !== "optimized" ? `${g.build} build` : null,
                        g.hosts,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {g.changes.length > 0 && (
                        <ul class="mt-1 flex max-w-[18rem] flex-wrap gap-1 font-sans" aria-label="What the optimized build changes">
                          {g.changes.map((c) => (
                            <li key={c.label}>
                              <a
                                href={`${href("feature", { params: { id: c.feature } })}`}
                                class={chipClass(c.framework)}
                                title={c.framework ? "Uses an API or package the framework ships" : "Hand-written, or a library that isn’t part of the framework"}
                              >
                                {c.label}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ),
                  lanes: [
                    { key: "fcp", name: "FCP", series: 1, from: g.fcp.from, value: g.fcp.to },
                    { key: "lcp", name: "LCP", series: 2, from: g.lcp.from, value: g.lcp.to },
                  ],
                }),
              )}
              domain={[0, domain.max]}
              ticks={domain.ticks}
              digits={2}
              paired
              valueHeader="Default → optimized, s"
              legend={
                <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <RunLegend hosts={false} bands={false} builds={{ hollow: "default settings", filled: "optimized" }} />
                  <span class="flex items-center gap-1.5 text-xs text-ink-2">
                    <span class={chipClass(true)}>framework feature</span>
                    <span class={chipClass(false)}>hand-written or library</span>
                  </span>
                </div>
              }
              caption={
                <>
                  Seconds, mobile Lighthouse through PageSpeed Insights. Each value is the median of {runsText} per host,
                  averaged across {l.hosts.length} hosts. Lower is better. Where a framework has more than one optimized build,
                  the row shows the one with the lowest LCP. Every build and host is in the tables below.
                </>
              }
            />
          </div>
        ) : (
          <p class="text-ink-3">This run has no data for the book list page.</p>
        )}
      </Section>

      <Section
        id="builds"
        title="Every build and page"
        class={`border-t border-rule ${ANCHOR}`}
        intro={
          <>
            Each row is one page of one build, with the {l.hosts.length} hosts averaged together. Perf is Lighthouse’s score out of
            100, so higher is better. For every other column, lower is better. Times are in seconds, except TBT and Doc,
            which are in milliseconds.{" "}
            {l.tableRows.some((r) => r.fcpObs != null) && (
              <>
                FCP is Lighthouse’s estimate for Slow 4G; Raw FCP is the first paint in the real, unthrottled load that
                estimate is built from.{" "}
              </>
            )}
            Builds in the same{" "}
            <NavLink to={{ route: "measured", hash: "caveats" }} class="link">
              FCP band
            </NavLink>{" "}
            are a tie, whatever order the FCP column puts them in. Click a column to sort by it. On a phone, pick a smaller set of columns. Not sure
            what a column means?{" "}
            <a href="#metrics" class="link">
              Each metric is explained below
            </a>
            .
          </>
        }
        actions={<StatusKey />}
      >
        <BenchTable
          rows={l.tableRows}
          paths={l.paths}
          hostCount={l.hosts.length}
          label="Benchmark results per framework, build and page, averaged across hosts"
          initial={{ key: "lcp", dir: "asc" }}
          client="visible"
        />
      </Section>

      <Section
        id="hosts"
        title="Per host"
        class={`border-t border-rule ${ANCHOR}`}
        intro={
          <>
            Every target in the run, before averaging. Runs shows how many measured runs went into the median. A cold suspect
            had every run over {COLD_DOC_MS} ms for the document, which usually means the host was starting up. Doc is that
            document time. Host names link to the deployment.
          </>
        }
      >
        <HostTable groups={l.hostGroups} coldMs={COLD_DOC_MS} />
      </Section>

      {l.fieldCount > 0 && (
        <Section
          id="field"
          title="Field data from real visits"
          class={`border-t border-rule ${ANCHOR}`}
          intro={
            <>
              PageSpeed Insights also returns Chrome UX Report (CrUX) data for URLs with enough real Chrome traffic: the 75th
              percentile of visits over the last 28 days. {l.fieldCount} of {l.targetCount}{" "}
              {l.targetCount === 1 ? "target has" : "targets have"} it. Core Web Vitals pass when LCP, INP and CLS are all
              good at the 75th percentile (
              <ExternalLink href="https://web.dev/articles/vitals">web.dev</ExternalLink>).
            </>
          }
          actions={<StatusKey metrics={["lcp", "inp", "cls", "fcp", "ttfb"]} />}
        >
          <FieldTable groups={l.fieldGroups} />
        </Section>
      )}

      <Section
        id="metrics"
        title="What each metric means"
        class={`border-t border-rule ${ANCHOR}`}
        intro={
          <>
            The thresholds are Google's: web.dev for the Core Web Vitals (LCP, INP and CLS) and the other web metrics, and the
            Lighthouse docs for the score and Speed Index.
          </>
        }
      >
        <MetricGuide field={l.fieldCount > 0} />
      </Section>

      {l.fieldCount > 0 && (
        <Section
          id="field"
          title="Field data from real visits"
          class={`border-t border-rule ${ANCHOR}`}
          intro={
            <>
              PageSpeed Insights also returns Chrome UX Report (CrUX) data for URLs with enough real Chrome traffic: the 75th
              percentile of visits over the last 28 days. {l.fieldCount} of {l.targetCount}{" "}
              {l.targetCount === 1 ? "target has" : "targets have"} it. Core Web Vitals pass when LCP, INP and CLS are all
              good at the 75th percentile (
              <ExternalLink href="https://web.dev/articles/vitals">web.dev</ExternalLink>).
            </>
          }
          actions={<StatusKey metrics={["lcp", "inp", "cls", "fcp", "ttfb"]} />}
        >
          <FieldTable groups={l.fieldGroups} />
        </Section>
      )}

      <Section
        id="metrics"
        title="What each metric means"
        class={`border-t border-rule ${ANCHOR}`}
        intro={
          <>
            The thresholds are Google's: web.dev for the Core Web Vitals (LCP, INP and CLS) and the other web metrics, and the
            Lighthouse docs for the score and Speed Index.
          </>
        }
      >
        <MetricGuide field={l.fieldCount > 0} />
      </Section>

      <Section id="reproduce" title="How to run it" class={`border-t border-rule ${ANCHOR}`}>
        <Reproduce history={data.history} />
        <p class="mt-6 text-sm text-ink-3">
          PageSpeed Insights runs Lighthouse; see{" "}
          <ExternalLink href="https://developers.google.com/speed/docs/insights/v5/about">About PageSpeed Insights</ExternalLink> and{" "}
          <ExternalLink href="https://web.dev/articles/vitals">Core Web Vitals thresholds</ExternalLink>.
        </p>
      </Section>
    </>
  );
}
