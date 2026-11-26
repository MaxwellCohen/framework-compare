import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import {
  Callout,
  Card,
  Container,
  DotChart,
  FrameworkName,
  NavLink,
  PageHeader,
  Prose,
  Section,
  Stat,
  StatGroup,
  Tag,
} from "../components/index.ts";
import { LaneChart, MarkerKey, type LaneGroup } from "../components/measured/LaneChart.tsx";
import {
  ANCHOR,
  BUILD_TEXT,
  FCP_DOMAIN,
  FCP_TICKS,
  HOSTS,
  JumpNav,
  RowLabel,
  RunLegend,
  SubHeading,
} from "../components/measured/parts.tsx";
import type { FcpRun, FcpSample, FrameworkId, LighthouseAverage } from "../data/types.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-09-16" → "16 September 2026", without Date (no timezone drift at build time). */
function longDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export async function loader() {
  const { measured, frameworks } = await import("../data/index.ts");

  const measuredIds = new Set<FrameworkId>([
    ...measured.runs.flatMap((r) => r.samples.map((s) => s.frameworkId)),
    ...measured.averages.map((a) => a.frameworkId),
  ]);

  // The summary's first paragraph ends "…cluster into four bands:" where the
  // source has the band table; the page puts the band chart in that position.
  const cut = measured.summaryHtml.indexOf("</p>") + 4;

  return {
    disclaimerHtml: measured.disclaimerHtml,
    summaryLeadHtml: measured.summaryHtml.slice(0, cut),
    summaryRestHtml: measured.summaryHtml.slice(cut),
    bands: measured.bands,
    runs: measured.runs.map((r) => ({ ...r, dateText: longDate(r.date) })),
    averages: measured.averages,
    whyBandsHtml: measured.whyBandsHtml,
    whyBasicCacheHtml: measured.whyBasicCacheHtml,
    steps: measured.steps,
    caveatsHtml: measured.caveatsHtml,
    oneSentenceHtml: measured.oneSentenceHtml,
    sampleCount: measured.runs.reduce(
      (n, r) => n + r.samples.reduce((k, s) => k + Object.values(s.fcp).filter((v) => v != null).length, 0),
      0,
    ),
    frameworks: frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      shortName: f.shortName,
      measured: measuredIds.has(f.id),
    })),
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const measuredCount = data.frameworks.filter((f) => f.measured).length;
  return {
    title: `Measured First Contentful Paint: ${data.runs.length} runs on ${HOSTS.length} hosts — Framework Compare`,
    meta: [
      {
        name: "description",
        content: `Lab measurements of First Contentful Paint (FCP) for the Books demo app in ${measuredCount} of ${data.frameworks.length} frameworks: mobile Lighthouse on Vercel, Netlify and Cloudflare, ${data.runs.length} runs in September 2026, baseline and optimized builds. Single runs, read from screenshots.`,
      },
    ],
  };
}

type Data = Awaited<ReturnType<typeof loader>>;
type Fw = Data["frameworks"][number];

function bandOf(v: number, bands: Data["bands"]) {
  return bands.find((b) => v >= b.min && v <= b.max);
}

/** One run's samples as lane groups: one group per source row, one lane per host. */
function runGroups(run: FcpRun, fw: Map<FrameworkId, Fw>, bands: Data["bands"]): LaneGroup[] {
  const name = (s: FcpSample) => <FrameworkName framework={fw.get(s.frameworkId)!} />;

  // 9/27: three builds of one framework; the source row label names the build.
  if (new Set(run.samples.map((s) => s.frameworkId)).size === 1) {
    return run.samples.map((s) => ({
      key: s.build,
      label: <RowLabel text={s.rowLabel} />,
      lanes: HOSTS.map((h) => ({ key: h.id, name: h.label, series: h.series, value: s.fcp[h.id], hollow: s.build === "baseline" })),
    }));
  }

  const groups: LaneGroup[] = [];
  const done = new Set<FrameworkId>();
  for (const s of run.samples) {
    if (done.has(s.frameworkId)) continue;
    done.add(s.frameworkId);
    const same = run.samples.filter((o) => o.frameworkId === s.frameworkId);
    const base = same.find((o) => o.build === "baseline");
    const after = same.find((o) => o.build !== "baseline");

    if (base && after) {
      groups.push({
        key: s.frameworkId,
        label: (
          <>
            {name(s)}
            <Tag tone="quiet">
              {BUILD_TEXT[base.build]} → {BUILD_TEXT[after.build]}
            </Tag>
          </>
        ),
        lanes: HOSTS.map((h) => ({ key: h.id, name: h.label, series: h.series, from: base.fcp[h.id], value: after.fcp[h.id] })),
      });
      continue;
    }

    const values = HOSTS.map((h) => s.fcp[h.id]).filter((v): v is number => v != null);
    const hit = new Set(values.map((v) => bandOf(v, bands)?.id ?? "none"));
    groups.push({
      key: s.frameworkId,
      label: (
        <>
          {name(s)}
          <Tag tone="quiet">{BUILD_TEXT[s.build]}</Tag>
        </>
      ),
      note:
        run.id === "2026-09-17"
          ? `${Math.min(...values).toFixed(1)}–${Math.max(...values).toFixed(1)} s across hosts · ${hit.size} ${hit.size === 1 ? "band" : "bands"}`
          : undefined,
      lanes: HOSTS.map((h) => ({ key: h.id, name: h.label, series: h.series, value: s.fcp[h.id], hollow: s.build === "baseline" })),
    });
  }
  return groups;
}

const RUN_BUILDS: Record<string, { hollow: string; filled: string } | undefined> = {
  "2026-09-16": { hollow: "baseline build", filled: "cached build (Next)" },
  "2026-09-22": { hollow: "baseline build", filled: "optimized build (Next: cached)" },
  "2026-09-27": { hollow: "baseline build", filled: "optimized or max-optimized build" },
};

function averageGroups(averages: LighthouseAverage[], fw: Map<FrameworkId, Fw>, metric: "perf" | "fcp" | "lcp"): LaneGroup[] {
  const ids = [...new Set(averages.map((a) => a.frameworkId))];
  return ids.map((id) => {
    const rows = averages.filter((a) => a.frameworkId === id);
    const base = rows.find((a) => a.build === "baseline");
    const after = rows.find((a) => a.build !== "baseline")!;
    return {
      key: id,
      label: (
        <>
          <FrameworkName framework={fw.get(id)!} />
          {!base && <Tag tone="quiet">{BUILD_TEXT[after.build]}</Tag>}
        </>
      ),
      lanes: [{ key: metric, series: 0 as const, from: base?.[metric], value: after[metric] }],
    };
  });
}

export function Component({ data }: RouteComponentProps<typeof loader>) {
  const fw = new Map(data.frameworks.map((f) => [f.id, f]));
  const measuredFw = data.frameworks.filter((f) => f.measured);
  const otherFw = data.frameworks.filter((f) => !f.measured);
  const laneBands = data.bands.map((b) => ({ name: b.name, min: b.min, max: b.max }));
  const list = (items: Fw[]) =>
    items.map((f, i) => (
      <>
        {i > 0 && (i === items.length - 1 ? " and " : ", ")}
        <FrameworkName framework={f} />
      </>
    ));

  const buildKey = (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      <li class="flex items-center gap-1.5">
        <MarkerKey series={0} hollow />
        baseline build
      </li>
      <li class="flex items-center gap-1.5">
        <MarkerKey series={0} />
        optimized build (Next: cached)
      </li>
    </ul>
  );

  return (
    <>
      <PageHeader
        eyebrow="Lab measurements"
        title="Measured First Contentful Paint"
        lede={`First Contentful Paint (FCP) is the moment the browser first paints text or an image. This page shows FCP for the same Books demo app built in each framework, deployed to ${HOSTS.length} hosts and tested in ${data.runs.length} mobile Lighthouse runs in September 2026.`}
        meta={
          <>
            <Tag>Mobile Lighthouse</Tag>
            <Tag>Simulated Slow 4G, 4× CPU throttle</Tag>
            <Tag>Lab data, single runs</Tag>
            <Tag>
              {measuredFw.length} of {data.frameworks.length} frameworks
            </Tag>
          </>
        }
        aside={
          <StatGroup cols={3} class="lg:w-[26rem]">
            <Stat label="Runs" value={data.runs.length} hint="16–27 Sep 2026" />
            <Stat label="FCP readings" value={data.sampleCount} hint="one per app, build and host" />
            <Stat label="Hosts" value={HOSTS.length} hint="Vercel, Netlify, Cloudflare" />
          </StatGroup>
        }
      />

      <Container class="pt-6">
        <Callout kind="note" title="Newer numbers">
          <p>
            These runs are from September 2026. For current FCP, LCP, TBT and CLS on every deployment, from a PageSpeed Insights
            run you can repeat, see <NavLink to={{ route: "benchmark" }}>Benchmark</NavLink>.
          </p>
        </Callout>
      </Container>

      <Container class="grid gap-4 py-6 lg:grid-cols-2">
        <Callout kind="caveat" title="How these numbers were produced">
          <Prose size="sm" html={data.disclaimerHtml} />
        </Callout>
        <Callout kind="caveat" title={`Coverage: ${measuredFw.length} of ${data.frameworks.length} frameworks`}>
          <p>
            This page has measurements for {list(measuredFw)}. The source tables call the SvelteKit and SolidStart ports “Svelte” and
            “Solid”.
          </p>
          <p>
            {list(otherFw)} were not in these runs. <NavLink to={{ route: "benchmark" }}>Benchmark</NavLink> covers every
            port.
          </p>
        </Callout>
      </Container>

      <JumpNav
        items={[
          { hash: "finding", label: "Summary" },
          { hash: "runs", label: "Runs" },
          { hash: "averages", label: "Averages" },
          { hash: "why", label: "Why bands" },
          { hash: "anatomy", label: "Band by band" },
          { hash: "steps", label: "Getting faster" },
          { hash: "caveats", label: "Caveats" },
        ]}
      />

      <Section id="finding" title={`FCP falls into ${data.bands.length} bands`} class={ANCHOR}>
        <div class="max-w-prose">
          <Prose html={data.summaryLeadHtml} />
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
            caption={`FCP in seconds, mobile Lighthouse (simulated Slow 4G, 4× CPU throttle). Each bar is a band’s approximate range, and under each name is what the page waits for before it can paint. Every FCP chart below uses this same ${FCP_DOMAIN[0]}–${FCP_DOMAIN[1]} s axis.`}
          />
        </div>
        <div class="max-w-prose">
          <Prose html={data.summaryRestHtml} />
        </div>
      </Section>

      <Section
        id="runs"
        title="Every measurement, run by run"
        class={`border-t border-rule ${ANCHOR}`}
        intro={`Each marker is one mobile Lighthouse run of one deployment, showing FCP in seconds as read from a screenshot. The shaded columns are the ${data.bands.length} bands. Rows keep the source’s order and are not sorted by speed. A dash means not measured.`}
        actions={
          <ul class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {data.runs.map((r) => (
              <li key={r.id}>
                <NavLink to={{ route: "measured", hash: `run-${r.id}` }} class="link num">
                  {r.date.slice(5).replace("-", "/").replace(/^0/, "")}
                </NavLink>
              </li>
            ))}
          </ul>
        }
      >
        <div class="grid gap-10">
          {data.runs.map((run, i) => {
            const groups = runGroups(run, fw, data.bands);
            const paired = groups.some((g) => g.lanes.some((l) => l.from != null));
            const oneFramework = new Set(run.samples.map((s) => s.frameworkId)).size === 1;
            return (
              <article key={run.id} id={`run-${run.id}`} class={`${ANCHOR} ${i > 0 ? "border-t border-rule pt-8" : ""}`}>
                <div class="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 class="font-display text-lg text-ink">
                    <span class="num mr-3 align-middle text-sm text-ink-3">
                      <time dateTime={run.date}>{run.dateText}</time>
                    </span>
                    {run.title.charAt(0).toUpperCase() + run.title.slice(1)}
                  </h3>
                </div>
                <div class="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
                  <LaneChart
                    groups={groups}
                    domain={FCP_DOMAIN}
                    ticks={FCP_TICKS}
                    bands={laneBands}
                    paired={paired}
                    valueHeader="FCP, s"
                    legend={<RunLegend builds={RUN_BUILDS[run.id]} />}
                    caption={
                      <>
                        FCP in seconds, mobile Lighthouse, one run per marker.
                        {paired && " A line joins the baseline and optimized builds of the same app on the same host."}
                        {oneFramework && (
                          <>
                            {" "}
                            All three rows are builds of <FrameworkName framework={fw.get(run.samples[0].frameworkId)!} />.
                          </>
                        )}
                      </>
                    }
                  />
                  <div class="min-w-0">
                    <Prose size="sm" html={run.commentaryHtml} />
                    {run.id === "2026-09-17" && (
                      <p class="mt-3 text-sm text-ink-2">
                        See{" "}
                        <NavLink to={{ route: "measured", hash: "basic-cache" }} class="link">
                          why the “basic cache” run spans every band
                        </NavLink>
                        .
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section
        id="averages"
        title="Baseline vs optimized builds, averaged across hosts"
        class={`border-t border-rule ${ANCHOR}`}
        intro="Each figure is one build’s average across Vercel, Netlify and Cloudflare in the 22 September run, taken from the README’s “Impact (9/22/2026 run)” table. A line joins each app’s baseline build (before FCP tuning) to its optimized build. Next has only a cached build, with no separate baseline. Rows keep the source’s order."
        actions={buildKey}
      >
        <div class="grid gap-x-10 gap-y-8 lg:grid-cols-3">
          <LaneChart
            title="Lighthouse Performance score"
            groups={averageGroups(data.averages, fw, "perf")}
            domain={[70, 100]}
            ticks={[70, 80, 90, 100]}
            unit=""
            digits={0}
            named={false}
            paired
            valueHeader="score"
            caption="Average mobile Lighthouse Performance score, 0–100; higher is better. The axis starts at 70."
          />
          <LaneChart
            title="First Contentful Paint"
            groups={averageGroups(data.averages, fw, "fcp")}
            domain={FCP_DOMAIN}
            ticks={FCP_TICKS}
            bands={laneBands}
            bandNames={false}
            named={false}
            paired
            valueHeader="FCP, s"
            caption="Average FCP in seconds; lower is better. Shading marks the FCP bands."
          />
          <LaneChart
            title="Largest Contentful Paint"
            groups={averageGroups(data.averages, fw, "lcp")}
            domain={[2, 5]}
            ticks={[2, 3, 4, 5]}
            named={false}
            paired
            valueHeader="LCP, s"
            caption="Average Largest Contentful Paint (LCP) in seconds: when the largest text block or image appears. Lower is better. The axis runs 2–5 s."
          />
        </div>
      </Section>

      <Section id="why" title="Why FCP falls into bands instead of a smooth curve" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Prose html={data.whyBandsHtml} />
        <div class="mt-8">
          <SubHeading id="basic-cache">Why the “basic cache” run spans every band</SubHeading>
          <p class="mt-1 mb-3 text-sm text-ink-3">
            About the{" "}
            <NavLink to={{ route: "measured", hash: "run-2026-09-17" }} class="link">
              17 September run
            </NavLink>
            .
          </p>
          <Prose html={data.whyBasicCacheHtml} />
        </div>
      </Section>

      <Section id="anatomy" title="What each band waits on" class={`border-t border-rule ${ANCHOR}`}>
        <div class="grid gap-4 lg:grid-cols-2">
          {data.bands.map((b) => (
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
              <Prose size="sm" html={b.anatomyHtml} />
            </Card>
          ))}
        </div>
      </Section>

      <Section id="steps" title="How to move an app into a faster band" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <ol class="grid grid-cols-[minmax(0,1fr)] gap-8">
          {data.steps.map((step, i) => (
            <li key={step.title} id={`step-${i + 1}`} class={ANCHOR}>
              <SubHeading kicker={String(i + 1).padStart(2, "0")}>{step.title}</SubHeading>
              <Prose html={step.html} class="mt-2" />
            </li>
          ))}
        </ol>
      </Section>

      <Section id="caveats" title="Caveats" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Callout kind="caveat" title="Limits of these measurements">
          <Prose size="sm" html={data.caveatsHtml} />
        </Callout>
        <div class="mt-8">
          <SubHeading id="one-sentence">The one-sentence version</SubHeading>
          <Prose html={data.oneSentenceHtml} class="mt-2" />
        </div>
        <p class="mt-8 text-sm text-ink-2">
          To see which of these features each framework documents, use the{" "}
          <NavLink to={{ route: "home", hash: "matrix" }} class="link">
            capability matrix
          </NavLink>
          .{" "}
          <NavLink to={{ route: "methodology" }} class="link">
            Methodology
          </NavLink>{" "}
          explains how each label was assigned.
        </p>
      </Section>
    </>
  );
}
