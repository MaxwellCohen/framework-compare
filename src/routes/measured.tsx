import type { HeadArgs, RouteComponentProps } from "@pracht/core";
import { markdownAlternate, pageLd } from "../agents.ts";
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
import type { FcpRun, FcpSample, FrameworkId } from "../data/types.ts";

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
    whyBandsHtml: measured.whyBandsHtml,
    whyBasicCacheHtml: measured.whyBasicCacheHtml,
    steps: measured.steps,
    caveatsHtml: measured.caveatsHtml,
    oneSentenceHtml: measured.oneSentenceHtml,
    frameworks: frameworks.map((f) => ({
      id: f.id,
      name: f.name,
      shortName: f.shortName,
      measured: measuredIds.has(f.id),
    })),
  };
}

export function head({ data }: HeadArgs<typeof loader>) {
  const title = `Why FCP comes in ${data.bands.length} bands — Framework Compare`;
  const description = `First Contentful Paint for the same Books app, built in different frameworks, bunches into ${data.bands.length} bands instead of a smooth spread. Each band is one more request the browser waits for before it can paint. Mobile Lighthouse, September 2026.`;
  return {
    title,
    meta: [{ name: "description", content: description }],
    link: [markdownAlternate("/measured")],
    script: [pageLd("WebPage", "/measured", title, description)],
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

  return (
    <>
      <PageHeader
        eyebrow="FCP bands"
        title={`Why First Contentful Paint comes in ${data.bands.length} bands`}
        lede={`We built the same Books app in each framework and measured First Contentful Paint (FCP), the moment the browser first draws text or an image. The results don’t spread out smoothly. They bunch into ${data.bands.length} bands, and each band is one more request the browser has to wait for before it can paint.`}
        meta={
          <>
            <Tag>Mobile Lighthouse</Tag>
            <Tag>Simulated Slow 4G, 4× CPU throttle</Tag>
            <Tag>
              {data.runs.length} runs, September 2026
            </Tag>
          </>
        }
      />

      <JumpNav
        items={[
          { hash: "bands", label: "The bands" },
          { hash: "why", label: "Why bands form" },
          { hash: "anatomy", label: "Band by band" },
          { hash: "runs", label: "The runs" },
          { hash: "steps", label: "Moving down a band" },
          { hash: "caveats", label: "Caveats" },
        ]}
      />

      <Section id="bands" title={`The ${data.bands.length} bands`} class={ANCHOR}>
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

      <Section id="why" title="Why FCP moves in steps" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Prose html={data.whyBandsHtml} />
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

      <Section
        id="runs"
        title="The runs behind the bands"
        class={`border-t border-rule ${ANCHOR}`}
        intro={`Each marker is one mobile Lighthouse run of one deployment, showing FCP in seconds as read from a screenshot. The shaded columns are the ${data.bands.length} bands; most markers land inside one. Rows keep the source’s order and are not sorted by speed. A dash means not measured.`}
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
                  </div>
                </div>
                {run.id === "2026-09-17" && (
                  <div id="basic-cache" class={`mt-6 max-w-prose ${ANCHOR}`}>
                    <SubHeading>Why one build landed in every band</SubHeading>
                    <Prose html={data.whyBasicCacheHtml} class="mt-2" />
                  </div>
                )}
              </article>
            );
          })}
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
        <div class="mt-10">
          <SubHeading id="one-sentence">In one sentence</SubHeading>
          <Prose html={data.oneSentenceHtml} class="mt-2" />
        </div>
      </Section>

      <Section id="caveats" title="Caveats" width="prose" class={`border-t border-rule ${ANCHOR}`}>
        <Callout kind="caveat" title="Limits of these measurements">
          <Prose size="sm" html={data.caveatsHtml} />
          <Prose size="sm" html={data.disclaimerHtml} />
          <p>
            The runs covered {list(measuredFw)}; the source tables call the SvelteKit and SolidStart ports “Svelte” and “Solid”.{" "}
            {list(otherFw)} were not in these runs.
          </p>
        </Callout>
        <p class="mt-8 text-sm text-ink-2">
          For current FCP, LCP, TBT and CLS on every port, see <NavLink to={{ route: "benchmark" }} class="link">Benchmark</NavLink>.
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
