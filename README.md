# Framework Compare

A static reference site comparing web meta-frameworks on 12 performance features:
what each framework's documentation says it provides (1st-party, Experimental,
Third-party or Manual), the resulting capability scores and ranking, and the
Lighthouse FCP measurements from the
[books-demo](https://github.com/MaxwellCohen/books-demo) ports.

Built with [Pracht](https://pracht.resynapse.dev/) (Preact + Vite) as a fully
prerendered static export.

## Data

The site's content comes from three markdown files in the books-demo repo
(`framework-feature-comparison.md`, `fcp-groupings.md`, `README.md`).
`scripts/build-data.mjs` parses them into `src/data/generated/*.json`, which is
committed, so `npm run build` needs nothing outside this repo.

To regenerate, run from a books-demo checkout that has this repo inside it, or
point at the sources explicitly:

```bash
npm run data                                   # sources from ../
BENCH_SOURCE_DIR=/path/to/books-demo npm run data
BENCH_SOURCE_DIR=/path/to/books-demo BENCH_SOURCE_REF=docs/comparison-doc-revisions npm run data
```

`BENCH_SOURCE_REF` reads the files from a git ref without checking it out. The
committed data was generated from `docs/comparison-doc-revisions` (the
accuracy-reviewed comparison). The script validates structure, scores and links
and refuses to write on any mismatch.

## Benchmark

The Benchmark page shows our own lab measurements. `bench/cwv-bench.mjs` runs
PageSpeed Insights (mobile Lighthouse) against every deployment listed in
`capability.json`: each framework's builds on Vercel, Netlify and Cloudflare,
for `/` and `/10145787`. It does three measured runs per target and keeps the
median, after warming each target and discarding cold runs.

```bash
cp bench/.env.example bench/.env   # set PSI_API_KEY
npm run bench                      # run (about an hour), import, rebuild data
node bench/cwv-bench.mjs --help    # options: --filter, --hosts, --paths, --runs…
npm run bench:import [results-dir] # import a run made earlier
```

Runs are kept in `content/benchmarks/<date>.json`, and
`scripts/build-bench-data.mjs` builds `src/data/generated/benchmark.json` from
them (newest run shown, older ones kept as history). It does not need the
markdown sources.

`.github/workflows/benchmark.yml` does the same every Monday, or on demand
from the Actions tab, and commits the results, which redeploys the site. It
needs a `PSI_API_KEY` repository secret.

## Files for agents and crawlers

`scripts/build-agent-files.mjs` runs before `pracht build` and writes these into
`public/` from `src/data/generated/*.json`:

- `/llms.txt` and `/llms-full.txt` ([llmstxt.org](https://llmstxt.org) format);
- `/api/index.json`, a catalog that describes `/api/frameworks.json`,
  `/api/features.json`, `/api/matrix.json`, `/api/benchmark.json` and
  `/api/fcp-bands.json`;
- a markdown twin of each page (`/index.md`, `/frameworks/<id>.md`,
  `/features/<id>.md`, `/methodology.md`, `/measured.md`, `/benchmark.md`);
- `/sitemap.xml`.

The outputs are gitignored. Set `SITE_URL` to build them for another origin; the
default is the `url` in `src/data/site.json`. Each page's `head` links its twin
and carries JSON-LD (helpers in `src/agents.ts`).

## Commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `npm run preview`

`pracht build` writes the whole site to `dist/client`. Upload that directory to any static host — there is no server to run. Configure the host to serve `index.html` for directory URLs and to use `404.html` as its error document.

A static export runs no server, so API routes, middleware, and `ssr`/`isg` routes are build errors. Fetch live data from the browser instead, or switch to a serverful adapter.

## Files

- `src/routes.ts` defines your app manifest.
- `src/routes/home.tsx` is the first page.
- `src/routes/not-found.tsx` is the not-found page, wired via `notFound`.
- `tsconfig.json` — server-capable whole-project TypeScript checks.
- `tsconfig.client.json` — browser-conditioned checks for routes, shells, islands, and their imports.
- `src/styles/global.css` is the Tailwind CSS entry, imported by the shell.
- `.claude/skills/` and `.mcp.json` wire up the pracht Claude Code skills and MCP server.

## Skills

`.claude/skills/` holds the 4 core skills: `/pracht-scaffold`, `/pracht-debug`, `/pracht-deploy`, `/upgrade-pracht`.

The rest of the catalog — audits, testing scaffolds, and the `add-*` integrations — is published at [`/.well-known/agent-skills/index.json`](https://pracht.resynapse.dev/.well-known/agent-skills/index.json). Install what you need:

```bash
pracht skills list
pracht skills add audit-loaders add-db
```

## Navigating

Pracht navigates by route id, not by path: `<Link route="home">`, `href("home")`, `navigate({ route: "home" })`. Dynamic routes take their segments through `params`. The id survives a path change, and `pracht typegen` types both the id and its params — so `<Link href>` is a compile error. Use a plain `<a href>` for external and user-provided URLs.

## Checks

- The dev and typecheck scripts generate route, API, and capability types before running.
- `pracht verify` validates routes and constraints.
- `pracht plan --write` commits an app-graph snapshot to `.pracht/`; `pracht plan` diffs against it.
- `pracht report` prints a PR-ready summary of both.
