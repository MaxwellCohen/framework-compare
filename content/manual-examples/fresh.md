## caching

You wrap each query in a TTL cache backed by a host store, and set the HTML Cache-Control in app middleware. This comes from the port.

```ts
// lib/catalog-cache.server.ts
export function withTtlCache<Args extends unknown[], Result>(
  name: string,
  fn: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  // in-memory Map → Workers KV / Vercel getCache / Netlify Blobs → fn()
  return (...args: Args) => cacheLifeHours(`${name}:${JSON.stringify(args)}`, () => fn(...args))
}

// features/book/book-queries.server.ts
export const getBooksPage = withTtlCache('getBooksPage', getBooksPageUncached)

// main.ts
app.use(async (ctx) => {
  const res = await ctx.next();
  if (!res.headers.get("content-type")?.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", hostDocumentCacheControl());
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});
```

Source: [Fresh data fetching](https://usefresh.dev/docs/concepts/data-fetching)

## picture

You write the `<picture>` markup in a Preact component and put each pre-encoded format and crop in `static/` yourself.

```tsx
// components/Hero.tsx
export function Hero() {
  return (
    <picture>
      <source media="(min-width: 1000px)" type="image/avif" srcset="/hero-wide.avif" />
      <source media="(min-width: 1000px)" srcset="/hero-wide.jpg" />
      <source type="image/avif" srcset="/hero-tall.avif" />
      <img
        src="/hero-tall.jpg"
        alt="Shelves of books"
        width={750}
        height={1334}
        fetchPriority="high"
        decoding="async"
      />
    </picture>
  );
}
```

Source: [Fresh static files](https://usefresh.dev/docs/concepts/static-files)

## css-inlining

You import the stylesheet with Vite's `?inline` suffix in `_app.tsx` and render it in a `<style>` tag. Drop the import from `client.ts` so Vite stops adding the `<link>`.

```tsx
// routes/_app.tsx
import globalCss from "../assets/global.css?inline";
import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        {/* _app.tsx is server-only, so the CSS string never reaches an island bundle */}
        <style dangerouslySetInnerHTML={{ __html: globalCss }} />
        {/* … */}
      </head>
      <body f-client-nav>{/* … */}</body>
    </html>
  );
});

// client.ts
// import "./assets/global.css";  ← removed, or the <link> comes back
```

Source: [Vite: disabling CSS injection](https://vite.dev/guide/features#disabling-css-injection-into-the-page)

## render-modes

Every route still renders on the server. You pick a mode per route with CDN Cache-Control headers in app middleware, adapting the port's `main.ts` middleware.

```ts
// main.ts
const modes: Record<string, string> = {
  "/about": "public, s-maxage=31536000",                    // "static": cached until redeploy
  "/": "public, s-maxage=60, stale-while-revalidate=86400", // "ISR": revalidate each minute
};

app.use(async (ctx) => {
  const res = await ctx.next();
  if (!res.headers.get("content-type")?.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", modes[ctx.url.pathname] ?? "private, no-store"); // SSR
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
});

app.fsRoutes();
```

Source: [Fresh data fetching (response headers)](https://usefresh.dev/docs/concepts/data-fetching)

## route-prefetching

Add a Speculation Rules block to `_app.tsx`. Supporting browsers prefetch same-origin pages on hover, and other browsers ignore it. The prefetch only helps full-page navigations, so it does not speed up links that use Fresh partials (`f-client-nav`).

```tsx
// routes/_app.tsx
const speculationRules = JSON.stringify({
  prefetch: [{
    where: { and: [
      { href_matches: "/*" },
      { not: { selector_matches: "[rel~=nofollow]" } },
    ] },
    eagerness: "moderate",
  }],
});

// … inside <head>:
<script type="speculationrules" dangerouslySetInnerHTML={{ __html: speculationRules }} />
```

Source: [MDN: speculationrules](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/speculationrules)

## third-party-scripts

You write the loading strategy into `<head>` in `_app.tsx`. Use `async` or `defer` on the tag, or inject it at idle time with an inline script, as the port does for its theme script.

```tsx
// routes/_app.tsx
const loadChatWhenIdle = `(window.requestIdleCallback||setTimeout)(function(){
  var s=document.createElement("script");s.src="https://widget.example.com/chat.js";s.async=true;
  document.head.appendChild(s);});`;

export default define.page(function App({ Component }) {
  return (
    <html lang="en">
      <head>
        {/* … */}
        <script async src="https://analytics.example.com/script.js" />      {/* parallel, non-blocking */}
        <script dangerouslySetInnerHTML={{ __html: loadChatWhenIdle }} />   {/* after load, at idle */}
      </head>
      {/* <head> sits outside <Partial>, so f-client-nav does not re-run these */}
      <body f-client-nav>{/* … */}</body>
    </html>
  );
});
```

Source: [Fresh head](https://usefresh.dev/docs/advanced/head)

## multi-host-deployment

You write a post-build script that wraps `_fresh/server.js` in each host's entry shape. This comes from the port: an edge function for Netlify, and a Node handler plus Build Output API config for Vercel.

```js
// scripts/netlify-edge.mjs
import server from "../_fresh/server.js";
export default (request) => server.fetch(request);

// scripts/adapt.mjs (runs after `vite build`; host picked by NETLIFY=1 | VERCEL=1)
if (host === "vercel") {
  await build({ ...common, entryPoints: ["scripts/vercel-handler.mjs"],
    outfile: `${out}/functions/index.func/index.mjs`, platform: "node", target: "node24" });
  await Deno.writeTextFile(`${out}/functions/index.func/.vc-config.json`, JSON.stringify({
    runtime: "nodejs24.x", handler: "index.mjs", launcherType: "Nodejs", supportsResponseStreaming: true,
  }));
  // … copy _fresh/client to static/, write config.json routes
} else if (host === "netlify") {
  await build({ ...common, entryPoints: ["scripts/netlify-edge.mjs"],
    outfile: "netlify/edge-functions/fresh.js", platform: "neutral", external: ["node:*"] });
}
```

Source: [Fresh deployment](https://usefresh.dev/docs/deployment)

## font-optimization

The Books port self-hosts Geist with Fontsource packages mapped in `deno.json`. The CSS `@import` brings in the `@font-face` rules, and Vite bundles the font files when `client.ts` imports the stylesheet.

```jsonc
// deno.json
"imports": {
  "@fontsource-variable/geist": "npm:@fontsource-variable/geist@^5.3.0"
}
```

```css
/* assets/global.css (imported from client.ts) */
@import '@fontsource-variable/geist';
@import 'tailwindcss';

@theme {
  --font-sans: 'Geist Variable', ui-sans-serif, system-ui, sans-serif;
}
```

Source: [Fontsource: Install](https://fontsource.org/docs/getting-started/install)

## image-pipeline

Fresh 2 builds with Vite, so `vite-imagetools` resizes and converts images at build time. The query string on the import picks widths and format, and `as=srcset` returns a ready `srcset` string.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import { imagetools } from "vite-imagetools";

export default defineConfig({
  plugins: [fresh(), imagetools()],
});
```

```tsx
// routes/about.tsx
import heroAvif from "../static/hero.jpg?format=avif&w=800";
import heroSrcset from "../static/hero.jpg?w=400;800;1200&format=webp&as=srcset";

export default function About() {
  return <img src={heroAvif} srcset={heroSrcset} sizes="100vw" alt="Shelves of books" width={800} />;
}
```

Source: [Fresh: Static files](https://usefresh.dev/docs/concepts/static-files)

## islands

Any component in `islands/` ships JS; everything else renders to HTML only. In the Books port the layout is server-only, and just the search box and the mobile drawer hydrate.

```tsx
// routes/_layout.tsx
import BookSearch from '@/islands/BookSearch.tsx';
import MobileSidebar from '@/islands/MobileSidebar.tsx';
import MobileSidebarTrigger from '@/islands/MobileSidebarTrigger.tsx';
import { define } from '../utils.ts';

export default define.layout(function Layout({ Component, url }) {
  const current = searchParamsFromUrl(url.searchParams);
  return (
    <>
      <MobileSidebar pathname={url.pathname}>
        {/* server-rendered children passed into an island */}
        <BookSidebar current={current} idPrefix="mobile" mobile />
      </MobileSidebar>
      <header>
        <MobileSidebarTrigger />
        <BookSearch current={current} />
      </header>
      <main><Component /></main>
    </>
  );
});
```

Source: [Fresh: Islands](https://usefresh.dev/docs/concepts/islands)

## reactivity

Preact signals. In the Books port, one module-level signal is shared by two islands: the trigger sets it and the drawer re-renders when it changes.

```ts
// lib/catalog-nav.ts
import { signal } from '@preact/signals';
export const mobileSidebarOpen = signal(false);
```

```tsx
// islands/MobileSidebarTrigger.tsx
import { mobileSidebarOpen } from '@/lib/catalog-nav.ts';

export default function MobileSidebarTrigger() {
  return <button aria-label="Open filters" onClick={() => (mobileSidebarOpen.value = true)}>Filters</button>;
}

// islands/MobileSidebar.tsx
export default function MobileSidebar({ children }: { children?: ComponentChildren }) {
  const isOpen = mobileSidebarOpen.value;
  return <aside hidden={!isOpen}>{children}</aside>;
}
```

Source: [Fresh: Signals](https://usefresh.dev/docs/concepts/signals)

## bundle-analysis

Fresh has no analyzer. The Vite page suggests `vite-plugin-inspect` for looking at transforms during dev; for bundle sizes, add `rollup-plugin-visualizer` and run `deno task build`.

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";
import inspect from "vite-plugin-inspect";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    fresh(),
    inspect(), // dev UI at /__inspect
    visualizer({ filename: "stats.html", gzipSize: true }),
  ],
});
```

Source: [Fresh: Vite](https://usefresh.dev/docs/advanced/vite)

## service-worker

Put a hand-written worker in `static/` and register it with an inline script in the app wrapper.

```js
// static/sw.js
const CACHE = 'books-v1'; // change the name on each deploy

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  // Network first, so pages stay current. The cached copy answers when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
```

```tsx
// routes/_app.tsx
const swScript = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// … in <head>
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · [Fresh static files](https://usefresh.dev/docs/concepts/static-files)

## early-hints

Set a `Link` header on HTML responses in an app middleware. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```ts
// main.ts
const LINK = '<https://fonts.gstatic.com>; rel=preconnect; crossorigin';

app.use(async (ctx) => {
  const res = await ctx.next();
  if (res.headers.get('content-type')?.includes('text/html')) res.headers.append('Link', LINK);
  return res;
});
```

Source: [Fresh middleware](https://usefresh.dev/docs/concepts/middleware)

## streaming-ssr

Write the route handler yourself and return a `ReadableStream` of HTML. The shell and a placeholder go out first. When the query resolves, the handler sends the rendered grid and a small script that swaps it in. This page skips Fresh's layouts and islands.

```tsx
// routes/books.tsx
import { define } from "@/utils.ts";
import { renderToString } from "preact-render-to-string";

export const handler = define.handlers({
  GET() {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(enc.encode(
          `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head>` +
          `<body><main id="grid">Loading…</main>`,
        ));
        const books = await getBooks();
        controller.enqueue(enc.encode(
          `<template id="grid-html">${renderToString(<BookGrid books={books} />)}</template>` +
          `<script>document.getElementById("grid").replaceWith(document.getElementById("grid-html").content)</script></body></html>`,
        ));
        controller.close();
      },
    });
    return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  },
});
```

Source: [Fresh: Common patterns](https://usefresh.dev/docs/examples/common-patterns)
