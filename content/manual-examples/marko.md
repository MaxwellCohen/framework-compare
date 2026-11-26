## picture

Marko renders native tags as-is, so you write `<picture>` in a custom tag. You also produce each format and crop yourself and put them in `public/`.

```marko
// src/tags/hero-image.marko
export interface Input {
  alt: string;
  priority?: boolean;
}

<picture>
  <source media="(min-width: 1000px)" type="image/avif" srcset="/hero-wide.avif">
  <source media="(min-width: 1000px)" srcset="/hero-wide.jpg">
  <source type="image/avif" srcset="/hero-tall.avif">
  <img
    src="/hero-tall.jpg"
    alt=input.alt
    width=750
    height=1334
    decoding="async"
    fetchpriority=(input.priority ? "high" : undefined)
    loading=(input.priority ? "eager" : "lazy")
  >
</picture>
```

Source: [Marko native tags](https://markojs.com/docs/reference/native-tag)

## css-inlining

You replace the layout's side-effect CSS import with a Vite `?inline` import, then write it out with `<html-style>`. The port uses the same `$!{…}` form for its theme script in `<html-script>`.

```marko
// src/routes/+layout.marko
import css from "../styles.css?inline"   // was: import "../styles.css"

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    // emitted as a literal <style> in the streamed HTML; no stylesheet <link>
    <html-style>$!{css}</html-style>
    // …
  </head>
  <body>
    <${input.content}/>
  </body>
</html>
```

Source: [Vite: disabling CSS injection](https://vite.dev/guide/features#disabling-css-injection-into-the-page)

## render-modes

Every route still streams SSR. You tag a route with a mode in `+meta.json`, and the root middleware turns it into CDN Cache-Control. This adapts the port's `+middleware.ts`.

```ts
// src/routes/about/+meta.json   →  { "render": "static" }
// src/routes/+meta.json         →  { "render": "isr" }

// src/routes/+middleware.ts
const cacheControl: Record<string, string> = {
  static: "public, s-maxage=31536000",                // cached until redeploy
  isr: "public, s-maxage=60, stale-while-revalidate=86400",
};

export default Run.ALL(async (ctx, next) => {
  const res = await next();
  if (!res.headers.get("content-type")?.includes("text/html")) return res;
  const mode = (ctx.meta as { render?: string } | undefined)?.render;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", cacheControl[mode ?? ""] ?? "private, no-store"); // SSR
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});
```

Source: [Marko Run file-based routing (+meta, +middleware)](https://markojs.com/docs/marko-run/file-based-routing)

## route-prefetching

Marko Run navigates with full documents, so a Speculation Rules block in the layout handles it. Supporting browsers prefetch same-origin links on hover; the others ignore the block.

```marko
// src/routes/+layout.marko
<head>
  // …
  <html-script type="speculationrules">
    {
      "prefetch": [{
        "where": { "and": [
          { "href_matches": "/*" },
          { "not": { "selector_matches": "[rel~=nofollow]" } }
        ]},
        "eagerness": "moderate"
      }]
    }
  </html-script>
</head>
```

Source: [MDN: speculationrules](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/speculationrules)

## third-party-scripts

Marko's `<script>` is a mount effect, so you use `<html-script>` for a literal async tag. A `<script>` effect then loads the low-priority widget at browser idle.

```marko
// src/routes/+layout.marko
<head>
  // …
  // literal tag in the HTML: downloads in parallel, never blocks parsing
  <html-script async src="https://analytics.example.com/script.js"></html-script>
</head>
<body>
  <${input.content}/>
  // runs once in the browser after mount, then waits for idle
  <script>
    (window.requestIdleCallback || setTimeout)(() => {
      const s = document.createElement("script");
      s.src = "https://widget.example.com/chat.js";
      s.async = true;
      document.head.append(s);
    });
  </script>
</body>
```

Source: [Marko core tags](https://markojs.com/docs/reference/core-tag)

## font-optimization

The Books port self-hosts Geist with Fontsource. The CSS `@import` pulls the package's `@font-face` rules, and Vite copies the `.woff2` files into the build with hashed names.

```css
/* src/styles/global.css */
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
@import 'tailwindcss';

@theme {
  --font-sans: 'Geist Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono Variable', ui-monospace, monospace;
}
```

Source: [Fontsource: Install](https://fontsource.org/docs/getting-started/install)

## image-pipeline

Marko has no image component, so a small tag builds a `srcset` against the host's image CDN. This one uses Netlify Image CDN URLs; remote sources must be allowlisted in `netlify.toml`.

```marko
// src/tags/book-cover.marko
export interface Input { src: string; title: string; sizes: string; priority?: boolean }

static const WIDTHS = [160, 320, 640];
static function cdn(src: string, w: number) {
  return `/.netlify/images?url=${encodeURIComponent(src)}&w=${w}&q=75`;
}

<img
  src=cdn(input.src, 320)
  srcset=WIDTHS.map((w) => `${cdn(input.src, w)} ${w}w`).join(", ")
  sizes=input.sizes
  alt=input.title
  width=320 height=480
  loading=(input.priority ? "eager" : "lazy")
  fetchpriority=(input.priority ? "high" : undefined)
/>
```

```toml
# netlify.toml
[images]
  remote_images = ['https://images\.gr-assets\.com/.*']
```

Source: [Netlify: Image CDN overview](https://docs.netlify.com/build/image-cdn/overview/)

## caching

For a fully static site, swap in `@marko/run-adapter-static`, which crawls links at build time; `urls` adds pages the crawler can't reach. For server-rendered pages, set `Cache-Control` yourself in middleware, as the Books port does.

```ts
// vite.config.ts (static build)
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import staticAdapter from "@marko/run-adapter-static";

export default defineConfig({
  plugins: [marko({ adapter: staticAdapter({ urls: ["/about", "/1"] }) })],
});
```

```ts
// src/routes/+middleware.ts (server build)
export default async (_ctx: unknown, next: () => Promise<Response>) => {
  const response = await next();
  if (!response.headers.get("content-type")?.includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  return new Response(response.body, { status: response.status, headers });
};
```

Source: [Marko Run: Adapters](https://markojs.com/docs/marko-run/adapters)

## islands

Interactive code ships by default only for tags with client state or handlers. To delay one tag's JS further, import it with a `load` trigger. The server still renders its HTML; the browser fetches the bundle when `#reviews` scrolls into view.

```marko
// src/routes/$id/+page.marko
import BookReviews from "<book-reviews>" with { load: "visible#reviews?rootMargin=200px" }

<book-detail book=$global.data.book/>

<section id="reviews">
  <BookReviews bookId=$global.data.book.id/>
</section>
```

Source: [Marko: Lazy loading](https://markojs.com/docs/reference/lazy-loading)

## reactivity

`<let>` declares state and `<const>` derives from it. The compiler works out which DOM nodes depend on `count` at build time, so there is no runtime dependency tracking.

```marko
// src/tags/counter.marko
<let/count=0>
<const/doubled=count * 2>

<button onClick() { count++ }>
  ${count} × 2 = ${doubled}
</button>
```

Source: [Marko: Why is Marko fast](https://markojs.com/docs/explanation/why-is-marko-fast)

## bundle-analysis

Marko Run builds with Vite, so add `rollup-plugin-visualizer` next to the Marko plugin. `marko-run build` then writes a treemap of the client bundles.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    marko(),
    visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true }),
  ],
});
```

Source: [rollup-plugin-visualizer README](https://github.com/btd/rollup-plugin-visualizer)

## multi-host-deployment

The Books port picks an adapter at build time from an env var. The default Node adapter covers local and container runs; the Netlify, Vercel and Cloudflare adapters build for each host.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import marko from "@marko/run/vite";

export default defineConfig(async () => {
  const adapter = process.env.CLOUDFLARE
    ? (await import("@marko/run-adapter-cloudflare")).default()
    : process.env.NETLIFY
      ? (await import("@marko/run-adapter-netlify")).default() // { edge: true } for Edge Functions
      : process.env.VERCEL
        ? (await import("@marko/run-adapter-vercel")).default()
        : (await import("@marko/run/adapter")).default();

  return { plugins: [marko({ adapter })] };
});
```

```sh
NETLIFY=1 marko-run build && netlify deploy --prod --no-build
```

Source: [Marko Run: Adapters](https://markojs.com/docs/marko-run/adapters)
