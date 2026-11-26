import { ExternalLink } from "../links.tsx";
import { Tag } from "../Page.tsx";
import { METRIC_NAME, type BenchMetricKey } from "./format.ts";

/* --------------------------------------------------------------------------
   One plain sentence per metric, its "good" threshold and the page that sets
   it. Thresholds checked against web.dev and the Lighthouse docs.
   -------------------------------------------------------------------------- */

interface Entry {
  key: BenchMetricKey;
  short: string;
  cwv?: boolean;
  text: string;
  good: string;
  source: { href: string; name: string };
}

const WEB_DEV = "https://web.dev/articles/";
const LH = "https://developer.chrome.com/docs/lighthouse/performance/";

const LAB: Entry[] = [
  {
    key: "perf",
    short: "Perf",
    text: "Lighthouse's 0–100 score, a weighted mix of FCP, Speed Index, LCP, TBT and CLS.",
    good: "90 or more",
    source: { href: `${LH}performance-scoring`, name: "Lighthouse performance scoring" },
  },
  {
    key: "fcp",
    short: "FCP",
    text: "The time from navigation until the first text or image is drawn.",
    good: "1.8 s or less",
    source: { href: `${WEB_DEV}fcp`, name: "web.dev: FCP" },
  },
  {
    key: "lcp",
    short: "LCP",
    cwv: true,
    text: "The time from navigation until the largest image or text block in the viewport is drawn.",
    good: "2.5 s or less",
    source: { href: `${WEB_DEV}lcp`, name: "web.dev: LCP" },
  },
  {
    key: "tbt",
    short: "TBT",
    text: "The total time after FCP that long tasks blocked the main thread from responding to input.",
    good: "under 200 ms on mobile",
    source: { href: `${WEB_DEV}tbt`, name: "web.dev: TBT" },
  },
  {
    key: "cls",
    short: "CLS",
    cwv: true,
    text: "How far visible content jumps around unexpectedly while the page is open.",
    good: "0.1 or less",
    source: { href: `${WEB_DEV}cls`, name: "web.dev: CLS" },
  },
  {
    key: "si",
    short: "SI",
    text: "How quickly the visible part of the page fills in during load.",
    good: "3.4 s or less on mobile",
    source: { href: `${LH}speed-index`, name: "Lighthouse: Speed Index" },
  },
  {
    key: "tti",
    short: "TTI",
    text: "The time until the page has loaded its main resources and answers input quickly, no longer part of the score since Lighthouse 10.",
    good: "under 5 s on mobile",
    source: { href: `${WEB_DEV}tti`, name: "web.dev: TTI" },
  },
  {
    key: "doc",
    short: "Doc",
    text: "The time from Lighthouse sending the HTML request to receiving the last byte, so it covers TTFB plus the download.",
    good: "TTFB of 0.8 s or less",
    source: { href: `${WEB_DEV}ttfb`, name: "web.dev: TTFB" },
  },
];

const FIELD: Entry[] = [
  {
    key: "inp",
    short: "INP",
    cwv: true,
    text: "The delay from a click, tap or key press to the next frame, for the slowest interaction of a visit.",
    good: "200 ms or less",
    source: { href: `${WEB_DEV}inp`, name: "web.dev: INP" },
  },
  {
    key: "ttfb",
    short: "TTFB",
    text: "The time from starting the navigation until the first byte of the HTML arrives.",
    good: "0.8 s or less",
    source: { href: `${WEB_DEV}ttfb`, name: "web.dev: TTFB" },
  },
];

function List({ entries }: { entries: Entry[] }) {
  return (
    <dl class="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map((e) => (
        <div key={e.key} class="min-w-0 border-t border-rule pt-3">
          <dt class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span class="num font-semibold text-ink">{e.short}</span>
            <span class="text-sm text-ink-2">{METRIC_NAME[e.key]}</span>
            {e.cwv && <Tag tone="quiet">Core Web Vital</Tag>}
          </dt>
          <dd class="mt-1 text-sm text-ink-2 text-pretty">{e.text}</dd>
          <dd class="mt-1 text-xs text-ink-3">
            Good: <span class="num text-ink">{e.good}</span> ·{" "}
            <ExternalLink href={e.source.href}>{e.source.name}</ExternalLink>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Lab metrics, plus INP and TTFB when the run has field data. */
export function MetricGuide({ field = false }: { field?: boolean }) {
  return (
    <div class="grid gap-6">
      <List entries={LAB} />
      {field && (
        <div>
          <h3 class="eyebrow mb-2 !text-ink-2">Field data only</h3>
          <List entries={FIELD} />
        </div>
      )}
    </div>
  );
}
