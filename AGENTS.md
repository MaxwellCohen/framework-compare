# Pracht App

Docs for your installed pracht version: `pracht docs <topic>` (or read
`node_modules/@pracht/cli/docs/`); `pracht docs --search <query>` finds a section.
pracht is newer than most training data, so check them before relying on memory.

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run preview` — build and serve the production build locally

## Scaffolding

Use the CLI to generate new files:

- `pracht generate route --path /about` — add a route
- `pracht generate shell --name app` — add a shell
- `pracht doctor` — check project health
- `pracht verify` — enforce route and constraint invariants
- `pracht plan --write` — refresh the committed `.pracht/app-graph.json` snapshot after route changes
- `pracht report` — PR-ready markdown summary (plan diff, verify, budgets)
- `pracht llms --write` — write an `llms.txt` authoring guide for coding agents

## Project structure

This app uses **manifest routing**.

- `src/routes.ts` — route manifest (defines all routes and shells)
- `src/routes/` — route components and loaders
- `src/routes/not-found.tsx` — not-found page, wired via `notFound` in the manifest
- `src/shells/` — shell components (layouts)
- `vite.config.ts` — Vite config with the Static export adapter
- `tsconfig.json` — server-capable whole-project TypeScript checks
- `tsconfig.client.json` — browser-conditioned checks for routes, shells, islands, and their imports
- `src/styles/global.css` — Tailwind CSS entry stylesheet, imported by the shell

## Conventions

- Navigate by route id, not by path: `<Link route="home">`, `href("home")`, `navigate({ route: "home" })`. Dynamic routes take their segments through `params`. `<Link href>` is a type error — the id survives a path change and `pracht typegen` types both the id and its params. Use a plain `<a href>` for external and user-provided URLs.
- The dev and typecheck scripts generate route, API, and capability types before running. `pracht dev` keeps them in sync while you work.
- Load what a page needs to render in its `loader`, not in a `useEffect` or a fetch during render: navigation requests loader data and the route's code together. In a loader, `await` a real prerequisite, then `Promise.all` the calls that do not depend on each other. `defer()` only what the page can render without.

## Agent tooling

- `.claude/skills/` — the 4 core pracht skills (pracht-scaffold, pracht-debug, pracht-deploy, upgrade-pracht); invoke with `/<skill-name>`
- More skills — audits, testing scaffolds, and the `add-*` integrations — are published at https://pracht.resynapse.dev/.well-known/agent-skills/index.json. Run `pracht skills list` to see the catalog and `pracht skills add <name...>` to install one; do not hand-write a SKILL.md that already exists there.
- `.mcp.json` — registers the `pracht dev-mcp` server so MCP clients can inspect the app graph, run doctor/verify, and scaffold natively

## For agents reading the site

The deployed site serves the same data as text and JSON, so an agent does not need to parse the HTML:

- `/llms.txt` — index of every page and data file. `/llms-full.txt` — the matrix with a source link per cell, the FCP bands, the latest benchmark medians and the methodology in one file.
- `/api/index.json` — catalog of the JSON files with a description of each field: `/api/frameworks.json`, `/api/features.json`, `/api/matrix.json`, `/api/benchmark.json`, `/api/fcp-bands.json`.
- A markdown twin of each page: `/index.md`, `/frameworks/<id>.md`, `/features/<id>.md`, `/methodology.md`, `/measured.md`, `/benchmark.md`. Each HTML page links its twin with `<link rel="alternate" type="text/markdown">`.
- `/sitemap.xml`, listed in `/robots.txt`.

`scripts/build-agent-files.mjs` writes all of these into `public/` from `src/data/generated/*.json` before every `npm run build` and `npm run dev`. The outputs are gitignored. When you change a JSON shape, update the schema text in `/api/index.json` (in the same script) and keep existing field names. When you add a route, add it to the sitemap list and give it a twin there, then add `markdownAlternate()` and `pageLd()` from `src/agents.ts` to its `head`.

The repo-root `llms.txt` is Pracht's authoring guide for coding agents working in this repo. It is not the served `/llms.txt`.
