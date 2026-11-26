## picture

There is no image component, so write the `<picture>` by hand in a server component. Wide screens get a landscape crop and narrow screens get a square one, both served from `public/`. React spells the attribute `srcSet`.

```tsx
// src/app/components/Hero.tsx
export function Hero() {
  return (
    <picture>
      {/* art direction: a square crop on narrow screens */}
      <source media="(max-width: 640px)" srcSet="/images/hero-square-640.webp"
              width={640} height={640} />
      <source media="(min-width: 641px)" srcSet="/images/hero-wide-1600.webp"
              width={1600} height={900} />
      <img src="/images/hero-wide-1600.jpg" alt="Shelves of books"
           width={1600} height={900} fetchPriority="high" decoding="async" />
    </picture>
  );
}
```

Source: [MDN: the picture element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture) · [RedwoodSDK: Public Assets](https://docs.rwsdk.com/guides/frontend/public-assets)

## css-inlining

Import the stylesheet with Vite's `?inline` query instead of `?url`, and write it into a `<style>` in the Document. The Document renders only on the server, so the CSS string does not ship in a client bundle.

```tsx
// src/app/Document.tsx
import styles from "./styles.css?inline"; // was: import styles from "./styles.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <title>RedwoodSDK App</title>
      {/* was: <link rel="stylesheet" href={styles} /> */}
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <link rel="modulepreload" href="/src/client.tsx" />
    </head>
    <body>
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
```

Source: [RedwoodSDK: Tailwind CSS](https://docs.rwsdk.com/guides/frontend/tailwind) · [Vite: disabling CSS injection](https://vite.dev/guide/features.html#disabling-css-injection-into-the-page)

## font-optimization

Install a Fontsource package and import it at the top of the stylesheet. The package ships the `@font-face` rules and self-hosted font files, and Vite bundles them like any other CSS import.

```css
/* src/app/styles.css */
@import "@fontsource-variable/inter";
@import "tailwindcss";

@theme {
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
}
```

Source: [Fontsource: Installing fonts](https://fontsource.org/docs/getting-started/install)

## image-pipeline

Turn on Cloudflare Images transformations for the zone, then build `/cdn-cgi/image/<OPTIONS>/<SOURCE>` URLs by hand. This helper writes a `srcSet` that asks Cloudflare for each width in the best format the browser accepts.

```tsx
// src/app/components/CfImage.tsx
const cf = (src: string, width: number) =>
  `/cdn-cgi/image/width=${width},quality=75,format=auto${src}`;

export function CfImage({ src, alt, width, height }: {
  src: string; alt: string; width: number; height: number;
}) {
  return (
    <img
      src={cf(src, width)}
      srcSet={[1, 2].map((d) => `${cf(src, width * d)} ${width * d}w`).join(", ")}
      sizes={`${width}px`}
      alt={alt} width={width} height={height} loading="lazy" decoding="async"
    />
  );
}
```

Source: [Cloudflare Images: Transform via URL](https://developers.cloudflare.com/images/transform-images/transform-via-url/)

## caching

Put a small handler in front of the page in the route's array and set `Cache-Control` on `response.headers`. The browser and Cloudflare's edge then cache the HTML for that route.

```tsx
// src/worker.tsx
import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";
import { Document } from "@/app/Document";
import { BookPage } from "@/app/pages/BookPage";

export default defineApp([
  render(Document, [
    route("/books/:id", [
      ({ response }) => {
        response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300");
      },
      BookPage,
    ]),
  ]),
]);
```

Source: [RedwoodSDK: Request Handling, Routing & Responses](https://docs.rwsdk.com/core/routing)

## route-prefetching

Turn on client navigation and pass `onHydrated` to `initClient`. Then render `<link rel="x-prefetch">` for likely next routes. RedwoodSDK fetches each one after navigation and keeps it in the Cache API.

```tsx
// src/client.tsx
import { initClient, initClientNavigation } from "rwsdk/client";

const { handleResponse, onHydrated } = initClientNavigation();
initClient({ handleResponse, onHydrated });
```

```tsx
// src/app/pages/BlogListPage.tsx
import { link } from "@/shared/links";

export function BlogListPage({ posts }) {
  return posts.map((post) => {
    const href = link("/blog/:slug", { slug: post.slug });
    return (
      <article key={post.id}>
        <link rel="x-prefetch" href={href} />
        <a href={href}><h2>{post.title}</h2></a>
      </article>
    );
  });
}
```

Source: [RedwoodSDK: Client Side Navigation](https://docs.rwsdk.com/guides/frontend/client-side-nav)

## streaming-ssr

Make a server component async and wrap it in `<Suspense>`. The page shell streams first with the fallback, and the list streams in when the query resolves.

```tsx
// src/app/pages/todos/TodoPage.tsx
import { Suspense } from "react";

export async function Todos({ ctx }) {
  const todos = await db.todo.findMany({ where: { userId: ctx.user.id } });
  return <ol>{todos.map((todo) => <li key={todo.id}>{todo.title}</li>)}</ol>;
}

export async function TodoPage({ ctx }) {
  return (
    <div>
      <h1>Todos</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <Todos ctx={ctx} />
      </Suspense>
    </div>
  );
}
```

Source: [RedwoodSDK: React Server Components](https://docs.rwsdk.com/core/react-server-components)

## early-hints

Add a middleware that sets a `Link` header on every response. This one preloads a font from `public/`, whose URL does not change between builds. Cloudflare can turn `Link` preload headers into 103 Early Hints when Early Hints is on for the zone.

```ts
// src/app/headers.ts
import type { RouteMiddleware } from "rwsdk/worker";

export const preloadHeaders = (): RouteMiddleware => ({ response }) => {
  response.headers.append(
    "Link",
    "</fonts/brand-font.woff2>; rel=preload; as=font; type=font/woff2; crossorigin",
  );
};

// src/worker.tsx
export default defineApp([
  preloadHeaders(),
  render(Document, [route("/", HomePage)]),
]);
```

Source: [RedwoodSDK: Security](https://docs.rwsdk.com/core/security) · [Cloudflare: Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/)

## islands

Pages are server components by default and send no JavaScript. Only the component marked `"use client"` ships code and hydrates.

```tsx
// src/app/components/LikeButton.tsx
"use client";
import { useState } from "react";

export function LikeButton() {
  const [likes, setLikes] = useState(0);
  return <button onClick={() => setLikes(likes + 1)}>Like ({likes})</button>;
}

// src/app/pages/BookPage.tsx (server component, no client JS of its own)
import { LikeButton } from "@/app/components/LikeButton";

export async function BookPage({ params }) {
  const book = await getBook(params.id);
  return (
    <article>
      <h1>{book.title}</h1>
      <p>{book.description}</p>
      <LikeButton />
    </article>
  );
}
```

Source: [RedwoodSDK: React Server Components](https://docs.rwsdk.com/core/react-server-components)

## render-modes

Pass options as the third argument to `render()`. `rscPayload: false` serves a group as static HTML with no hydration, and `ssr: false` renders client components only in the browser.

```tsx
// src/worker.tsx
import { defineApp } from "rwsdk/worker";
import { render, prefix } from "rwsdk/router";
import { ReactDocument, StaticDocument } from "@/app/Document";

export default defineApp([
  // Default: SSR with the RSC payload, so the page hydrates
  render(ReactDocument, [prefix("/app", appRoutes)]),
  // Static HTML, no hydration (StaticDocument has no client script)
  render(StaticDocument, [prefix("/docs", docsRoutes)], { rscPayload: false }),
  // Client components render only in the browser
  render(ReactDocument, [prefix("/spa", spaRoutes)], { ssr: false }),
]);
```

Source: [RedwoodSDK: sdk/router](https://docs.rwsdk.com/reference/sdk-router)

## reactivity

Add the React Compiler as a Babel plugin on `@vitejs/plugin-react`, placed before the Cloudflare and RedwoodSDK plugins. Components then get automatic memoization without `useMemo` or `useCallback`.

```ts
// vite.config.mts
import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    cloudflare({ viteEnvironment: { name: "worker" } }),
    redwood(),
  ],
});
```

Source: [RedwoodSDK: React Compiler](https://docs.rwsdk.com/guides/optimize/react-compiler)

## bundle-analysis

RedwoodSDK builds with Vite, so add `rollup-plugin-visualizer` to the plugins. The build writes `stats.html` with a treemap of the bundles.

```ts
// vite.config.mts
import { defineConfig, type PluginOption } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "worker" } }),
    redwood(),
    visualizer({ filename: "stats.html", gzipSize: true }) as PluginOption,
  ],
});
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)

## third-party-scripts

Write the tags in the Document yourself. An external script gets `async`, and an inline snippet needs the per-request `rw.nonce` to pass the CSP. Add the script's host to `script-src` in `src/app/headers.ts`.

```tsx
// src/app/Document.tsx
export const Document = ({ rw, children }) => (
  <html lang="en">
    <head>
      {/* … */}
      <script async src="https://plausible.io/js/script.js" data-domain="books.example" />
    </head>
    <body>
      {children}
      <script nonce={rw.nonce}>
        {`window.plausible = window.plausible || function () { (plausible.q = plausible.q || []).push(arguments) };`}
      </script>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
```

Source: [RedwoodSDK: Security](https://docs.rwsdk.com/core/security) · [RedwoodSDK: Documents](https://docs.rwsdk.com/guides/frontend/documents)

## multi-host-deployment

The documented build targets Cloudflare Workers through `@cloudflare/vite-plugin`, and `pnpm release` deploys it. Staging and production are Wrangler environments. Another host would need an adapter you write yourself.

```ts
// vite.config.mts
import { defineConfig } from "vite";
import { redwood } from "rwsdk/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare({ viteEnvironment: { name: "worker" } }), redwood()],
});
```

```bash
pnpm release                           # production Worker
CLOUDFLARE_ENV=staging pnpm release    # uses env.staging from wrangler.jsonc
```

Source: [RedwoodSDK: Hosting](https://docs.rwsdk.com/core/hosting)

## service-worker

Put a hand-written worker in `public/` and register it from a client component rendered on every page.

```js
// public/sw.js
const CACHE = "app-v1"; // change the name on each deploy

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
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
// src/app/components/RegisterServiceWorker.tsx
"use client";
import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · [RedwoodSDK: Public Assets](https://docs.rwsdk.com/guides/frontend/public-assets)
