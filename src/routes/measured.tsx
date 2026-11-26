import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import { markdownAlternate, pageLd } from "../agents.ts";
import { Callout, Card, DotChart, FrameworkName, NavLink, PageHeader, Prose, Section, Tag } from "../components/index.ts";
import { LaneChart, type LaneGroup } from "../components/measured/LaneChart.tsx";
import { ANCHOR, FCP_DOMAIN, FCP_TICKS, JumpNav, RunLegend, SubHeading } from "../components/measured/parts.tsx";
import type { FrameworkId } from "../data/types.ts";

export async function loader() {
  const [{ measured, benchmark, frameworks, hasPort, fcpPairs }, story] = await Promise.all([
    import("../data/index.ts"),
    import("../../content/fcp-story.json").then((m) => m.default),
  ]);

  // Only builds with both a naive and an optimized figure belong in a pair chart.
  const pairs = fcpPairs().filter((p) => p.naive != null && p.optimized != null);
  const earlier = measured.averages
    .filter((a) => a.build === "baseline")
    .flatMap((a) => {
      const after = measured.averages.find((o) => o.frameworkId === a.frameworkId && o.build === "optimized");
      return after ? [{ frameworkId: a.frameworkId, naive: a.fcp, optimized: after.fcp }] : [];
    });

  return {
    bands: measured.bands,
    story,
    pairs: pairs.map((p) => ({ frameworkId: p.frameworkId, naive: p.naive!, optimized: p.optimized! })),
    earlier,
    hosts: benchmark.latest?.hosts ?? [],
    steps: measured.steps,
    oneSentenceHtml: measured.oneSentenceHtml,
    frameworks: frameworks.map((f) => ({ id: f.id, name: f.name, shortName: f.shortName, hasPort: hasPort(f) })),
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const title = `Why FCP comes in ${data.bands.length} bands — Framework Compare`;
  const description = `The same Books app in ${data.pairs.length} frameworks, each built twice: once with default settings and once optimized. First Contentful Paint bunches into ${data.bands.length} bands, and each band is one more request the browser waits for before it can paint. Mobile Lighthouse.`;
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate("/measured")],
    script: [pageLd("WebPage", "/measured", title, description)],
  };
}

type Data = Awaited<ReturnType<typeof loader>>;
type Fw = Data["frameworks"][number];
type Band = Data["bands"][number];
type Pair = Data["pairs"][number];

/**
 * The band a value falls in. Values faster than the first band count as the
 * first, slower than the last as the last; a value in a gap has no band.
 */
function bandOf(value: number, bands: Band[]): Band | undefined {
  // Band edges are given to 0.1 s, so compare at that precision.
  const v = Math.round(value * 10) / 10;
  if (v < bands[0].min) return bands[0];
  if (v > bands[bands.length - 1].max) return bands[bands.length - 1];
  return bands.find((b) => v >= b.min && v <= b.max);
}

/** "Middle", or "between Middle and Slow-middle" for a value in a gap. */
function bandLabel(v: number, bands: Band[]): string {
  const b = bandOf(v, bands);
  if (b) return b.name;
  const i = bands.findIndex((b) => b.min > Math.round(v * 10) / 10);
  return `between ${bands[i - 1].name} and ${bands[i].name}`;
}

function pairGroups(pairs: Pair[], fw: Map<FrameworkId, Fw>, bands: Band[]): LaneGroup[] {
  return [...pairs]
    .sort((a, b) => b.naive - a.naive || b.optimized - a.optimized)
    .map((p) => {
      const from = bandLabel(p.naive, bands);
      const to = bandLabel(p.optimized, bands);
      return {
        key: p.frameworkId,
        label: <FrameworkName framework={fw.get(p.frameworkId)!} />,
        note: from === to ? `${to} either way` : `${from} → ${to}`,
        lanes: [{ key: "fcp", series: 0, from: p.naive, value: p.optimized }],
      };
    });
}

const BUILDS = { hollow: "default settings (naive)", filled: "optimized" };

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const fw = new Map(data.frameworks.map((f) => [f.id, f]));
  const laneBands = data.bands.map((b) => ({ name: b.name, min: b.min, max: b.max }));
  const n = data.pairs.length;

  const list = (ids: FrameworkId[]) =>
    ids.map((id, i) => (
      <>
        {i > 0 && (i === ids.length - 1 ? " and " : ", ")}
        <FrameworkName framework={fw.get(id)!} />
      </>
    ));
  /** "every port", "every port except A and B", or the names. */
  const who = (ids: FrameworkId[]) => {
    const rest = data.pairs.map((p) => p.frameworkId).filter((id) => !ids.includes(id));
    if (!rest.length) return <>every port</>;
    return rest.length < ids.length ? <>every port except {list(rest)}</> : list(ids);
  };
  const inBand = (rows: { frameworkId: FrameworkId; naive: number; optimized: number }[], key: "naive" | "optimized", b: Band) =>
    rows.filter((r) => bandOf(r[key], data.bands)?.id === b.id).map((r) => r.frameworkId);

  const fastByDefault = data.pairs.filter((p) => bandOf(p.naive, data.bands)?.id === data.bands[0].id).map((p) => p.frameworkId);
  const named = (vs: number[]) => [...new Set(vs.map((v) => bandOf(v, data.bands)?.name).filter((x): x is string => !!x))];
  const optimizedBands = named(data.pairs.map((p) => p.optimized));
  const median = (vs: number[]) => {
    const s = [...vs].sort((a, b) => a - b);
    return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  };
  const slowNaive = data.pairs.filter((p) => !fastByDefault.includes(p.frameworkId));
  const typicalNaive = slowNaive.length ? median(slowNaive.map((p) => p.naive)) : null;
  const typicalOptimized = median(data.pairs.map((p) => p.optimized));
  const noPortFw = data.frameworks.filter((f) => !f.hasPort);

  return (
    <>
      <PageHeader
        eyebrow="FCP bands"
        title={`Why First Contentful Paint comes in ${data.bands.length} bands`}
        lede={`We built the same Books app in ${n} frameworks, twice each: once with the framework’s default settings and once optimized. First Contentful Paint (FCP), the moment the browser first draws text or an image, doesn’t spread out smoothly across them. It bunches into ${data.bands.length} bands, and each band is one more request the browser has to wait for before it can paint.`}
        meta={
          <>
            <Tag>Mobile Lighthouse</Tag>
            <Tag>Simulated Slow 4G, 4× CPU throttle</Tag>
            <Tag>{n} ports, naive vs optimized</Tag>
          </>
        }
      />

      <JumpNav
        items={[
          { hash: "bands", label: "The bands" },
          { hash: "ports", label: "Every port" },
          { hash: "anatomy", label: "What each band waits on" },
          { hash: "why", label: "Why bands form" },
          { hash: "baseline-builds", label: "The Baseline band" },
          { hash: "steps", label: "Moving down a band" },
          { hash: "caveats", label: "Caveats" },
        ]}
      />

      <Section id="bands" title={`The ${data.bands.length} bands`} class={ANCHOR}>
        <div class="max-w-prose">
          <p>
            FCP values bunch into {data.bands.length} groups with gaps between them. Each group matches how many requests have
            to finish one after another before the page can paint. Take one request out of that chain and the app drops a
            whole band.
          </p>
        </div>
        <div class="my-6 max-w-[64rem]">
          <DotChart
            title={`The ${data.bands.length} FCP bands`}
            domain={FCP_DOMAIN}
            ticks={FCP_TICKS}
            rows={data.bands.map((b) => ({
              key: b.id,
              label: (
                <div class="py-0.5 sm:max-w-[23rem]">
                  <NavLink to={{ route: "measured", hash: `band-${b.id}` }} class="link font-semibold">
                    {b.name}
                  </NavLink>
                  <div class="text-xs text-ink-2 text-pretty">{b.shape}</div>
                </div>
              ),
              range: { min: b.min, max: b.max },
            }))}
            caption={`FCP in seconds, mobile Lighthouse (simulated Slow 4G, 4× CPU throttle). Each bar is a band’s approximate range, and under each name is what the page waits for before it can paint. Every FCP chart on this page uses the same ${FCP_DOMAIN[0]}–${FCP_DOMAIN[1]} s axis.`}
          />
        </div>
      </Section>

      <Section
        id="ports"
        title="Every port, naive vs optimized"
        class={`border-t border-rule ${ANCHOR}`}
        intro={
          <>
            Each row is one port. The hollow marker is its build with the framework’s default settings, the filled marker its
            optimized build, and the line between them is what the optimization bought.{" "}
            {typicalNaive != null && (
              <>
                With default settings most ports paint at about {typicalNaive.toFixed(1)} s, in {bandLabel(typicalNaive, data.bands)}.{" "}
              </>
            )}
            Optimized, every port paints at about {typicalOptimized.toFixed(1)} s, in {optimizedBands.join(" or ")}.
            {fastByDefault.length > 0 && (
              <>
                {" "}
                {list(fastByDefault)} {fastByDefault.length === 1 ? "is" : "are"} already in {data.bands[0].name} with default
                settings.
              </>
            )}
          </>
        }
      >
        <div class="max-w-[64rem]">
          <LaneChart
            groups={pairGroups(data.pairs, fw, data.bands)}
            domain={FCP_DOMAIN}
            ticks={FCP_TICKS}
            digits={2}
            bands={laneBands}
            named={false}
            paired
            valueHeader="FCP, s"
            legend={<RunLegend hosts={false} builds={BUILDS} />}
            caption={
              <>
                Home-page FCP in seconds, mobile Lighthouse through PageSpeed Insights. Each figure is the median across{" "}
                {data.hosts.length} hosts of each host’s median run. Rows are sorted by the naive build, slowest first. Per-host
                numbers and the other metrics are on <NavLink to={{ route: "benchmark" }} class="link">Benchmark</NavLink>.
              </>
            }
          />
        </div>
      </Section>

      <Section id="anatomy" title="What each band waits on" class={`border-t border-rule ${ANCHOR}`}>
        <div class="grid gap-4 lg:grid-cols-2">
          {data.bands.map((b) => {
            const naive = inBand(data.pairs, "naive", b);
            const optimized = inBand(data.pairs, "optimized", b);
            const earlierNaive = inBand(data.earlier, "naive", b);
            const earlierOptimized = inBand(data.earlier, "optimized", b);
            const lines = [
              naive.length > 0 && <>Naive: {who(naive)}.</>,
              optimized.length > 0 && <>Optimized: {who(optimized)}.</>,
              naive.length + optimized.length === 0 && earlierNaive.length > 0 && (
                <>
                  No current build. The{" "}
                  <NavLink to={{ route: "measured", hash: "baseline-builds" }} class="link">
                    earlier naive builds
                  </NavLink>{" "}
                  of {list(earlierNaive)} landed here.
                </>
              ),
              naive.length + optimized.length === 0 && earlierNaive.length === 0 && earlierOptimized.length > 0 && (
                <>
                  No current build. The{" "}
                  <NavLink to={{ route: "measured", hash: "baseline-builds" }} class="link">
                    earlier optimized builds
                  </NavLink>{" "}
                  of {list(earlierOptimized)} landed here.
                </>
              ),
            ].filter(Boolean);
            return (
              <Card
                key={b.id}
                id={`band-${b.id}`}
                as="section"
                class={ANCHOR}
                title={
                  <>
                    <span class="num mr-2 font-normal text-ink-2">
                      {b.min.toFixed(1)}–{b.max.toFixed(1)} s
                    </span>
                    {b.anatomyTitle}
                  </>
                }
                aside={<Tag>{b.name}</Tag>}
              >
                <Prose size="sm" html={data.story.bands[b.id as keyof typeof data.story.bands] ?? b.anatomyHtml} />
                {lines.length === 0 && (
                  <p class="mt-3 border-t border-rule pt-3 text-sm text-ink-2">
                    No build on this page lands here. Single runs do, on a host whose cache or worker was cold.
                  </p>
                )}
                {lines.length > 0 && (
                  <ul class="mt-3 grid gap-1 border-t border-rule pt-3 text-sm text-ink-2">
                    {lines.map((l) => (
                      <li>{l}</li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      </Section>

      <Section id="why" title="Why FCP moves in steps" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Prose html={data.story.whyHtml} />
      </Section>

      {data.earlier.length > 0 && (
        <Section id="baseline-builds" title="Where the Baseline band comes from" class={`border-t border-rule ${ANCHOR}`}>
          <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
            <LaneChart
              groups={pairGroups(data.earlier, fw, data.bands)}
              domain={FCP_DOMAIN}
              ticks={FCP_TICKS}
              bands={laneBands}
              named={false}
              paired
              valueHeader="FCP, s"
              legend={<RunLegend hosts={false} builds={{ hollow: "earlier naive build", filled: "earlier optimized build" }} />}
              caption="FCP in seconds, mobile Lighthouse, average of one run on each of three hosts."
            />
            <div class="min-w-0">
              <Prose size="sm" html={data.story.earlierHtml} />
              <Prose size="sm" html={data.story.earlierNoteHtml} class="mt-3 text-ink-2" />
            </div>
          </div>
        </Section>
      )}

      <Section id="steps" title="How to move an app into a faster band" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <ol class="grid grid-cols-[minmax(0,1fr)] gap-8">
          {data.steps.map((step, i) => (
            <li key={step.title} id={`step-${i + 1}`} class={ANCHOR}>
              <SubHeading kicker={String(i + 1).padStart(2, "0")}>{step.title}</SubHeading>
              <Prose html={step.html} class="mt-2" />
            </li>
          ))}
        </ol>
        <div class="mt-10">
          <SubHeading id="one-sentence">In one sentence</SubHeading>
          <Prose html={data.oneSentenceHtml} class="mt-2" />
        </div>
      </Section>

      <Section id="caveats" title="Caveats" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Callout kind="caveat" title="Limits of these measurements">
          <ul class="grid gap-2">
            <li>
              <strong>Lab data only.</strong> These are mobile Lighthouse results on a cold, throttled first load. Real users
              with warm caches, faster connections or repeat visits see different numbers.
            </li>
            <li>
              <strong>First load only.</strong> Prefetching, navigating on pointer-down and keeping data in memory make an app
              feel faster after the first page, and FCP doesn’t capture any of them.
            </li>
            <li>
              <strong>One host can sit a band higher.</strong> A cold cache or a cold worker adds a step on that host alone, so
              a single build can show up in two bands. The medians above smooth that out; Benchmark shows each host.
            </li>
            <li>
              <strong>Inlined CSS isn’t cached separately.</strong> It downloads again with every HTML response, which suits
              small stylesheets and hurts large ones.
            </li>
          </ul>
          {noPortFw.length > 0 && <p>No Books port yet, so not measured: {list(noPortFw.map((f) => f.id))}.</p>}
        </Callout>
        <p class="mt-8 text-sm text-ink-2">
          For LCP, TBT, CLS and per-host numbers on every port, see <NavLink to={{ route: "benchmark" }} class="link">Benchmark</NavLink>.
          To see which of these features each framework documents, use the{" "}
          <NavLink to={{ route: "home", hash: "matrix" }} class="link">
            capability matrix
          </NavLink>
          .
        </p>
      </Section>
    </>
  );
}
