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
  | "fresh";

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
  | "islands"
  | "render-modes"
  | "reactivity"
  | "bundle-analysis"
  | "third-party-scripts"
  | "multi-host-deployment";

/**
 * The source uses three emoji tiers but four words:
 *   ✅ 1st-party (2 pts) · 🧪 Experimental (1) · 🧪 Third-party (1) · 🔧 Manual (0)
 */
export type Label = "first-party" | "experimental" | "third-party" | "manual";
export type Points = 0 | 1 | 2;

/** "fcp" = the five critical-path levers (max 10); "other" = six more (max 12). */
export type FeatureGroup = "fcp" | "other";

/** "core" = the nine frameworks with full how-to sections; "additional" = six scored from bullets. */
export type FrameworkGroup = "core" | "additional";

export type Host = "vercel" | "netlify" | "cloudflare";

export interface Deployment {
  /** Git branch, e.g. "main", "optimized", "nuxt-books-optimized-max". */
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
  /** App name in the parent repo, e.g. "pracht-books". */
  app: string;
  /** GitHub URL of the port, from the README table. */
  repo: string | null;
  deployments: Deployment[];
  /** "Unscored extras" / "Other performance features not scored" entry for this framework, or null. */
  extrasHtml: string | null;
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

/** One framework × feature cell. There are exactly 15 × 11 = 165. */
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
   * Manual cells only: a site-authored "build it yourself" sample from
   * content/manual-examples, rendered like bodyHtml. Not from the sources.
   */
  exampleHtml: string | null;
  /** image-pipeline cells only: the folded <picture> how-to. Null elsewhere. */
  artDirection: ArtDirection | null;
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
  /** Prose blocks for the methodology page. */
  methodology: {
    /** The "AI-generated note" blockquote at the top. */
    disclaimerHtml: string;
    /** "How to read the labels". */
    labelsHtml: string;
    /** "How scoring works, with a worked example". */
    scoringHtml: string;
    /** "How to read the ranking" + "How to recompute it" (without the ranking table). */
    rankingHtml: string;
    /** Summary + "honest reading" paragraphs under the second table. */
    otherFeaturesSummaryHtml: string;
    /** "Additional frameworks" intro (why these, what is excluded). */
    additionalFrameworksHtml: string;
    /** Each bullet of "Lower-confidence claims" as its own HTML fragment. */
    lowerConfidenceClaims: string[];
  };
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
