import type { ComponentChildren } from "preact";
import { NavLink, type Target } from "./links.tsx";

/**
 * Page-width wrapper with the site gutters. The shell does NOT constrain width,
 * so every page starts with `<Container>` (or `PageHeader` / `Section`, which
 * include one). `width="prose"` gives the 44rem reading measure, left-aligned
 * to the same page edge as full-width sections.
 */
export function Container({
  children,
  width = "page",
  class: cls = "",
}: {
  children: ComponentChildren;
  width?: "page" | "prose";
  class?: string;
}) {
  return (
    <div class={`mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8 ${cls}`}>
      {width === "prose" ? <div class="max-w-prose">{children}</div> : children}
    </div>
  );
}

/**
 * Trail above the page title. The last item is the current page (no `to`).
 *   <Breadcrumbs items={[{ label: "Matrix", to: { route: "home" } }, { label: "CSS inlining" }]} />
 */
export function Breadcrumbs({ items }: { items: { label: string; to?: Target }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol class="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((item, i) => (
          <li key={item.label} class="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden="true" class="text-rule-strong">
                /
              </span>
            )}
            {item.to ? (
              <NavLink to={item.to} class="hover:text-ink underline decoration-rule-strong underline-offset-2">
                {item.label}
              </NavLink>
            ) : (
              <span aria-current="page" class="text-ink-2">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Top of every page: optional breadcrumbs or eyebrow, the `<h1>`, a lede, and an
 * optional `meta` row (badges, chips, stats) and `aside` (right column on wide screens).
 */
export function PageHeader({
  eyebrow,
  breadcrumbs,
  title,
  lede,
  meta,
  aside,
}: {
  /** Mono micro-label above the title, e.g. "Feature 01 · First-paint lever". */
  eyebrow?: ComponentChildren;
  breadcrumbs?: { label: string; to?: Target }[];
  title: ComponentChildren;
  /** One or two sentences. Plain text or inline nodes. */
  lede?: ComponentChildren;
  meta?: ComponentChildren;
  aside?: ComponentChildren;
}) {
  return (
    <header class="border-b border-rule">
      <Container class="pt-8 pb-7 sm:pt-12 sm:pb-9">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div class={`grid gap-6 lg:gap-12 ${aside ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end" : ""}`}>
          <div class="min-w-0">
            {eyebrow && <p class={`eyebrow ${breadcrumbs ? "mt-4" : ""}`}>{eyebrow}</p>}
            <h1
              class={`font-display text-3xl sm:text-4xl tracking-[-0.015em] text-balance text-ink ${
                eyebrow || breadcrumbs ? "mt-2" : ""
              }`}
            >
              {title}
            </h1>
            {lede && <p class="mt-4 max-w-prose text-md text-ink-2 text-pretty">{lede}</p>}
            {meta && <div class="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">{meta}</div>}
          </div>
          {aside && <div class="min-w-0">{aside}</div>}
        </div>
      </Container>
    </header>
  );
}

/**
 * A titled block of a page: `<section>` with an `<h2>`, optional mono index
 * ("01"), intro line, and right-aligned `actions`. `id` makes it an anchor target.
 * Includes its own `Container`; pass `width="prose"` for reading pages.
 */
export function Section({
  id,
  title,
  index,
  intro,
  actions,
  width = "page",
  children,
  class: cls = "",
}: {
  id?: string;
  title?: ComponentChildren;
  /** Mono counter shown before the title, e.g. "01". */
  index?: string;
  intro?: ComponentChildren;
  actions?: ComponentChildren;
  width?: "page" | "prose";
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <section id={id} aria-labelledby={id && title ? `${id}-title` : undefined} class={`py-8 sm:py-10 ${cls}`}>
      <Container width={width}>
        {title && (
          <div class="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div class="min-w-0">
              <h2 id={id ? `${id}-title` : undefined} class="font-display text-xl text-ink text-balance">
                {index && <span class="num mr-3 text-sm text-ink-3 align-middle">{index}</span>}
                {title}
              </h2>
              {intro && <p class="mt-1.5 max-w-prose text-ink-2">{intro}</p>}
            </div>
            {actions && <div class="flex flex-wrap items-center gap-3">{actions}</div>}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

/**
 * Bordered surface. `title` adds a header strip; `flush` removes body padding
 * (for a table or `StatGroup` that should touch the border); `to` makes the
 * title a link.
 */
export function Card({
  title,
  to,
  aside,
  flush = false,
  as: Tag = "div",
  id,
  children,
  class: cls = "",
}: {
  title?: ComponentChildren;
  to?: Target;
  /** Right side of the header strip: a badge, a score, a link. */
  aside?: ComponentChildren;
  flush?: boolean;
  as?: "div" | "article" | "section" | "li";
  id?: string;
  children: ComponentChildren;
  class?: string;
}) {
  return (
    <Tag id={id} class={`min-w-0 rounded-sm border border-rule-strong bg-surface ${cls}`}>
      {(title || aside) && (
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule px-4 py-2.5">
          <h3 class="min-w-0 font-semibold text-ink">
            {to ? (
              <NavLink to={to} class="link">
                {title}
              </NavLink>
            ) : (
              title
            )}
          </h3>
          {aside && <div class="flex items-center gap-3">{aside}</div>}
        </div>
      )}
      <div class={flush ? "" : "p-4"}>{children}</div>
    </Tag>
  );
}

/**
 * Aside for context the reader must not miss.
 * - `kind="note"`: neutral remark.
 * - `kind="caveat"`: a limit on what the data means ("not measured", "from docs,
 *   not tested"). Heavier rule and an explicit mono label.
 * Children are regular nodes; to show pre-rendered HTML put a `<Prose size="sm">` inside.
 */
export function Callout({
  kind = "note",
  title,
  children,
  class: cls = "",
}: {
  kind?: "note" | "caveat";
  /** Overrides the default label ("Note" / "Caveat"). */
  title?: string;
  children: ComponentChildren;
  class?: string;
}) {
  const caveat = kind === "caveat";
  return (
    <aside
      class={`border-l-[3px] bg-sunken px-4 py-3 text-ink-2 ${caveat ? "border-ink" : "border-rule-strong"} ${cls}`}
    >
      <p class={`eyebrow mb-1 flex items-center gap-1.5 ${caveat ? "text-ink font-semibold" : ""}`}>
        {caveat && (
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 1 11 10.5H1z" stroke-linejoin="round" />
            <path d="M6 4.6v2.9M6 8.6v.6" />
          </svg>
        )}
        {title ?? (caveat ? "Caveat" : "Note")}
      </p>
      <div class="text-base [&_a]:underline [&_a]:underline-offset-2 [&_p+p]:mt-2">{children}</div>
    </aside>
  );
}

/**
 * Small neutral mono tag for metadata that is not a capability label: group
 * ("first-paint lever"), build kind ("optimized"), version, host.
 * Never use tier colours here — those belong to `LabelBadge`.
 */
export function Tag({
  children,
  tone = "outline",
  class: cls = "",
}: {
  children: ComponentChildren;
  tone?: "outline" | "solid" | "quiet";
  class?: string;
}) {
  const tones = {
    outline: "border border-rule-strong text-ink-2",
    solid: "border border-ink bg-ink text-paper",
    quiet: "border border-transparent bg-sunken text-ink-2",
  };
  return (
    <span class={`num inline-flex items-center rounded-xs px-1.5 text-2xs leading-[1.125rem] whitespace-nowrap ${tones[tone]} ${cls}`}>
      {children}
    </span>
  );
}

/** Shown wherever a framework's port, deploy, benchmark or FCP data would go and it has no Books port. */
export const NO_PORT = "No Books port yet";

export function NoPortTag({ class: cls = "" }: { class?: string }) {
  return <Tag class={cls}>{NO_PORT}</Tag>;
}

/**
 * Previous / next links at the foot of a feature or framework page.
 *   <Pager prev={{ label: "Font optimization", kicker: "Feature 02", to: {...} }} next={...} />
 */
export function Pager({
  prev,
  next,
}: {
  prev?: { label: string; kicker?: string; to: Target };
  next?: { label: string; kicker?: string; to: Target };
}) {
  const item = (side: "prev" | "next", p: { label: string; kicker?: string; to: Target }) => (
    <NavLink
      to={p.to}
      class={`group flex flex-col gap-0.5 rounded-sm border border-rule-strong bg-surface px-4 py-3 hover:border-ink ${
        side === "next" ? "items-end text-right sm:col-start-2" : ""
      }`}
    >
      <span class="eyebrow">
        {side === "prev" ? "← " : ""}
        {p.kicker ?? (side === "prev" ? "Previous" : "Next")}
        {side === "next" ? " →" : ""}
      </span>
      <span class="font-display text-lg text-ink group-hover:underline underline-offset-4 decoration-1">{p.label}</span>
    </NavLink>
  );
  return (
    <nav aria-label="Previous and next" class="grid gap-3 sm:grid-cols-2">
      {prev && item("prev", prev)}
      {next && item("next", next)}
    </nav>
  );
}
