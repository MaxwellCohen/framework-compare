/**
 * Self-hosted fonts (Fontsource WOFF2 files, latin subset) registered through
 * pracht's `defineFont()`. The shell lists them in `head().fonts`, which emits
 * the @font-face rules and — for the three faces used above the fold — a
 * `<link rel="preload">`. Nothing is fetched from a font CDN.
 *
 * Roles:
 *   display — Newsreader 500      headings, big numerals
 *   text    — IBM Plex Sans       body copy and UI (400, 600, 400 italic)
 *   mono    — IBM Plex Mono       every number, score, label code, and code block
 *
 * The shell exposes the stacks as the CSS variables --ff-display / --ff-text /
 * --ff-mono, which `global.css` maps onto Tailwind's font-display / font-sans /
 * font-mono utilities.
 */
import { defineFont } from "@pracht/core";
import newsreader500 from "@fontsource/newsreader/files/newsreader-latin-500-normal.woff2?url&no-inline";
import plexSans400 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url&no-inline";
import plexSans600 from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url&no-inline";
import plexSans400Italic from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2?url&no-inline";
import plexMono400 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url&no-inline";
import plexMono600 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2?url&no-inline";

const SANS_FALLBACKS = ["Arial", "system-ui", "sans-serif"];
const MONO_FALLBACKS = ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"];

// Fallback metric overrides computed once with `npx fontpie <file> --fallback arial`.
export const display = defineFont({
  family: "Newsreader",
  src: newsreader500,
  weight: 500,
  fallbacks: ["Georgia", "Times New Roman", "serif"],
  metricsFallback: "Arial",
  sizeAdjust: "98.12%",
  ascentOverride: "74.91%",
  descentOverride: "27.01%",
  lineGapOverride: "0%",
});

export const text = defineFont({
  family: "IBM Plex Sans",
  src: plexSans400,
  weight: 400,
  fallbacks: SANS_FALLBACKS,
  metricsFallback: "Arial",
  sizeAdjust: "101.13%",
  ascentOverride: "101.35%",
  descentOverride: "27.19%",
  lineGapOverride: "0%",
});

export const textBold = defineFont({
  family: "IBM Plex Sans",
  src: plexSans600,
  weight: 600,
  preload: false,
  fallbacks: SANS_FALLBACKS,
});

export const textItalic = defineFont({
  family: "IBM Plex Sans",
  src: plexSans400Italic,
  weight: 400,
  style: "italic",
  preload: false,
  fallbacks: SANS_FALLBACKS,
});

export const mono = defineFont({
  family: "IBM Plex Mono",
  src: plexMono400,
  weight: 400,
  fallbacks: MONO_FALLBACKS,
});

export const monoBold = defineFont({
  family: "IBM Plex Mono",
  src: plexMono600,
  weight: 600,
  preload: false,
  fallbacks: MONO_FALLBACKS,
});

/** Every face, for the shell's `head().fonts`. */
export const fonts = [display, text, textBold, textItalic, mono, monoBold];

/** CSS variables consumed by `global.css` (set on the shell's root element). */
export const fontVars = {
  "--ff-display": display.fontFamily,
  "--ff-text": text.fontFamily,
  "--ff-mono": mono.fontFamily,
};
