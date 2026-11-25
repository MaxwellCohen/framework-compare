import { useLocation } from "@pracht/core";
import { ExternalLink, NavLink, type Target } from "./links.tsx";
import { LabelGlyph, LABEL_ORDER } from "./LabelBadge.tsx";

export const REPO_URL = "https://github.com/MaxwellCohen/books-demo";

/**
 * Inline head script (see shell `head()`): runs before first paint.
 *  - resolves the theme (localStorage "fb-theme", else the OS preference) and
 *    stamps <html data-theme>, so there is no flash and CSS has one hook;
 *  - handles clicks on any `[data-theme-toggle]` element (event delegation, so
 *    the toggle needs no hydration);
 *  - closes the mobile `<details data-nav>` menu after a same-page link.
 */
export const THEME_SCRIPT = `(function(){var d=document,r=d.documentElement,k="fb-theme",m=matchMedia("(prefers-color-scheme: dark)");function s(){try{return localStorage.getItem(k)}catch(e){}}function a(){var v=s();r.dataset.theme=v==="light"||v==="dark"?v:m.matches?"dark":"light"}a();m.addEventListener("change",a);addEventListener("pageshow",a);d.addEventListener("click",function(e){var t=e.target;if(!t||!t.closest)return;if(t.closest("[data-theme-toggle]")){var n=r.dataset.theme==="dark"?"light":"dark";try{localStorage.setItem(k,n)}catch(e){}r.dataset.theme=n;return}var l=t.closest("[data-nav] a");if(l)l.closest("[data-nav]").removeAttribute("open")})})()`;

interface NavItem {
  label: string;
  to: Target;
  /** Path prefix that marks this item as the current section. */
  match?: string;
}

const NAV: NavItem[] = [
  { label: "Matrix", to: { route: "home" }, match: "/" },
  { label: "Features", to: { route: "home", hash: "matrix" }, match: "/features" },
  { label: "Frameworks", to: { route: "home", hash: "ranking" }, match: "/frameworks" },
  { label: "Compare", to: { route: "compare" }, match: "/compare" },
  { label: "Measured", to: { route: "measured" }, match: "/measured" },
  { label: "Methodology", to: { route: "methodology" }, match: "/methodology" },
];

function isCurrent(item: NavItem, pathname: string) {
  if (!item.match) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return item.match === "/" ? path === "/" : path === item.match || path.startsWith(`${item.match}/`);
}

/**
 * Light/dark switch. A plain button: the click is handled by the delegated
 * listener in THEME_SCRIPT, so it works on every page without hydration.
 */
export function ThemeToggle({ class: cls = "" }: { class?: string }) {
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label="Switch between light and dark theme"
      title="Switch theme"
      class={`inline-flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-sm border border-rule-strong text-ink-2 hover:border-ink hover:text-ink ${cls}`}
    >
      <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
        <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5" />
        <path d="M8 2a6 6 0 0 1 0 12z" fill="currentColor" />
      </svg>
    </button>
  );
}

/** Site header: wordmark, primary nav (inline from `md`, a `<details>` menu below), theme toggle. */
export function SiteHeader() {
  const { pathname } = useLocation();
  const link = (item: NavItem, mobile: boolean) => {
    const current = isCurrent(item, pathname);
    return (
      <NavLink
        to={item.to}
        aria-current={current ? "page" : undefined}
        class={
          mobile
            ? `flex items-center justify-between border-b border-rule px-4 py-3 ${current ? "font-semibold text-ink" : "text-ink-2"}`
            : `border-b-2 py-[1.0625rem] text-sm ${
                current ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink hover:border-rule-strong"
              }`
        }
      >
        {item.label}
        {mobile && current && <span class="eyebrow">Current</span>}
      </NavLink>
    );
  };

  return (
    <header class="relative border-b border-rule-strong bg-surface">
      <div class="mx-auto flex h-14 w-full max-w-page items-center gap-4 px-4 sm:px-6 lg:gap-8 lg:px-8">
        <NavLink to={{ route: "home" }} class="flex flex-none items-center gap-2.5" aria-label="Framework Bench — home">
          <span class="flex gap-0.5 text-ink" aria-hidden="true">
            {LABEL_ORDER.map((label) => (
              <span key={label} class={`badge tier-${label} text-[0.6875rem]`}>
                <LabelGlyph label={label} />
              </span>
            ))}
          </span>
          <span class="font-display text-lg leading-none tracking-[-0.01em] text-ink">Framework Bench</span>
        </NavLink>

        <nav aria-label="Primary" class="ml-auto hidden md:block">
          <ul class="flex items-center gap-5 lg:gap-6">
            {NAV.map((item) => (
              <li key={item.label}>{link(item, false)}</li>
            ))}
          </ul>
        </nav>

        <div class="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <details data-nav class="group md:hidden">
            <summary
              class="flex h-8 cursor-pointer list-none items-center gap-2 rounded-sm border border-rule-strong px-2.5 text-sm text-ink-2 hover:border-ink hover:text-ink [&::-webkit-details-marker]:hidden"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
                <path class="group-open:hidden" d="M2 4.5h12M2 8h12M2 11.5h12" />
                <path class="hidden group-open:block" d="m3.5 3.5 9 9m0-9-9 9" />
              </svg>
              Menu
            </summary>
            <nav
              aria-label="Primary"
              class="absolute inset-x-0 top-full z-20 border-b border-rule-strong bg-surface shadow-[0_12px_24px_-12px_rgb(0_0_0/0.35)]"
            >
              <ul>
                {NAV.map((item) => (
                  <li key={item.label}>{link(item, true)}</li>
                ))}
              </ul>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

/** Site footer: what the data is (and is not), provenance, source link. */
export function SiteFooter() {
  return (
    <footer class="mt-12 border-t border-rule-strong bg-surface">
      <div class="mx-auto grid w-full max-w-page gap-8 px-4 py-8 text-sm text-ink-2 sm:px-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-8">
        <div class="max-w-prose space-y-2">
          <p class="eyebrow">About this data</p>
          <p>
            <strong class="font-semibold text-ink">Capability labels come from vendor documentation, not from measurements.</strong>{" "}
            A label says what a framework provides out of the box, not how fast an app built with it will be. Lab
            measurements live on the{" "}
            <NavLink to={{ route: "measured" }} class="link">
              Measured
            </NavLink>{" "}
            page and are reported separately.
          </p>
          <p>
            The comparison was researched and written with AI assistance and may contain errors; check the linked
            sources before relying on a claim. See the{" "}
            <NavLink to={{ route: "methodology" }} class="link">
              methodology
            </NavLink>
            .
          </p>
        </div>
        <div class="space-y-2 md:justify-self-end">
          <p class="eyebrow">Source</p>
          <p>
            <ExternalLink href={REPO_URL}>MaxwellCohen/books-demo</ExternalLink>
          </p>
          <p class="text-ink-3">The same books app, ported to 15 frameworks.</p>
        </div>
      </div>
    </footer>
  );
}
