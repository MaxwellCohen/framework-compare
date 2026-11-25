#!/usr/bin/env node
/**
 * Copies a bench run into the site: reads <dir>/results.json (or a results.json
 * path) written by bench/cwv-bench.mjs, keeps what the site shows, and writes
 * content/benchmarks/<YYYY-MM-DD>.json. It then rebuilds src/data/generated/benchmark.json.
 *
 *   node scripts/import-bench.mjs bench/results/20261125-150209
 *   node scripts/import-bench.mjs            # newest run under bench/results
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

const arg = process.argv[2] ? resolve(process.argv[2]) : newestRun();
if (!arg) {
  console.error("import-bench: no results given and none under bench/results");
  process.exit(1);
}
const file = statSync(arg).isDirectory() ? join(arg, "results.json") : arg;
const { meta, targets } = JSON.parse(readFileSync(file, "utf8"));

const capability = JSON.parse(readFileSync(join(PROJECT, "src/data/generated/capability.json"), "utf8"));
const byApp = new Map(capability.frameworks.map((f) => [f.app, f.id]));

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
          ? { perf: m.perf, fcp: round(m.fcp), lcp: round(m.lcp), tbt: round(m.tbt), si: round(m.si), cls: round(m.cls, 3), doc: round(m.doc) }
          : null,
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
writeFileSync(dest, JSON.stringify(out, null, 1) + "\n");
const ok = out.targets.filter((t) => t.median).length;
console.log(`import-bench: ${ok}/${out.targets.length} targets with data → ${dest}`);

// Rebuild src/data/generated/benchmark.json so the site picks the run up.
const { execFileSync } = await import("node:child_process");
execFileSync(process.execPath, [join(PROJECT, "scripts/build-bench-data.mjs")], { stdio: "inherit" });
