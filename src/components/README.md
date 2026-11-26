# Component kit

Import from the barrel: `import { PageHeader, Section, CapabilityMatrix } from "../components/index.ts";`
Every component is server-rendered Preact with typed props and a doc comment at its definition.
`src/routes/home.tsx` (temporary kitchen-sink) shows each one with sample props.

## Rules of the road

- **Width.** The shell does not constrain width. Start a page with `PageHeader`, then `Section`s (both include a `Container`). Use `Container` directly for anything else.
- **Links.** Internal links go through `NavLink to={Target}` (typed route ids, never paths). External links use `ExternalLink`.
  `Target` = `{ route: "home" | "compare" | "measured" | "benchmark" | "methodology"; hash? }` | `{ route: "feature"; id: FeatureId; hash? }` | `{ route: "framework"; id: FrameworkId; hash? }`.
- **Anchors other components link to.** The header nav links to `/#matrix` and `/#ranking`: the home page must render `<Section id="matrix">` and `<Section id="ranking">`. `CapabilityMatrix` cells link to the feature page at `#<frameworkId>`: feature pages must put `id={framework.id}` on each framework's how-to block (e.g. `<Card id={fw.id}>`).
- **Colour.** Tier colours (`first`, `experimental`, `third`, `manual`) are only for capability labels, via `LabelBadge`. Everything else is ink on paper. Tailwind's default palette is removed; `bg-red-500` does not exist.
- **Numbers** are set in mono with tabular figures: add class `num`.
- **Data.** Components take plain props typed against `src/data/types.ts`; none of them imports data.

## Interactivity (hydration)

Every route is `hydration: "islands"` (`src/routes.ts`). A page that renders no island ships **no framework JavaScript**; navigation is a normal document load, with speculation-rules prefetch and cross-document view transitions.

The theme toggle and the mobile menu are not islands. One inline script in the shell head (`THEME_SCRIPT` in `Site.tsx`) sets `<html data-theme>` before paint and handles clicks on any `[data-theme-toggle]` element by delegation.

To add an interactive component:

1. Create it in `src/islands/` (default or named export), typed `Props & IslandProps` (`import type { IslandProps } from "@pracht/core"`). Use `preact/hooks` as usual.
2. Import and render it from a route or component: `<FrameworkPicker frameworks={list} client="idle" />`.
   `client`: `"load"` (default, modulepreloaded), `"idle"`, or `"visible"`.
3. Props must be JSON-serializable (strings, numbers, booleans, null, arrays, plain objects). No functions, no JSX in props. Server-rendered content can be passed as `children`.
4. Kit components that render `NavLink` (`CapabilityMatrix`, `Card to=`, `FrameworkName`, chips with `link`) and `SiteHeader` must NOT be rendered inside an island: Pracht's `<Link>` throws on hydration outside a route tree. Inside an island use plain `<a href>` built with the typed `href()` from `src/pracht-routes.ts` (see `src/islands/CompareView.tsx`). Keep islands small: pass only the fields the island needs, not whole `Framework` objects with HTML.

Cost, measured on this build: the first island on a page adds about 8.2 kB gzip of shared runtime (Preact vendor 5.9 + islands bootstrap 1.4 + preload helper 0.9) plus the island's own chunk. Pages without islands stay at zero.

Prefer no JavaScript where the platform does the job: `<details>` for disclosure, `:target` / anchors for jump links, a `<form method="get">` plus a static page per choice for pickers. Do not turn on `islandsNavigation` without a reason: it makes every page load the bootstrap.

## Components

### Links (`links.tsx`)
- `NavLink` `{ to: Target, class?, title?, id?, aria-label?, aria-current?, children }` — any internal link.
- `ExternalLink` `{ href, children, class?, bare? }` — off-site link with the ↗ marker; `bare` drops the underline style (marker stays).
- CSS: `.link` (inline text link), `.ext` (adds the external marker). Links to `http…` inside `Prose` get the marker automatically.

### Capability labels (`LabelBadge.tsx`)
- `LabelBadge` `{ label: Label, size?: "cell" | "sm" | "full", showPoints?, class? }` — the label mark. `cell` = glyph only on a tinted square (matrix cells; accessible name included); `sm` = glyph + text; `full` = glyph + text + points. Each tier has its own glyph shape, so it reads without colour.
- `LabelLegend` `{ detailed?, class? }` — the four labels with points; `detailed` adds one-line definitions. Put one next to every matrix.
- `LabelGlyph` `{ label }` — the bare glyph (inherits `--tier` colour).
- `LABELS` (text, short, points, description per label), `LABEL_ORDER`.

### Scores (`Score.tsx`)
- `ScoreBar` `{ fcp, other, fcpMax? = 10, otherMax? = 12 } | { value, max }` + `{ size?: "sm" | "md", showValue?, class? }` — unit-segmented bar; the two-part form shows first-paint and other points side by side. For ranking rows and framework headers.
- `ScoreMeter` `{ value, max, percent?, class? }` — compact mono "18/22"; `percent` appends completeness. For table cells and chips.
- `RankBadge` `{ rank, tied?, size?: "sm" | "md", class? }` — "#3" / "=3" square.
- `Stat` `{ label, value, unit?, hint?, class? }` — one headline figure. Wrap several in `StatGroup` `{ cols?: 2 | 3 | 4 | 5 }`.

### Matrix (`Matrix.tsx`)
- `CapabilityMatrix` `{ frameworks, features, cells, label?, grouped? = true, totals? = true, vertical?, class? }` — features × frameworks, one linked `LabelBadge` per cell. Takes any subset (all of them on home, 2–4 on compare). Needs only `id/name/shortName/fcpScore/otherScore/total` of a framework, `id/number/name/shortName/group` of a feature, `frameworkId/featureId/label/points` of a cell. Column headers go vertical above 6 frameworks.
- Primitives for other tables (ranking, measured runs): `Matrix` `{ label, scrollHint? = true, class? }` > `MatrixHead` `{ corner? }` > `MatrixColHeader` `{ to?, vertical?, title? }`; `<tbody>`/`<tfoot>` > `MatrixRow` > `MatrixRowHeader` `{ to? }` + `MatrixCell` `{ to?, label?, class? }`; `MatrixGroupRow` `{ span, aside? }` for a divider row.
- Behaviour is CSS only: sticky header row and first column, row and column highlight on hover/focus (up to 17 columns), own scroll container (max height = viewport), right-edge fade and a text hint while columns are off-screen. Do not wrap it in another `overflow` container.

### Page scaffolding (`Page.tsx`)
- `Container` `{ width?: "page" | "prose", class? }` — gutters + max width (82rem; `prose` = 44rem measure, left-aligned).
- `PageHeader` `{ title, eyebrow?, breadcrumbs?, lede?, meta?, aside? }` — the `<h1>` block; one per page. `meta` = row of tags/badges, `aside` = right column (a `StatGroup`).
- `Breadcrumbs` `{ items: { label, to? }[] }` — last item is the current page. Usually passed via `PageHeader breadcrumbs`.
- `Section` `{ id?, title?, index?, intro?, actions?, width?, class?, children }` — `<section>` with an `<h2>`; `index` is the mono counter ("01"); `actions` sits right of the title (a legend, a link).
- `Card` `{ title?, to?, aside?, flush?, as?: "div" | "article" | "section" | "li", id?, class? }` — bordered surface with optional header strip (`<h3>`); `flush` for tables or `StatGroup` that touch the border.
- `Callout` `{ kind?: "note" | "caveat", title?, class? }` — `caveat` for limits on what the data means (docs, not measurements); `note` for neutral remarks.
- `Tag` `{ tone?: "outline" | "solid" | "quiet", class? }` — neutral mono tag for metadata (group, build kind, host, version). Never tier-coloured.
- `Pager` `{ prev?, next?: { label, kicker?, to } }` — previous/next at the foot of feature and framework pages.

### Chips (`Chips.tsx`)
- `FrameworkName` `{ framework: { id, name, shortName }, short?, link? = true, class? }` — the name as a typed link.
- `FrameworkChip` `{ framework, rank?, tied?, score?, max? = 22, short?, link?, class? }` — bordered chip with optional rank and score.
- `FeatureName` `{ feature: { id, number, name, shortName }, short?, link? = true, class? }` — "01 CSS inlining" as a typed link.
- `FeatureChip` `{ feature, label?, short?, link?, class? }` — bordered chip; `label` adds the cell glyph for that framework.
- `featureNo(n)` — zero-padded feature number.

### Prose (`Prose.tsx`)
- `Prose` `{ html, size?: "sm" | "md", as?: "div" | "article" | "section", class? }` — renders trusted pre-rendered HTML (`*Html` fields) with full typography: headings, lists, links, inline code, blockquotes, tables (wrapped for horizontal scroll), `<pre>` (scrolls, never wraps). Shiki dual-theme output (`--shiki-light` / `--shiki-dark`, `defaultColor: false`) follows the theme switch. A paragraph that is only `<em>…</em>` directly after a code block is styled as its caption. `size="sm"` for cards and callouts. Width is the parent's: put it in `Section width="prose"` or a `max-w-prose` box.

### Charts (`Chart.tsx`)
- `DotChart` `{ rows: { key, label, values?, range? }[], series?: { id, label }[], domain: [min, max], ticks?, unit? = "s", digits? = 1, bands?, title?, caption? }` — one row per item, one marker per series (max 3; shape and colour differ), e.g. FCP seconds per host. A row with `range: { min, max }` draws a span instead (FCP bands 0.9–2.8 s). `bands` shades reference ranges behind all rows.
- `BarChart` `{ rows: { key, label, value }[], max, ticks?, unit?, digits?, title?, caption? }` — zero-based bars for one measure (average Lighthouse score, average FCP).
- Both print every value as text beside the plot, so no separate table is needed. `null` values print "—". CSS only.

### Site chrome (`Site.tsx`) — used by the shell, not by pages
- `SiteHeader`, `SiteFooter`, `ThemeToggle` `{ class? }`, `REPO_URL`.

## Tokens (`src/styles/global.css`, Tailwind 4 `@theme`)

Every colour is a `light-dark()` pair and follows the theme; there are no `dark:` variants to write.

- **Surfaces:** `paper` (page), `surface` (cards, table header), `sunken` (code, wells).
- **Text:** `ink` (primary), `ink-2` (secondary), `ink-3` (muted; still AA on all three surfaces).
- **Lines:** `rule` (hairline), `rule-strong` (frames).
- **Accent:** `accent` — link underline and focus ring only.
- **Tiers:** `first`, `experimental`, `third`, `manual`, each with a `-bg`. Or use class `tier-<label>`, which sets `--tier` and `--tier-bg`.
- **Chart series:** `series-1`, `series-2`, `series-3` (marks only, never text).
- Use as utilities: `bg-surface`, `text-ink-2`, `border-rule-strong`, …
- **Type:** `font-display` (Newsreader 500: h1, h2, big figures), `font-sans` (IBM Plex Sans 400/600: default), `font-mono` (IBM Plex Mono 400/600: numbers, tags, code).
  Sizes `text-2xs` 11, `xs` 12, `sm` 13, `base` 15, `md` 17, `lg` 20, `xl` 24, `2xl` 30, `3xl` 38, `4xl` 48 (px at default root size).
- **Radius:** `rounded-xs` 2px, `rounded-sm` 3px, `rounded-md` 5px. Nothing rounder.
- **Widths:** `max-w-page` 82rem, `max-w-prose` 44rem. Spacing is Tailwind's default 0.25rem scale.
- **Helper classes:** `num` (mono, tabular figures), `eyebrow` (mono uppercase micro-label), `link`, `ext`.
- **Fonts** are declared in `src/styles/fonts.ts` with `defineFont()` and loaded by the shell; to add a weight, add it there (with `preload: false` unless it is above the fold on most pages).
