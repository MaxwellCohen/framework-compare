/**
 * Typed accessors over the generated JSON. Import from here, not from
 * `./generated/*` directly. Only import this module from loaders
 * (`loader`, `getStaticPaths`) so the full dataset never ships to the client:
 * a loader should return just the slice its page renders.
 */
import capabilityJson from "./generated/capability.json";
import measuredJson from "./generated/measured.json";
import benchmarkJson from "./generated/benchmark.json";
import featureTestsJson from "./generated/feature-tests.json";
import type {
  BenchBuild,
  BenchmarkData,
  CapabilityData,
  Cell,
  Feature,
  FeatureGroup,
  FeatureId,
  CellTest,
  FeatureTestData,
  FeatureTestResult,
  FeatureTestRun,
  Framework,
  FrameworkId,
  Label,
  MeasuredData,
  Points,
} from "./types.ts";

export type * from "./types.ts";

export const capability = capabilityJson as unknown as CapabilityData;
export const measured = measuredJson as unknown as MeasuredData;
export const benchmark = benchmarkJson as unknown as BenchmarkData;
export const featureTests = featureTestsJson as unknown as FeatureTestData;

export const frameworks: Framework[] = capability.frameworks;
export const features: Feature[] = capability.features;
export const cells: Cell[] = capability.cells;
export const ranking = capability.ranking;

/** 2 points per feature in each group. */
export const MAX_SCORE: Record<FeatureGroup, number> = {
  fcp: 2 * capability.features.filter((f) => f.group === "fcp").length,
  other: 2 * capability.features.filter((f) => f.group === "other").length,
};
export const MAX_TOTAL = MAX_SCORE.fcp + MAX_SCORE.other;

export const LABEL_POINTS: Record<Label, Points> = {
  "first-party": 2,
  experimental: 1,
  "third-party": 1,
  manual: 0,
};

/** Human label text, matching the source wording. */
export const LABEL_TEXT: Record<Label, string> = {
  "first-party": "1st-party",
  experimental: "Experimental",
  "third-party": "Third-party",
  manual: "Manual",
};

const frameworkById = new Map(frameworks.map((f) => [f.id, f]));
const featureById = new Map(features.map((f) => [f.id, f]));
const cellByKey = new Map(cells.map((c) => [`${c.frameworkId}:${c.featureId}`, c]));

export function getFramework(id: string): Framework | undefined {
  return frameworkById.get(id as FrameworkId);
}

export function getFeature(id: string): Feature | undefined {
  return featureById.get(id as FeatureId);
}

export function getCell(frameworkId: FrameworkId, featureId: FeatureId): Cell {
  const cell = cellByKey.get(`${frameworkId}:${featureId}`);
  if (!cell) throw new Error(`Missing cell ${frameworkId}:${featureId}`);
  return cell;
}

export function featuresInGroup(group: FeatureGroup): Feature[] {
  return features.filter((f) => f.group === group);
}

/** False for a framework that is scored from vendor docs only: no Books port, so no deploys, benchmark or FCP data. */
export function hasPort(f: Pick<Framework, "app">): boolean {
  return f.app !== null;
}

/** Frameworks sorted by rank, ties in source column order. */
export function frameworksByRank(): Framework[] {
  return [...frameworks].sort((a, b) => a.rank - b.rank || a.order - b.order);
}

/** The compact matrix: label + points per cell, without the HTML bodies. */
export interface MatrixCell {
  label: Label;
  points: Points;
}
export type Matrix = Record<FrameworkId, Record<FeatureId, MatrixCell>>;

export function getMatrix(): Matrix {
  const matrix = {} as Matrix;
  for (const cell of cells) {
    (matrix[cell.frameworkId] ??= {} as Record<FeatureId, MatrixCell>)[cell.featureId] = {
      label: cell.label,
      points: cell.points,
    };
  }
  return matrix;
}

// ---------------------------------------------------------------------------
// Benchmark (our own PSI runs). Any framework, branch, host, path or metric
// can be missing from a run, so every helper tolerates gaps.
// ---------------------------------------------------------------------------

/** The book-list page; the bench also measures one book page. */
export const BENCH_HOME_PATH = "/";

/** Every port has the same two branches: `main` (baseline) and `optimized`. */
const BRANCH_ORDER = ["main", "optimized"];
const BRANCH_NAME: Record<string, string> = {
  main: "baseline",
  optimized: "optimized",
};

/** Build name for a git branch: main → "baseline", optimized → "optimized". Unknown branches keep their name. */
export function benchBuildName(branch: string): string {
  return BRANCH_NAME[branch] ?? branch;
}

/** Sort key for branches: baseline first, then optimized, then anything else. */
export function benchBranchRank(branch: string): number {
  const i = BRANCH_ORDER.indexOf(branch);
  return i === -1 ? BRANCH_ORDER.length : i;
}

/** Sort key for paths: the order the run lists them, home page first. */
export function benchPathRank(path: string): number {
  if (path === BENCH_HOME_PATH) return -1;
  const i = benchmark.latest?.paths.indexOf(path) ?? -1;
  return i === -1 ? 999 : i;
}

const HOST_ORDER = ["vercel", "netlify", "cloudflare"];

/** Sort key for hosts: Vercel, Netlify, Cloudflare, then anything else. */
export function benchHostRank(host: string): number {
  const i = HOST_ORDER.indexOf(host);
  return i === -1 ? HOST_ORDER.length : i;
}

/** One framework's builds in the latest run, by path then branch. Empty when it has no data. */
export function benchBuildsFor(id: FrameworkId): BenchBuild[] {
  return (benchmark.latest?.builds ?? [])
    .filter((b) => b.frameworkId === id)
    .sort((a, b) => benchPathRank(a.path) - benchPathRank(b.path) || benchBranchRank(a.branch) - benchBranchRank(b.branch));
}

// ---------------------------------------------------------------------------
// Feature tests (our own Playwright tests in each port). Any cell can be untested.
// ---------------------------------------------------------------------------

const testRunById = new Map(featureTests.frameworks.map((r) => [r.frameworkId, r]));
const testByKey = new Map(featureTests.results.map((r) => [`${r.frameworkId}:${r.featureId}`, r]));

/** The test run for one port, or null when the port has none. */
export function getTestRun(frameworkId: FrameworkId): FeatureTestRun | null {
  return testRunById.get(frameworkId) ?? null;
}

export function getCellTest(frameworkId: FrameworkId, featureId: FeatureId): CellTest | null {
  const r = testByKey.get(`${frameworkId}:${featureId}`);
  const run = testRunById.get(frameworkId);
  if (!r || !run) return null;
  return {
    status: r.status,
    evidence: r.evidence,
    method: r.method,
    testRoute: r.testRoute,
    specUrl: r.specUrl,
    testsUrl: run.testsUrl,
    repo: run.repo,
    shortCommit: run.resultsCommit.slice(0, 7),
    testedAt: run.testedAt,
    testedAs: r.testedLabel && r.testedLabel !== getCell(frameworkId, featureId).label ? r.testedLabel : null,
  };
}

// ---------------------------------------------------------------------------
// Naive vs optimized FCP per port (for /measured), from the latest run.
// ---------------------------------------------------------------------------

export interface FcpPair {
  frameworkId: FrameworkId;
  /** Median across hosts of each host's median FCP, in seconds. */
  naive: number | null;
  optimized: number | null;
  /** Per-host medians in seconds, host order as in the run. */
  naiveByHost: (number | null)[];
  optimizedByHost: (number | null)[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Home-page FCP of each port's naive (default-settings) build against its
 * optimized build.
 */
export function fcpPairs(): FcpPair[] {
  const run = benchmark.latest;
  if (!run) return [];
  const hosts = [...run.hosts].sort((a, b) => benchHostRank(a) - benchHostRank(b));
  const ids = [...new Set(run.targets.map((t) => t.frameworkId))];
  const byHost = (id: FrameworkId, build: string) =>
    hosts.map((h) => {
      const t = run.targets.find(
        (t) => t.frameworkId === id && t.host === h && t.path === BENCH_HOME_PATH && benchBuildName(t.branch) === build,
      );
      return t?.median?.fcp != null ? t.median.fcp / 1000 : null;
    });
  return ids.map((id) => {
    const naiveByHost = byHost(id, "baseline");
    const optimizedByHost = byHost(id, "optimized");
    const ok = (v: (number | null)[]) => v.filter((x): x is number => x != null);
    return { frameworkId: id, naive: median(ok(naiveByHost)), optimized: median(ok(optimizedByHost)), naiveByHost, optimizedByHost };
  });
}
