#!/usr/bin/env node
/**
 * Copies a bench run into the site: reads <dir>/results.json (or a results.json
 * path) written by bench/cwv-bench.mjs, keeps what the site shows, and writes
 * content/benchmarks/<YYYY-MM-DD>.json. It then rebuilds src/data/generated/benchmark.json.
 *
 *   node scripts/import-bench.mjs bench/results/20261125-150209
 *   node scripts/import-bench.mjs            # newest run under bench/results
 *   node scripts/import-bench.mjs --merge <dir>
 *
 * --merge adds a partial run (say `--framework vike`) on top of the newest
 * imported run instead of replacing it. Each target in the new run (framework
 * × branch × host × path) replaces the same target; every other target is kept
 * with its own `measuredAt`. The result is written to the new run's date, so
 * the site keeps showing every framework. Older files stay as history.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT, "content/benchmarks");

function newestRun() {
  const root = join(PROJECT, "bench/results");
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root).filter((d) => existsSync(join(root, d, "results.json"))).sort();
  return dirs.length ? join(root, dirs.at(-1)) : null;
}

const argv = process.argv.slice(2);
const merge = argv.includes("--merge");
const given = argv.find((a) => !a.startsWith("--"));
const arg = given ? resolve(given) : newestRun();
if (!arg) {
  console.error("import-bench: no results given and none under bench/results");
  process.exit(1);
}
const file = statSync(arg).isDirectory() ? join(arg, "results.json") : arg;
const { meta, targets } = JSON.parse(readFileSync(file, "utf8"));

const capability = JSON.parse(readFileSync(join(PROJECT, "src/data/generated/capability.json"), "utf8"));
const byApp = new Map(capability.frameworks.filter((f) => f.app).map((f) => [f.app, f.id]));

const round = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const out = {
  startedAt: meta.startedAt,
  finishedAt: meta.finishedAt,
  tool: "PageSpeed Insights v5 (Lighthouse lab run)",
  strategy: meta.args.strategy,
  runsPerTarget: meta.args.runs,
  psiRequests: meta.psiRequests,
  aborted: Boolean(meta.aborted),
  targets: targets
    .map((t) => {
      const frameworkId = t.frameworkId ?? byApp.get(t.app);
      if (!frameworkId) {
        console.warn(`import-bench: skipping ${t.id}: app "${t.app}" is not a framework on the site`);
        return null;
      }
      const m = t.median;
      return {
        frameworkId,
        app: t.app,
        branch: t.branch,
        host: t.host,
        path: t.path,
        url: t.url,
        median: m
          ? {
              perf: m.perf,
              fcp: round(m.fcp),
              lcp: round(m.lcp),
              tbt: round(m.tbt),
              si: round(m.si),
              tti: round(m.tti),
              cls: round(m.cls, 3),
              doc: round(m.doc),
              // Unthrottled paint times from the same trace; absent in runs before 2026-11-26.
              ...(m.fcpObs != null ? { fcpObs: round(m.fcpObs) } : {}),
              ...(m.lcpObs != null ? { lcpObs: round(m.lcpObs) } : {}),
            }
          : null,
        // CrUX p75 for this URL, only when PSI had page-level field data (no origin fallback).
        ...(t.field && Object.values(t.field).some((v) => v != null)
          ? {
              field: {
                lcp: round(t.field.lcp),
                inp: round(t.field.inp),
                cls: round(t.field.cls, 3),
                fcp: round(t.field.fcp),
                ttfb: round(t.field.ttfb),
              },
            }
          : {}),
        measuredAt: meta.startedAt,
        runs: t.runs.length,
        usedRuns: t.runs.filter((r) => !r.cold).length,
        coldSuspect: Boolean(t.coldSuspect),
        error: t.error ?? null,
      };
    })
    .filter(Boolean),
};

mkdirSync(OUT_DIR, { recursive: true });
const dest = join(OUT_DIR, `${out.startedAt.slice(0, 10)}.json`);
// Merge base: this date's file if there is one, else the newest earlier run.
const destName = `${out.startedAt.slice(0, 10)}.json`;
const base = existsSync(dest)
  ? dest
  : readdirSync(OUT_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f < destName).sort().map((f) => join(OUT_DIR, f)).at(-1);
if (merge && out.targets.length === 0) {
  console.error("import-bench: --merge given a run with no targets; nothing to merge");
  process.exit(1);
}
if (merge && base) {
  const prev = JSON.parse(readFileSync(base, "utf8"));
  const key = (t) => `${t.frameworkId}|${t.branch}|${t.host}|${t.path}`;
  const keys = new Set(out.targets.map(key));
  const ids = new Set(out.targets.map((t) => t.frameworkId));
  const kept = prev.targets.filter((t) => !keys.has(key(t))).map((t) => ({ ...t, measuredAt: t.measuredAt ?? prev.startedAt }));
  out.targets = [...kept, ...out.targets];
  out.startedAt = prev.startedAt < out.startedAt ? prev.startedAt : out.startedAt;
  out.finishedAt = prev.finishedAt > out.finishedAt ? prev.finishedAt : out.finishedAt;
  out.psiRequests = (prev.psiRequests ?? 0) + (out.psiRequests ?? 0);
  out.aborted = Boolean(prev.aborted) || out.aborted;
  console.log(`import-bench: merged ${[...ids].join(", ")} (${keys.size} targets) onto ${base}`);
}
writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
const ok = out.targets.filter((t) => t.median).length;
console.log(`import-bench: ${ok}/${out.targets.length} targets with data → ${dest}`);

// Rebuild src/data/generated/benchmark.json so the site picks the run up.
const { execFileSync } = await import("node:child_process");
execFileSync(process.execPath, [join(PROJECT, "scripts/build-bench-data.mjs")], { stdio: "inherit" });
