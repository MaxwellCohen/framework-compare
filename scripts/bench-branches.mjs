/**
 * Shared by build-bench-data.mjs and import-bench.mjs.
 *
 * Every port now has two branches, `main` (baseline) and `optimized`. Older runs
 * measured two branches that are gone; their files stay as recorded and are mapped
 * onto the two-branch layout here:
 * - Nuxt `nuxt-books-optimized-max` targets are dropped. That branch was merged into
 *   `optimized`, and showing it as a third Nuxt build would list a branch that no
 *   longer exists; the run's own `optimized` targets stay.
 * - Next: a run with `naive` targets predates the swap, when `main` was the tuned
 *   build. There `naive` (the baseline) becomes `main` and `main` becomes `optimized`.
 */
export function normalizeBranches(run) {
  const legacyNext = run.targets.some((t) => t.frameworkId === "next" && t.branch === "naive");
  const NEXT_LEGACY = { naive: "main", main: "optimized" };
  const targets = run.targets
    .filter((t) => !(t.frameworkId === "nuxt" && t.branch === "nuxt-books-optimized-max"))
    .map((t) => (legacyNext && t.frameworkId === "next" && NEXT_LEGACY[t.branch] ? { ...t, branch: NEXT_LEGACY[t.branch] } : t));
  return { ...run, targets };
}
