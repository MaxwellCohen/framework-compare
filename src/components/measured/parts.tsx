import type { ComponentChildren } from "preact";
import type { Host } from "../../data/types.ts";
import { Container } from "../Page.tsx";
import { NavLink } from "../links.tsx";
import { MarkerKey } from "./LaneChart.tsx";

/** Shared FCP scale for every chart on the page: the bands run 0.9–2.8 s. */
export const FCP_DOMAIN: [number, number] = [0.7, 2.9];
export const FCP_TICKS = [1, 1.5, 2, 2.5];

export const HOSTS: { id: Host; label: string; series: 1 | 2 | 3 }[] = [
  { id: "vercel", label: "Vercel", series: 1 },
  { id: "netlify", label: "Netlify", series: 2 },
  { id: "cloudflare", label: "Cloudflare", series: 3 },
];


/** Sections below the sticky jump nav need this so anchors land clear of it. */
export const ANCHOR = "scroll-mt-14";

/** Sticky on-page navigation: plain anchors, one scrollable line on phones. */
export function JumpNav({
  items,
  route = "measured",
}: {
  items: { hash: string; label: string }[];
  /** The page the anchors are on. */
  route?: "measured" | "benchmark";
}) {
  return (
    <nav aria-label="On this page" class="sticky top-0 z-20 border-b border-rule-strong bg-paper">
      <Container>
        <ul class="flex items-center gap-x-5 overflow-x-auto py-2.5 text-sm whitespace-nowrap">
          <li class="eyebrow max-sm:hidden" aria-hidden="true">
            On this page
          </li>
          {items.map((item) => (
            <li key={item.hash}>
              <NavLink to={{ route, hash: item.hash }} class="link">
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
export function RunLegend({
  builds,
  hosts = true,
  bands = true,
}: {
  builds?: { hollow: string; filled: string };
  hosts?: boolean;
  bands?: boolean;
}) {
  const item = "flex items-center gap-1.5";
  return (
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Chart key">
      {hosts &&
        HOSTS.map((h) => (
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


/** A sub-heading inside a section, with an anchor. */
export function SubHeading({ id, kicker, children }: { id?: string; kicker?: ComponentChildren; children: ComponentChildren }) {
  return (
    <h3 id={id} class={`font-display text-lg text-ink text-balance ${ANCHOR}`}>
      {kicker && <span class="num mr-3 align-middle text-sm text-ink-3">{kicker}</span>}
      {children}
    </h3>
  );
}
