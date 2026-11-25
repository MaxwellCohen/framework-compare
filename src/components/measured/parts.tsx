import type { ComponentChildren } from "preact";
import type { BuildKind, Host } from "../../data/types.ts";
import { Container } from "../Page.tsx";
import { NavLink } from "../links.tsx";
import { MarkerKey } from "./LaneChart.tsx";

/** Shared FCP scale for every chart on the page: the bands run 0.9–2.8 s. */
export const FCP_DOMAIN: [number, number] = [0.8, 2.9];
export const FCP_TICKS = [1, 1.5, 2, 2.5];

export const HOSTS: { id: Host; label: string; series: 1 | 2 | 3 }[] = [
  { id: "vercel", label: "Vercel", series: 1 },
  { id: "netlify", label: "Netlify", series: 2 },
  { id: "cloudflare", label: "Cloudflare", series: 3 },
];

export const BUILD_TEXT: Record<BuildKind, string> = {
  baseline: "baseline",
  "basic-cache": "basic cache",
  optimized: "optimized",
  "max-optimized": "max optimized",
  cached: "cached",
};

/** Sections below the sticky jump nav need this so anchors land clear of it. */
export const ANCHOR = "scroll-mt-14";

/** Sticky on-page navigation: plain anchors, one scrollable line on phones. */
export function JumpNav({ items }: { items: { hash: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" class="sticky top-0 z-20 border-b border-rule-strong bg-paper">
      <Container>
        <ul class="flex items-center gap-x-5 overflow-x-auto py-2.5 text-sm whitespace-nowrap">
          <li class="eyebrow max-sm:hidden" aria-hidden="true">
            On this page
          </li>
          {items.map((item) => (
            <li key={item.hash}>
              <NavLink to={{ route: "measured", hash: item.hash }} class="link">
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Container>
    </nav>
  );
}

/** Legend for the run charts: host marker shapes, build fill, band shading. */
export function RunLegend({ builds, bands = true }: { builds?: { hollow: string; filled: string }; bands?: boolean }) {
  const item = "flex items-center gap-1.5";
  return (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      {HOSTS.map((h) => (
        <li key={h.id} class={item}>
          <MarkerKey series={h.series} />
          {h.label}
        </li>
      ))}
      {builds && (
        <>
          <li class={item}>
            <MarkerKey series={0} hollow />
            {builds.hollow}
          </li>
          <li class={item}>
            <MarkerKey series={0} />
            {builds.filled}
          </li>
        </>
      )}
      {bands && (
        <li class={item}>
          <span class="inline-block h-3 w-4 bg-ink/7 outline outline-1 outline-rule" aria-hidden="true" />
          FCP band
        </li>
      )}
    </ul>
  );
}

/** Renders a source row label, turning `backticked` spans into <code>. */
export function RowLabel({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <span class="text-ink">
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} class="num rounded-xs border border-rule bg-sunken px-1 text-xs">
            {p}
          </code>
        ) : (
          p
        ),
      )}
    </span>
  );
}

/** A sub-heading inside a section, with an anchor. */
export function SubHeading({ id, kicker, children }: { id?: string; kicker?: ComponentChildren; children: ComponentChildren }) {
  return (
    <h3 id={id} class={`font-display text-lg text-ink text-balance ${ANCHOR}`}>
      {kicker && <span class="num mr-3 align-middle text-sm text-ink-3">{kicker}</span>}
      {children}
    </h3>
  );
}
