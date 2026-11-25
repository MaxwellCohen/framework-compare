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
