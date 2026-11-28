/**
 * Data contract for the site. `scripts/build-data.mjs` parses the markdown
 * sources in the parent repo (framework-feature-comparison.md,
 * fcp-groupings.md, README.md) into `src/data/generated/*.json`, and
 * `src/data/index.ts` exposes them through typed accessors.
 *
 * Every `*Html` field is trusted, pre-rendered HTML (markdown → HTML at
 * data-build time, code blocks already syntax-highlighted). Render it with
 * the shared <Prose html={...} /> component, never by re-parsing.
 */

/** Stable slugs. Order here is the source document's column order. */
export type FrameworkId =
  | "next"
  | "nuxt"
  | "sveltekit"
  | "solidstart"
  | "tanstack-start-react"
  | "tanstack-start-solid"
  | "pracht"
  | "waku"
  | "ember"
  | "astro"
  | "react-router"
  | "qwik-city"
  | "angular"
  | "marko"
  | "fresh"
  | "analog"
  | "vike"
  | "redwoodsdk"
  | "remix"
  | "void-react"
  | "void-vue"
  | "void-svelte"
  | "void-solid";

/**
 * Stable slugs, in source order. The source's "<picture>" row (section 8) is
 * not a feature here: it is folded into image-pipeline as `artDirection`.
 */
export type FeatureId =
  | "css-inlining"
  | "font-optimization"
  | "image-pipeline"
  | "caching"
  | "route-prefetching"
  | "streaming-ssr"
  | "early-hints"
  | "islands"
  | "render-modes"
  | "reactivity"
  | "bundle-analysis"
  | "third-party-scripts"
  | "multi-host-deployment"
  | "service-worker";

/**
 * The source uses three emoji tiers but four words:
 *   ✅ 1st-party (2 pts) · 🧪 Experimental (1) · 🧪 Third-party (1) · 🔧 Manual (0)
 */
export type Label = "first-party" | "experimental" | "third-party" | "manual";
export type Points = 0 | 1 | 2;

/** "fcp" = the critical-path levers; "other" = the rest. 2 points per feature; see MAX_SCORE in index.ts. */
export type FeatureGroup = "fcp" | "other";

/** "core" = the nine frameworks with full how-to sections; "additional" = the ones scored from bullets. */
export type FrameworkGroup = "core" | "additional";

export type Host = "vercel" | "netlify" | "cloudflare";

export interface Deployment {
  /** Git branch: "main" (baseline) or "optimized". */
  branch: string;
  /** Free-text note from the README table ("vibe port", "cache + fonts"), plain text. */
  note: string;
  urls: Partial<Record<Host, string>>;
}

export interface Framework {
  id: FrameworkId;
  /** Display name exactly as in the source tables, e.g. "TanStack Start (React)". */
  name: string;
  /** Short name for tight table headers, e.g. "TanStack (React)". */
  shortName: string;
  group: FrameworkGroup;
  /** 0-based position in source column order (core first, then additional). */
  order: number;
  /** Version string, markdown stripped, e.g. "nuxt 4.6.0 (nightly), compatibilityVersion 5". */
  version: string;
  /** Notes column of "Versions checked" (core) — plain text, may be "". */
  versionNotes: string;
  fcpScore: number; // 0–10
  otherScore: number; // 0–12
  total: number; // 0–22
  /** Whole percent, 0–100. */
  completeness: number;
  /** Shared ranks allowed (1, 1, 3 …). */
  rank: number;
  /** App name in the parent repo, e.g. "pracht-books". Null when the framework has no Books port. */
  app: string | null;
  /** GitHub URL of the port, from the README table. Null without a port. */
  repo: string | null;
  deployments: Deployment[];
  /** "Unscored extras" / "Other performance features not scored" entry for this framework, or null. */
  extrasHtml: string | null;
  /** From content/framework-links.json. `note` is set when the guide is the closest page, not a dedicated one. */
  links: {
    performanceGuide: { url: string; title: string; note: string | null };
    issues: string;
  };
}

export interface Feature {
  id: FeatureId;
  /** 1–11: the source section number, renumbered after the <picture> row is folded away. */
  number: number;
  /** Row name from the tables, e.g. "Production CSS inlining". Plain text. */
  name: string;
  /** Short name for tight layouts, e.g. "CSS inlining". */
  shortName: string;
  group: FeatureGroup;
  /** One plain-text sentence: the first sentence of "What it is and why it matters". */
  summary: string;
  /** "What it is and why it matters" body, without the "At a glance" paragraph. */
  whatHtml: string;
  /** The "At a glance" paragraph (without the bold lead-in), or "". */
  atAGlanceHtml: string;
  /** "Gotchas" list. */
  gotchasHtml: string;
}

/**
 * The source's "Art-directed / modern-format images (<picture>)" cell for one
 * framework, shown under its image-pipeline cell. Not scored.
 */
export interface ArtDirection {
  label: Label;
  bodyHtml: string;
  /** Site-authored sample (content/manual-examples), or null when the source has code. */
  exampleHtml: string | null;
}

/** One framework × feature cell. There is one per framework per feature. */
export interface Cell {
  frameworkId: FrameworkId;
  featureId: FeatureId;
  label: Label;
  points: Points;
  /**
   * How to enable it. Core frameworks: the "#### ✅ Nuxt — 1st-party" section
   * body (prose, code, caption). Additional frameworks: the bullet text after
   * the "— ✅ 1st-party:" lead-in.
   */
  bodyHtml: string;
  /** True when bodyHtml contains a code block. */
  hasSnippet: boolean;
  /**
   * Cells whose source has no code: a site-authored sample from
   * content/manual-examples, rendered like bodyHtml. Not from the sources.
   */
  exampleHtml: string | null;
  /** image-pipeline cells only: the folded <picture> how-to. Null elsewhere. */
  artDirection: ArtDirection | null;
  /** Framework-specific gotchas for this feature (content/framework-gotchas.md), or null. */
  gotchasHtml: string | null;
}

export interface RankingRow {
  rank: number;
  frameworkId: FrameworkId;
  fcpScore: number;
  otherScore: number;
  total: number;
  completeness: number;
}

/** Capability data — everything from framework-feature-comparison.md. */
export interface CapabilityData {
  frameworks: Framework[];
  features: Feature[];
  cells: Cell[];
  ranking: RankingRow[];
}

// ---------------------------------------------------------------------------
// Measured data — from fcp-groupings.md and README.md. Mobile Lighthouse, lab.
// ---------------------------------------------------------------------------

export type BuildKind = "baseline" | "basic-cache" | "optimized" | "max-optimized" | "cached";

export interface FcpBand {
  id: "fast" | "middle" | "slow-middle" | "baseline";
  name: string;
  /** Seconds, inclusive. */
  min: number;
  max: number;
  /** "Critical-path shape" column, plain text. */
  shape: string;
  /** Heading of this band's anatomy section after the range, plain text, e.g. "one link remains". */
  anatomyTitle: string;
  /** "Band-by-band anatomy" section body for this band. */
  anatomyHtml: string;
}

export interface FcpSample {
  /** Core framework this app maps to (Solid → solidstart, Svelte → sveltekit …). */
  frameworkId: FrameworkId;
  /** Label as written in the source row, e.g. "Svelte" or "`optimized` (prefetch + runtime cache)". */
  rowLabel: string;
  build: BuildKind;
  /** FCP in seconds; null where the source shows "—". */
  fcp: Record<Host, number | null>;
}

export interface FcpRun {
  id: string; // e.g. "2026-09-16"
  /** ISO date. The source headings say 9/16, 9/17, 9/22, 9/27 (2026). */
  date: string;
  /** Heading text without the date, e.g. "no Vite caching (baseline)". */
  title: string;
  samples: FcpSample[];
  /** Prose that follows the table in the source. */
  commentaryHtml: string;
}

/** README "Impact (9/22/2026 run)" table: averages across the three hosts. */
export interface LighthouseAverage {
  frameworkId: FrameworkId;
  build: BuildKind;
  perf: number;
  fcp: number;
  lcp: number;
}

export interface MeasuredData {
  /** The "LLM-generated note" blockquote from fcp-groupings.md. */
  disclaimerHtml: string;
  summaryHtml: string;
  bands: FcpBand[];
  runs: FcpRun[];
  averages: LighthouseAverage[];
  /** "Why the result is bands instead of a curve". */
  whyBandsHtml: string;
  /** "Why the 'basic cache' run spans every band" (about the 9/17 run). */
  whyBasicCacheHtml: string;
  /** "How to move an app down a band": one entry per numbered step. */
  steps: { title: string; html: string }[];
  caveatsHtml: string;
  oneSentenceHtml: string;
}

// ---------------------------------------------------------------------------
// Benchmark data — our own PageSpeed Insights runs (bench/cwv-bench.mjs →
// scripts/import-bench.mjs → content/benchmarks/<date>.json →
// scripts/build-bench-data.mjs → src/data/generated/benchmark.json).
// Mobile Lighthouse lab runs. Times are in ms; any metric can be null.
// ---------------------------------------------------------------------------

/** Paths the bench measures: "/" (book list) and "/10145787" (one book). */
export type BenchPath = string;

/** Median of a target's measured runs (cold runs excluded when possible). */
export interface BenchMetrics {
  /** Lighthouse Performance score, 0–100. */
  perf: number | null;
  /** First Contentful Paint, ms. */
  fcp: number | null;
  /** Largest Contentful Paint, ms. */
  lcp: number | null;
  /** Total Blocking Time, ms. */
  tbt: number | null;
  /** Speed Index, ms. */
  si: number | null;
  /** Time to Interactive, ms. Missing from runs imported before it was kept. */
  tti?: number | null;
  /** Cumulative Layout Shift, unitless. */
  cls: number | null;
  /** Document request time as seen by Lighthouse, ms. */
  doc: number | null;
  /**
   * First Contentful Paint in the real, unthrottled page load, ms. PSI simulates
   * throttling, so `fcp` is an estimate built from this load. Runs before
   * 2026-11-26 do not have it.
   */
  fcpObs?: number | null;
  /** Largest Contentful Paint in the unthrottled load, ms. Same caveats as `fcpObs`. */
  lcpObs?: number | null;
}

/**
 * Chrome UX Report (CrUX) field data for one URL: the 75th percentile of real
 * Chrome visits over the last 28 days. Times in ms, CLS unitless.
 */
export interface BenchField {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
  fcp: number | null;
  ttfb: number | null;
}

/** One deployment × path: framework × branch × host × path. */
export interface BenchTarget {
  frameworkId: FrameworkId;
  app: string;
  /** Git branch: "main" (baseline) or "optimized". */
  branch: string;
  host: Host;
  path: BenchPath;
  url: string;
  median: BenchMetrics | null;
  /** CrUX field data for this URL. Present only when PSI returned page-level data. */
  field?: BenchField | null;
  /** Measured runs made. */
  runs: number;
  /** Runs that went into the median (not cold). */
  usedRuns: number;
  /** Every run was cold (document over the cold threshold), so the median includes cold runs. */
  coldSuspect: boolean;
  error: string | null;
  /** When this target was measured (ISO). A run merged from a one-framework
   * bench has targets from different days; missing in files before 2026-11-26. */
  measuredAt?: string;
}

/** Average of target medians across hosts, per framework × branch × path. */
export interface BenchBuild extends BenchMetrics {
  frameworkId: FrameworkId;
  branch: string;
  path: BenchPath;
  /** Hosts that had data and went into the average. */
  hosts: Host[];
}

export interface BenchRun {
  /** "YYYY-MM-DD" (UTC start date). */
  date: string;
  startedAt: string;
  finishedAt: string | null;
  tool: string;
  /** "mobile" | "desktop". */
  strategy: string;
  runsPerTarget: number;
  psiRequests: number;
  /** The run stopped early (quota or interrupt); results are partial. */
  aborted: boolean;
  paths: BenchPath[];
  hosts: Host[];
  targets: BenchTarget[];
  builds: BenchBuild[];
}

export interface BenchHistoryEntry {
  date: string;
  targets: number;
  withData: number;
  builds: Pick<BenchBuild, "frameworkId" | "branch" | "path" | "fcp" | "lcp" | "perf">[];
}

export interface BenchmarkData {
  /** The newest run in full, or null when no run has been imported. */
  latest: BenchRun | null;
  /** Every run, oldest first. */
  history: BenchHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Feature tests: our own Playwright tests in each Books port
// (content/feature-tests/<frameworkId>.json → generated/feature-tests.json).
// ---------------------------------------------------------------------------

export type FeatureTestStatus = "pass" | "fail" | "n/a";

/** One port's test run. */
export interface FeatureTestRun {
  frameworkId: FrameworkId;
  /** "owner/name" on GitHub. */
  repo: string;
  repoUrl: string;
  branch: string;
  /** The port code that was tested. */
  commit: string;
  /** The commit that holds feature-tests/ (specs and results.json). */
  resultsCommit: string;
  /** github.com tree URL of feature-tests/ at `resultsCommit`. */
  testsUrl: string;
  /** ISO timestamp of the run. */
  testedAt: string;
}

/** One framework × feature test result. */
export interface FeatureTestResult {
  frameworkId: FrameworkId;
  featureId: FeatureId;
  status: FeatureTestStatus;
  /** What the test observed, in plain text. */
  evidence: string;
  /** How the port implements the feature. */
  method: string | null;
  /** Route in the port the spec opens, or null when the test checks build output. */
  testRoute: string | null;
  /** github.com URL of the spec at `resultsCommit`. */
  specUrl: string | null;
  /** The label the test was written against. */
  testedLabel: Label | null;
  /** Set when the test suggests a different label from the current one. */
  suggestedLabel: Label | null;
}

export interface FeatureTestData {
  frameworks: FeatureTestRun[];
  results: FeatureTestResult[];
}

/** What a page needs to show one cell's test: the result plus its run's links (`getCellTest`). */
export interface CellTest {
  status: FeatureTestStatus;
  evidence: string;
  method: string | null;
  testRoute: string | null;
  specUrl: string | null;
  testsUrl: string;
  repo: string;
  shortCommit: string;
  testedAt: string;
  /** The label the test was written against, when it differs from the cell's current label. */
  testedAs: Label | null;
}
