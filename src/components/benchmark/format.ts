/* --------------------------------------------------------------------------
   Units, Core Web Vitals thresholds and status for the benchmark page.
   Pure functions, no data imports: safe to use from islands.
   -------------------------------------------------------------------------- */

export type CwvMetric = "fcp" | "lcp" | "tbt" | "cls";
export type CwvStatus = "good" | "ni" | "poor";

/**
 * Core Web Vitals thresholds: [good up to, needs improvement up to]. Above the
 * second number is poor. Times in ms (as stored), CLS unitless.
 */
export const CWV_THRESHOLDS: Record<CwvMetric, [number, number]> = {
  fcp: [1800, 3000],
  lcp: [2500, 4000],
  tbt: [200, 600],
  cls: [0.1, 0.25],
};

export const STATUS_TEXT: Record<CwvStatus, string> = {
  good: "Good",
  ni: "Needs improvement",
  poor: "Poor",
};

export function cwvStatus(metric: CwvMetric, value: number | null | undefined): CwvStatus | null {
  if (value == null) return null;
  const [good, ni] = CWV_THRESHOLDS[metric];
  return value <= good ? "good" : value <= ni ? "ni" : "poor";
}

export const METRIC_NAME: Record<CwvMetric | "perf" | "si" | "doc", string> = {
  perf: "Performance score",
  fcp: "First Contentful Paint",
  lcp: "Largest Contentful Paint",
  tbt: "Total Blocking Time",
  si: "Speed Index",
  cls: "Cumulative Layout Shift",
  doc: "Document request",
};

/** ms → "1.51" (seconds, 2 decimals). */
export const seconds = (ms: number) => (ms / 1000).toFixed(2);

/** Formatted value and unit for a metric, or null when missing. */
export function formatMetric(metric: keyof typeof METRIC_NAME, value: number | null | undefined): { text: string; unit: string } | null {
  if (value == null) return null;
  switch (metric) {
    case "fcp":
    case "lcp":
    case "si":
      return { text: seconds(value), unit: "s" };
    case "tbt":
    case "doc":
      return { text: String(Math.round(value)), unit: "ms" };
    case "cls":
      return { text: value.toFixed(3), unit: "" };
    case "perf":
      return { text: String(Math.round(value)), unit: "" };
  }
}

export const HOST_NAME: Record<string, string> = { vercel: "Vercel", netlify: "Netlify", cloudflare: "Cloudflare" };
export const hostName = (h: string) => HOST_NAME[h] ?? h;

/** "Vercel, Netlify and Cloudflare". */
export function listText(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-11-25" → "25 November 2026", without Date (no timezone drift at build time). */
export function longDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** ISO timestamp → "21:02 UTC". */
export function utcTime(iso: string | null | undefined) {
  return iso ? `${iso.slice(11, 16)} UTC` : null;
}

/** "/" → "Book list", "/10145787" → "Book page". */
export function pathName(path: string) {
  return path === "/" ? "Book list" : /^\/\d+$/.test(path) ? "Book page" : path;
}

/** bench/cwv-bench.mjs default for --cold-doc-ms: a run whose document took longer is "cold". */
export const COLD_DOC_MS = 1000;
