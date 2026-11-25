import type { ShellProps } from "@pracht/core";
import "../styles/global.css";
import { SiteFooter, SiteHeader, THEME_SCRIPT } from "../components/Site.tsx";
import { fonts, fontVars } from "../styles/fonts.ts";

/**
 * The one site shell: skip link, header, <main>, footer. It sets the font
 * variables and nothing about width — pages constrain themselves with
 * `Container` / `PageHeader` / `Section` from src/components.
 */
export function Shell({ children }: ShellProps) {
  return (
    <div style={fontVars} class="flex min-h-dvh flex-col font-sans">
      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} class="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function head() {
  return {
    lang: "en",
    title: "Framework Bench",
    meta: [
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: "light dark", name: "color-scheme" },
      { content: "#faf9f5", media: "(prefers-color-scheme: light)", name: "theme-color" },
      { content: "#111210", media: "(prefers-color-scheme: dark)", name: "theme-color" },
    ],
    link: [{ href: "/favicon.svg", rel: "icon", type: "image/svg+xml" }],
    // Theme before first paint + the delegated toggle handler. See THEME_SCRIPT.
    script: [{ children: THEME_SCRIPT }],
    fonts,
  };
}
