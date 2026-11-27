#!/usr/bin/env node
/**
 * `npm run bench [-- <cwv-bench options>]`: runs bench/cwv-bench.mjs with the
 * given options, then imports the run. A narrowed run (--framework, --filter,
 * --hosts or --paths) is imported with --merge, so it updates only the targets
 * it measured and every other framework keeps its results.
 *
 *   npm run bench                          # every framework
 *   npm run bench -- --framework solidstart     # just Solid, merged into the latest run
 *   npm run bench -- --framework solidstart --dry-run
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = (flag) => args.some((a) => a === `--${flag}` || a.startsWith(`--${flag}=`));
const node = (script, argv) => spawnSync(process.execPath, [join(PROJECT, script), ...argv], { stdio: "inherit" }).status ?? 1;

const runs = () => {
  const root = join(PROJECT, "bench/results");
  return existsSync(root) ? readdirSync(root).filter((d) => existsSync(join(root, d, "results.json"))) : [];
};
const before = new Set(runs());

const code = node("bench/cwv-bench.mjs", args);
if (has("help") || has("dry-run") || has("limits")) process.exit(code);
// Exit code 2: the daily PSI quota ran out or the run was interrupted; the partial results are still imported.
if (code !== 0 && code !== 2) process.exit(code);

const fresh = runs().filter((d) => !before.has(d)).sort().at(-1);
if (!fresh) {
  console.error("run-bench: the bench wrote no results; nothing to import");
  process.exit(1);
}
const narrowed = ["framework", "filter", "hosts", "paths"].some(has);
process.exit(node("scripts/import-bench.mjs", [...(narrowed ? ["--merge"] : []), join(PROJECT, "bench/results", fresh)]) || code);
