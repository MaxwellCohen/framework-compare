# Adding a framework

Use this checklist when the site gains a framework, or when a framework that is
already scored gets a Books port. Each step names the file to change and the
check that catches a missed step. Work top to bottom; later steps read the
output of earlier ones.

There are two cases:

- **A. New framework, scored from docs only.** Do part 1, then the build checks at the end of part 4.
- **B. A Books port for a framework.** This can be a framework that is already
  scored but has no port (the case for Analog, Vike, RedwoodSDK and Remix 3
  until they got ports in November 2026) or a new one. Do part 1 if it is new, then parts 2, 3 and 4.

The `books-demo` repo is the parent folder of this one (`../`). Part 1 edits its markdown
sources, part 2 creates a repo next to the other ports, and parts 3 and 4 run here.

## 1. Score it (books-demo `framework-feature-comparison.md`)

The comparison doc is where every label, score and how-to on the site comes
from. `scripts/build-data.mjs` parses it and refuses to write if it finds a gap.
The site is built from the doc on the books-demo branch
`docs/comparison-doc-revisions`, so edit it there and run the data script with
`BENCH_SOURCE_REF=docs/comparison-doc-revisions` (see README.md, Data).

A new framework goes in the **Additional frameworks** part of the doc:

- [ ] Add a column to both tables, "Critical-path levers (additional
      frameworks)" and "Other performance features (additional frameworks)",
      with a label for every row and the score row filled in.
- [ ] Add a `## <Name>` section after the last framework, before "Completeness
      score and ranking". Give it a `**Version:**` line, one
      `- **<Feature>** — <emoji> <Label>: …` bullet per table row with a docs
      link, and any "Unscored extras". Copy the shape of the `## Analog` section.
- [ ] Add it to the ranking table under "Completeness score and ranking" and to
      "Versions checked".
- [ ] Update the counts and lists in the "Additional frameworks" intro ("these
      ten frameworks", the list of frameworks with no Books port) and in the
      doc's opening summary.
- [ ] `scripts/build-data.mjs`: add it to `FRAMEWORKS` (source name → `id`,
      `shortName`). Add `port: false` until part 3 is done.
- [ ] `src/data/types.ts`: add the `id` to `FrameworkId`.
- [ ] `content/framework-links.json`: add its performance guide and issue
      tracker. The build fails without them.
- [ ] `content/manual-examples/<id>.md`: a sample for each **Manual** cell
      whose source has no code.
- [ ] `content/framework-gotchas.md`: add `### <id>` bullets under any feature
      where it behaves differently from the docs.
- [ ] Run `BENCH_SOURCE_REF=docs/comparison-doc-revisions npm run data`, then
      `npm run typecheck`. Fix every `problem` the data script prints; read
      every `warn`.

## 2. Build the port

The port is a copy of the same Books app (book list at `/`, detail at `/<id>`,
Postgres through `POSTGRES_URL`, the preview catalog when it is unset). Copy the
closest existing port so markup and styles match.

- [ ] New public repo `MaxwellCohen/<x>-books`, cloned to `books-demo/<x>-books`.
- [ ] Branch `main`: the baseline build. Framework defaults, no tuning.
- [ ] Branch `optimized`: the optimized build. Use the framework's own speed
      features (image, font, CSS inlining, caching, prerender, streaming,
      prefetch) before hand-written code. The site's point is to show what
      each framework gives you, so a hand-written helper is a last resort.
      List each change in `OPTIMIZATIONS.md` on that branch and mark it
      "framework feature" or "hand-written".
- [ ] Hosting config, adapted from `marko-books`: `vercel.json`,
      `netlify.toml`, `wrangler.jsonc` and a `deploy:cloudflare` script.
- [ ] Deploy both branches on all three hosts, with `POSTGRES_URL` set on each:

      | Build     | Vercel                         | Netlify                                | Cloudflare Workers                                   |
      | --------- | ------------------------------ | -------------------------------------- | ---------------------------------------------------- |
      | main      | `<x>-books.vercel.app`         | `<x>-books.netlify.app`                | `<x>-books.to-email-max.workers.dev`                 |
      | optimized | `<x>-books-optimized.vercel.app` | `<x>-books-max-optimized.netlify.app` | `<x>-books-optimized.to-email-max.workers.dev`       |

      Vercel and Netlify build from git. Cloudflare deploys with
      `pnpm deploy:cloudflare` from the branch.
- [ ] Open all six URLs. Each must show real books (not the preview catalog)
      and a working detail page, such as `/10145787`.
- [ ] Optional: a `feature-tests` branch that tests each label against the
      port (see `books-demo/_ft/BRIEF.md`).

## 3. Register the port here

- [ ] books-demo `README.md` deployments table: add one row per branch (App,
      Framework, Repo, Branch, Vercel, Netlify, Cloudflare, Notes). The
      first row has the repo link and the next row says `same`. This table is
      the only source of deploy URLs; the benchmark reads them from here.
      Make the change on `docs/comparison-doc-revisions` too (or merge it
      there): the data script reads all three markdown files from that ref.
- [ ] `scripts/build-data.mjs`: add `"<x>-books": "<id>"` to `APPS`, and
      remove `port: false` from its `FRAMEWORKS` entry.
- [ ] `scripts/import-feature-tests.mjs`: add the same line to its `APPS`.
- [ ] If the port uses branch names other than `main` / `optimized`, add them
      to `BRANCH_ORDER` and `BRANCH_NAMES` in `src/data/index.ts` (see the
      `next` entry), or the build shows the raw branch name.
- [ ] `content/optimizations.json`: one `{ label, feature, framework }` entry
      per change in the port's `OPTIMIZATIONS.md`. `framework: true` only for
      an API, config option or official package the framework ships. These
      become the chips under the Benchmark lead chart.
- [ ] Extra deployments that are not in the README table (another branch
      you want benchmarked) go in `bench/extra-sites.json`.
- [ ] In the comparison doc, take the framework out of the "no Books port yet"
      sentence in "Additional frameworks", and drop "No Books port yet." from
      its `**Version:**` line.
- [ ] Run the data script again. It fails when a framework without `port: false` has
      no README rows, or when one with `port: false` has them.

## 4. Measure it and check the site

- [ ] Benchmark the new port alone and import it:
      `npm run bench -- --framework <id>` (about 10 minutes; check the
      targets first with `--dry-run`). It merges the port onto the newest
      imported run and keeps every other framework's results. Importing a
      run by hand without `--merge` replaces the file, and the site would
      show only the new port. It then rebuilds
      `src/data/generated/benchmark.json`, which fails on a `frameworkId` it
      does not know. The next full run (`npm run bench`, or Monday's
      `.github/workflows/benchmark.yml`) picks the port up by itself.
- [ ] If the port has a `feature-tests` branch:
      `node scripts/import-feature-tests.mjs`, then the data script.
- [ ] `npm run typecheck`, `npm run build`, `npx pracht verify`.
- [ ] Check on `npm run preview`:
  - the home matrix and ranking show the framework, and the ranking count of
    frameworks without a port has dropped;
  - `/frameworks/<id>` lists the repo and the six deploys;
  - `/benchmark` has a row in the lead chart with its chips, and its builds
    appear in the tables;
  - `/measured` has a pair for it;
  - `/frameworks/<id>.md` and `/api/frameworks.json` include it.
- [ ] Commit the books-demo README and doc changes in books-demo, and the
      changes here in this repo. They are two repos with separate histories.
