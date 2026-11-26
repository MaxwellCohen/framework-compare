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

## service-worker

Put a hand-written worker in `public/` and register it with an inline script in the root layout.

```js
// public/sw.js
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

```marko
// src/routes/+layout.marko
static const SW_SCRIPT = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// … in <head>
    <html-script>$!{SW_SCRIPT}</html-script>
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

## early-hints

Set a `Link` header on HTML responses in the root middleware. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```ts
// src/routes/+middleware.ts
const LINK = '<https://fonts.gstatic.com>; rel=preconnect; crossorigin';

export default async (_ctx: unknown, next: () => Promise<Response>) => {
  const response = await next();
  if (response.headers.get('content-type')?.includes('text/html')) response.headers.append('Link', LINK);
  return response;
};
```

Source: [Marko Run: file-based routing](https://markojs.com/docs/marko-run/file-based-routing)
