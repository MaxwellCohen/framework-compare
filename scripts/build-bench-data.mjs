#!/usr/bin/env node
/**
 * content/benchmarks/*.json (imported bench runs) → src/data/generated/benchmark.json.
 * Independent of the markdown sources, so it runs anywhere (CI included).
 * The newest run is shown in full; older runs are listed and kept for history.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const IN_DIR = join(PROJECT, "content/benchmarks");
const OUT = join(PROJECT, "src/data/generated/benchmark.json");

const capability = JSON.parse(readFileSync(join(PROJECT, "src/data/generated/capability.json"), "utf8"));
const fwIds = new Set(capability.frameworks.map((f) => f.id));

const files = existsSync(IN_DIR) ? readdirSync(IN_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];
const runs = files.map((f) => ({ file: f, ...JSON.parse(readFileSync(join(IN_DIR, f), "utf8")) }));

const METRICS = ["perf", "fcp", "lcp", "tbt", "si", "cls", "doc"];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r = (v, d = 0) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

/** Average of target medians across hosts, per framework × branch × path. */
function aggregate(run) {
  const groups = new Map();
  for (const t of run.targets) {
    if (!t.median) continue;
    const key = `${t.frameworkId}|${t.branch}|${t.path}`;
    if (!groups.has(key)) groups.set(key, { frameworkId: t.frameworkId, branch: t.branch, path: t.path, hosts: [], ms: [] });
    const g = groups.get(key);
    g.hosts.push(t.host);
    g.ms.push(t.median);
  }
  return [...groups.values()].map((g) => {
    const avg = {};
    for (const k of METRICS) avg[k] = r(mean(g.ms.map((m) => m[k]).filter((v) => v != null)), k === "cls" ? 3 : 0);
    return { frameworkId: g.frameworkId, branch: g.branch, path: g.path, hosts: g.hosts.sort(), ...avg };
  });
}

let latest = null;
if (runs.length) {
  const run = runs.at(-1);
  for (const t of run.targets) if (!fwIds.has(t.frameworkId)) throw new Error(`${run.file}: unknown framework "${t.frameworkId}"`);
  latest = {
    date: run.file.replace(/\.json$/, ""),
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    tool: run.tool,
    strategy: run.strategy,
    runsPerTarget: run.runsPerTarget,
    psiRequests: run.psiRequests,
    aborted: run.aborted,
    paths: [...new Set(run.targets.map((t) => t.path))],
    hosts: [...new Set(run.targets.map((t) => t.host))],
    targets: run.targets,
    builds: aggregate(run),
  };
}

const data = {
  latest,
  history: runs.map((run) => ({
    date: run.file.replace(/\.json$/, ""),
    targets: run.targets.length,
    withData: run.targets.filter((t) => t.median).length,
    builds: aggregate(run).map(({ frameworkId, branch, path, fcp, lcp, perf }) => ({ frameworkId, branch, path, fcp, lcp, perf })),
  })),
};
writeFileSync(OUT, JSON.stringify(data, null, 1) + "\n");
console.log(`build-bench-data: ${runs.length} run(s); latest ${latest?.date ?? "none"} → ${OUT}`);
