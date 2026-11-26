import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import { Callout, Container, ExternalLink, FrameworkName, NavLink, PageHeader, Section, Stat, StatGroup, Tag } from "../components/index.ts";
import type { BuildTableRow } from "../components/benchmark/BuildTable.tsx";
import { HostTable, type HostTableGroup } from "../components/benchmark/HostTable.tsx";
import { RangeChart, RangeKey, rangeDomain, type RangeGroup } from "../components/benchmark/RangeChart.tsx";
import { StatusKey } from "../components/benchmark/parts.tsx";
import { COLD_DOC_MS, hostName, listText, longDate, pathName, utcTime } from "../components/benchmark/format.ts";
import { ANCHOR, JumpNav } from "../components/measured/parts.tsx";
import BenchTable from "../islands/BenchTable.tsx";
import type { FrameworkId, Host } from "../data/types.ts";
import { href } from "../pracht-routes.ts";
import { markdownAlternate, pageLd } from "../agents.ts";

const HOST_ORDER: Host[] = ["vercel", "netlify", "cloudflare"];
const hostRank = (h: string) => {
  const i = HOST_ORDER.indexOf(h as Host);
  return i === -1 ? HOST_ORDER.length : i;
};

/**
 * Everything the page prints from the latest bench run, already grouped and
 * sorted. `latest` is null when no run has been imported.
 */
export async function loader() {
  const { benchmark, frameworks, benchBuildName, benchBranchRank, benchPathRank, BENCH_HOME_PATH } = await import("../data/index.ts");
  const history = benchmark.history.map((h) => ({ date: h.date, dateText: longDate(h.date), targets: h.targets, withData: h.withData }));
  const run = benchmark.latest;
  if (!run) return { latest: null, history, frameworkCount: frameworks.length };

  const fwById = new Map(frameworks.map((f) => [f.id, f]));
  const fwOrder = (id: FrameworkId) => fwById.get(id)?.order ?? 999;
  const fwName = (id: FrameworkId) => fwById.get(id)?.name ?? id;
  const hosts = [...run.hosts].sort((a, b) => hostRank(a) - hostRank(b));
  const paths = [...run.paths].sort((a, b) => benchPathRank(a) - benchPathRank(b));
  const hostNote = (hs: string[]) =>
    hs.length >= hosts.length ? undefined : hs.length === 1 ? `${hostName(hs[0])} only` : listText(hs.map(hostName));

  // Main chart: the book list, one group per framework, one row per build.
  // Groups sort by their best (lowest) LCP; a group with no LCP goes last.
  const home = run.builds.filter((b) => b.path === BENCH_HOME_PATH);
  const homeIds = [...new Set(home.map((b) => b.frameworkId))];
  const best = (id: FrameworkId, k: "lcp" | "fcp") => {
    const vs = home.filter((b) => b.frameworkId === id).map((b) => b[k]).filter((v): v is number => v != null);
    return vs.length ? Math.min(...vs) : Infinity;
  };
  const chartGroups = homeIds
    .sort((a, b) => best(a, "lcp") - best(b, "lcp") || best(a, "fcp") - best(b, "fcp") || fwOrder(a) - fwOrder(b))
    .map((id) => {
      const f = fwById.get(id);
      return {
        key: id,
        framework: { id, name: f?.name ?? id, shortName: f?.shortName ?? id },
        rows: home
          .filter((b) => b.frameworkId === id)
          .sort((a, b) => benchBranchRank(a.branch, a.frameworkId) - benchBranchRank(b.branch, b.frameworkId))
          .map((b) => ({
            key: b.branch,
            name: benchBuildName(b.branch, b.frameworkId),
            title: `Branch: ${b.branch}. Average of ${listText(b.hosts.map(hostName))}.`,
            note: hostNote(b.hosts),
            fcp: b.fcp,
            lcp: b.lcp,
          })),
      };
    });
  const chartMax = Math.max(0, ...home.flatMap((b) => [b.fcp ?? 0, b.lcp ?? 0]));

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
    lcp: b.lcp,
    tbt: b.tbt,
    cls: b.cls,
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

  const withDataIds = new Set(run.targets.filter((t) => t.median).map((t) => t.frameworkId));
  const missing = frameworks
    .filter((f) => !withDataIds.has(f.id))
    .sort((a, b) => a.order - b.order)
    .map((f) => ({ id: f.id, name: f.name, shortName: f.shortName }));

  return {
    frameworkCount: frameworks.length,
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
      chartGroups,
      chartMax,
      tableRows,
      hostGroups,
    },
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const l = data.latest;
  const title = l ? `Benchmark: PageSpeed Insights run of ${l.dateText} — Framework Compare` : "Benchmark — Framework Compare";
  const description = l
    ? `Mobile Lighthouse lab results (PageSpeed Insights) for the Books demo app in each framework, run on ${l.dateText}: FCP, LCP, TBT, CLS and Performance score for ${l.withData} of ${l.targetCount} deployments. One run, one location; numbers vary from run to run.`
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
  const domain = rangeDomain(l.chartMax || null);

  return (
    <>
      <PageHeader
        eyebrow="Lab measurements"
        title="Benchmark"
        lede={
          <>
            We ran PageSpeed Insights against every deployment of the Books demo app on {l.dateText}. Each target is one
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

      {(l.aborted || l.errors > 0 || l.coldSuspect > 0 || l.missing.length > 0) && (
        <Container class="py-6">
        <Callout kind="caveat" title={`Coverage: ${l.withData} of ${l.targetCount} targets`}>
          {l.aborted && <p class="font-semibold text-ink">This run stopped early, so its results are partial.</p>}
          <p>
            {l.frameworksWithData} of {data.frameworkCount} frameworks have data in this run.
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
        </Callout>
      </Container>
      )}

      <JumpNav
        route="benchmark"
        items={[
          { hash: "ranking", label: "Book list" },
          { hash: "builds", label: "All builds" },
          { hash: "hosts", label: "By host" },
          { hash: "reproduce", label: "Run it" },
        ]}
      />

      <Section
        id="ranking"
        title="Book list: FCP and LCP by build"
        class={ANCHOR}
        intro={
          <>
            First Contentful Paint (FCP) is when the first text or image appears. Largest Contentful Paint (LCP) is when the
            largest one appears. Each row is one build of the {pathName(l.homePath).toLowerCase()} page ({l.homePath}), averaged
            across the hosts that returned data. Frameworks are sorted by their lowest LCP in this run; the baseline build
            comes first, then the optimized ones.
          </>
        }
      >
        {l.chartGroups.length ? (
          <div class="max-w-[64rem]">
            <RangeChart
              groups={l.chartGroups.map(
                (g): RangeGroup => ({
                  key: g.key,
                  name: g.framework.name,
                  label: <FrameworkName framework={g.framework} />,
                  rows: g.rows,
                }),
              )}
              max={domain.max}
              ticks={domain.ticks}
              legend={<RangeKey />}
              caption={
                <>
                  Seconds, median of {runsText} per target, then averaged across hosts. Lower is better. A row with fewer
                  than {l.hosts.length} hosts names the ones it has, so its average is not directly comparable with the
                  others. The glyph beside each value is its Core Web Vitals status.
                </>
              }
            />
            <StatusKey class="mt-4" />
          </div>
        ) : (
          <p class="text-ink-3">This run has no data for the book list page.</p>
        )}
      </Section>

      <Section
        id="builds"
        title="Every build and page"
        class={`border-t border-rule ${ANCHOR}`}
        intro={`${l.buildCount} ${l.buildCount === 1 ? "row" : "rows"}: one per framework, build and page, averaged across hosts. Perf is the Lighthouse Performance score (0–100, higher is better). FCP and LCP are in seconds, TBT in milliseconds. Select a column header to sort.`}
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
            document time; SI is Speed Index, in seconds. Host names link to the deployment.
          </>
        }
      >
        <HostTable groups={l.hostGroups} coldMs={COLD_DOC_MS} />
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
