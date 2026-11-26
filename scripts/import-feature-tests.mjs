#!/usr/bin/env node
/**
 * Copies each port's feature-test results into content/feature-tests/<frameworkId>.json.
 *
 *   node scripts/import-feature-tests.mjs                       # ports under ../_ft/<app>
 *   FEATURE_TESTS_DIR=/path/to/ports node scripts/import-feature-tests.mjs
 *
 * Each port keeps its tests on the `feature-tests` branch: `feature-tests/results.json`
 * plus one Playwright spec per feature. The script reads the committed results
 * (`git show <commit>:feature-tests/results.json`), so a dirty working tree is ignored.
 * It never writes to the port checkouts.
 *
 * Output per framework (see FeatureTestFile in src/data/types.ts):
 *   frameworkId, repo, branch, commit (code that was tested), resultsCommit
 *   (commit holding results.json and the specs), testedAt,
 *   features: { <featureId>: { status, evidence, method, claimedLabel, suggestedLabel, testRoute, spec } }
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "..");
const PORTS_DIR = resolve(process.env.FEATURE_TESTS_DIR ?? resolve(PROJECT, "../_ft"));
const OUT_DIR = resolve(PROJECT, "content/feature-tests");
const BRANCH = "feature-tests";
const OWNER = "MaxwellCohen";

/** Port repo → site framework id. Same map as APPS in build-data.mjs. */
const APPS = {
  "next-books": "next",
  "nuxt-books": "nuxt",
  "svelte-books": "sveltekit",
  "solid-books": "solidstart",
  "tanstack-books": "tanstack-start-react",
  "tanstack-solid-books": "tanstack-start-solid",
  "pracht-books": "pracht",
  "waku-books": "waku",
  "ember-books": "ember",
  "astro-books": "astro",
  "react-router-books": "react-router",
  "qwik-books": "qwik-city",
  "angular-books": "angular",
  "marko-books": "marko",
  "fresh-books": "fresh",
  "vike-books": "vike",
  "analog-books": "analog",
  "redwoodsdk-books": "redwoodsdk",
};
const FEATURES = [
  "css-inlining",
  "font-optimization",
  "image-pipeline",
  "caching",
  "route-prefetching",
  "islands",
  "render-modes",
  "reactivity",
  "bundle-analysis",
  "third-party-scripts",
  "multi-host-deployment",
];
const LABELS = new Set(["first-party", "experimental", "third-party", "manual"]);
const STATUSES = new Set(["pass", "fail", "n/a"]);

const problems = [];
const git = (dir, ...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();
/** Plain text for the site: no markdown code spans. */
const plain = (s) => (s == null ? null : String(s).replace(/`/g, "").replace(/\s+/g, " ").trim());

mkdirSync(OUT_DIR, { recursive: true });
const summary = [];

for (const [app, frameworkId] of Object.entries(APPS)) {
  const dir = resolve(PORTS_DIR, app);
  if (!existsSync(dir)) {
    problems.push(`${app}: no checkout at ${dir}`);
    continue;
  }
  let resultsCommit;
  let raw;
  try {
    resultsCommit = git(dir, "log", "-1", "--format=%H", BRANCH, "--", "feature-tests/results.json");
    raw = JSON.parse(git(dir, "show", `${resultsCommit}:feature-tests/results.json`));
  } catch (err) {
    problems.push(`${app}: cannot read committed feature-tests/results.json on ${BRANCH}: ${err.message.split("\n")[0]}`);
    continue;
  }
  if (raw.repo !== app) problems.push(`${app}: results.json says repo "${raw.repo}"`);

  const features = {};
  for (const featureId of FEATURES) {
    const r = raw.results?.[featureId];
    if (!r) {
      problems.push(`${app}: no result for "${featureId}"`);
      continue;
    }
    // The port brief's "blocked" (could not implement as labelled) shows as n/a.
    const status = r.status === "blocked" ? "n/a" : r.status;
    if (!STATUSES.has(status)) problems.push(`${app} ${featureId}: unknown status "${r.status}"`);
    if (r.suggestedLabel && !LABELS.has(r.suggestedLabel)) problems.push(`${app} ${featureId}: unknown suggestedLabel "${r.suggestedLabel}"`);

    // The route the spec opens in the port, if any (bundle analysis and multi-host check build output instead).
    let testRoute = null;
    if (r.test) {
      try {
        const spec = git(dir, "show", `${resultsCommit}:${r.test}`);
        const m = spec.match(/['"`](\/feature-tests\/[\w/-]*)['"`]/);
        testRoute = m ? m[1] : null;
      } catch {
        problems.push(`${app} ${featureId}: spec ${r.test} not in ${resultsCommit.slice(0, 7)}`);
      }
    }

    const evidence = [plain(r.evidence), plain(r.note)].filter(Boolean).join(" Note: ");
    features[featureId] = {
      status,
      evidence,
      method: plain(r.method),
      claimedLabel: LABELS.has(r.claimedLabel) ? r.claimedLabel : null,
      suggestedLabel: r.suggestedLabel ?? null,
      testRoute,
      spec: r.test ?? null,
    };
  }
  for (const k of Object.keys(raw.results ?? {})) {
    if (!FEATURES.includes(k)) problems.push(`${app}: unknown feature "${k}" in results.json`);
  }

  const out = {
    frameworkId,
    repo: `${OWNER}/${app}`,
    branch: BRANCH,
    commit: raw.commit,
    resultsCommit,
    testedAt: raw.ranAt,
    features,
  };
  writeFileSync(resolve(OUT_DIR, `${frameworkId}.json`), `${JSON.stringify(out, null, 2)}\n`);
  const statuses = Object.values(features).map((f) => f.status);
  summary.push(
    `  ${frameworkId.padEnd(22)} ${statuses.filter((s) => s === "pass").length} pass, ${statuses.filter((s) => s === "fail").length} fail  (${resultsCommit.slice(0, 7)})`,
  );
}

if (problems.length) {
  console.error(`import-feature-tests: ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`import-feature-tests: ${summary.length} ports from ${PORTS_DIR}\n${summary.join("\n")}\n  wrote ${OUT_DIR}`);
