## picture

Write the same `<picture>` as the React port, with `Source` from `@unpic/solid` around the port's `<Image>` wrapper. Solid uses `class` instead of `className`.

```tsx
// src/features/book/components/book-cover.tsx
import { Source } from "@unpic/solid";
import { Image } from "@/components/ui/image";
import { imageCdn } from "@/lib/image-config";
// …
const small = () => props.src ?? EMPTY_IMAGE_URL;
const size = { layout: "constrained", width: COVER_IMAGE_WIDTH, height: COVER_IMAGE_HEIGHT } as const;

return (
  <picture>
    <Source
      {...size}
      media="(min-width: 768px)"
      src={getLargeBookImageUrl(small())}
      cdn={imageCdn}
      options={imageCdn === "ipx" ? { ipx: { baseURL: "/_ipx" } } : undefined}
    />
    <Image {...size} alt={props.title} src={small()} sizes={props.sizes} priority={props.priority}
           class="absolute inset-0 size-full object-cover" objectFit="cover" unstyled />
  </picture>
);
```

## third-party-scripts

Use the root route's `head().scripts`, which the port already uses for its theme script. Since there is no loading-strategy option, add a small inline loader that injects the third-party tag once the page has loaded.

```tsx
// src/routes/__root.tsx
const lazyAnalytics = `addEventListener("load",function(){(window.requestIdleCallback||setTimeout)(function(){var s=document.createElement("script");s.src="https://example-analytics.com/script.js";s.async=true;document.head.appendChild(s);});});`;

export const Route = createRootRoute({
  head: () => ({
    // … meta, links, styles from the port …
    scripts: [
      { children: themeScript },                              // from the port
      { src: "https://example.com/critical.js", async: true }, // load as soon as possible
      { children: lazyAnalytics },                             // like Next's lazyOnload
    ],
  }),
  // …
});
```

## caching

Give a route a `headers` function to set `Cache-Control` on its document response. Add `prerender` to `tanstackStart()` for pages that should be built ahead of time.

```tsx
// src/routes/$id.tsx
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/$id')({
  loader: ({ params }) => getBook(params.id),
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
  // …
})
```

Source: [TanStack Start: Incremental Static Regeneration (ISR)](https://tanstack.com/start/latest/docs/framework/react/guide/isr)

## route-prefetching

`defaultPreload: 'intent'` makes every router `<Link>` preload its route on hover or focus. The port's `FastLink` is a plain `<a>`, so it calls `router.preloadRoute()` itself on the same events.

```tsx
// src/router.tsx
const router = createTanStackRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})
```

```tsx
// src/components/ui/fast-link.tsx
const router = useRouter()

function warm() {
  const url = new URL(props.href, 'http://tanstack-solid-books.local')
  const id = url.pathname === '/' ? undefined : url.pathname.slice(1)
  const search = Object.fromEntries(url.searchParams)
  void router
    .preloadRoute(id ? { to: '/$id', params: { id }, search } : { to: '/', search })
    .catch(() => {})
}

return <a href={props.href} onFocus={warm} onMouseEnter={warm}>{props.children}</a>
```

Source: [TanStack Router: Preloading](https://tanstack.com/router/latest/docs/framework/solid/guide/preloading)

## reactivity

`createSignal` returns a getter and a setter. Reading `quantity()` in JSX subscribes that text node, so a click updates only that node. The component function does not run again.

```tsx
import { createSignal } from 'solid-js'

export function LineItem() {
  const [quantity, setQuantity] = createSignal(1)
  const price = 12

  return (
    <div>
      <button type="button" onClick={() => setQuantity(quantity() - 1)}>−</button>
      <span>{quantity()}</span>
      <button type="button" onClick={() => setQuantity(quantity() + 1)}>+</button>
      <p>Subtotal: ${quantity() * price}</p>
    </div>
  )
}
```

Source: [Solid: Reactivity](https://docs.solidjs.com/concepts/reactivity)

## bundle-analysis

Add `rollup-plugin-visualizer` to the plugin list. `vite build` then writes a treemap of the bundle to `stats.html`.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from '@solidjs/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteSolid({ ssr: true }),
    visualizer({ filename: 'stats.html', gzipSize: true }),
  ],
})
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)

## multi-host-deployment

The port picks one host plugin at build time: `@cloudflare/vite-plugin` on Cloudflare, `@netlify/vite-plugin-tanstack-start` on Netlify, and Nitro everywhere else (Vercel included).

```ts
// vite.config.ts
import { defineConfig, type PluginOption } from 'vite'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'
import viteSolid from '@solidjs/vite-plugin'
import { nitro } from 'nitro/vite'

const isCloudflare = Boolean(process.env.CLOUDFLARE || process.env.WORKERS_CI || process.env.CF_PAGES)
const isNetlify = Boolean(process.env.NETLIFY)

export default defineConfig(async () => {
  const plugins: PluginOption[] = []
  if (isCloudflare) {
    const { cloudflare } = await import('@cloudflare/vite-plugin')
    plugins.push(cloudflare({ viteEnvironment: { name: 'ssr' } }))
  } else if (isNetlify) {
    const netlify = (await import('@netlify/vite-plugin-tanstack-start')).default
    plugins.push(netlify())
  } else {
    plugins.push(nitro())
  }
  plugins.push(tanstackStart(), viteSolid({ ssr: true }))
  return { plugins }
})
```

Source: [TanStack Start: Hosting](https://tanstack.com/start/latest/docs/framework/solid/guide/hosting)

## service-worker

Put a hand-written worker in `public/` and register it with an inline script from the root route's `head`.

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

```tsx
// src/routes/__root.tsx
const swScript = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// …
    scripts: [{ children: themeScript }, { children: swScript }],
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · [TanStack Start document head](https://tanstack.com/router/latest/docs/framework/solid/guide/document-head-management)

## streaming-ssr

The server entry renders with `defaultStreamHandler`. A loader returns a slow promise without awaiting it, and `<Await>` shows its fallback until the promise resolves and the rest of the HTML streams in.

```tsx
// src/server.ts
import { createStartHandler, defaultStreamHandler } from '@tanstack/solid-start/server'
import { createServerEntry } from '@tanstack/solid-start/server-entry'

const processRequest = createStartHandler(defaultStreamHandler)
export default createServerEntry({ fetch: (request, opts) => processRequest(request, opts) })
```

```tsx
// src/routes/$id.tsx
import { createFileRoute, Await } from '@tanstack/solid-router'

export const Route = createFileRoute('/$id')({
  loader: async ({ params }) => ({
    book: await getBook(params.id),       // awaited: in the first chunk
    reviews: getReviews(params.id),       // not awaited: streamed later
  }),
  component: BookPage,
})

function BookPage() {
  const data = Route.useLoaderData()
  return (
    <>
      <h1>{data().book.title}</h1>
      <Await promise={data().reviews} fallback={<p>Loading reviews…</p>}>
        {(reviews) => <ul>{reviews.map((r) => <li>{r.text}</li>)}</ul>}
      </Await>
    </>
  )
}
```

Source: [TanStack Start: Server Entry Point](https://tanstack.com/start/latest/docs/framework/solid/guide/server-entry-point) · [TanStack Router: Deferred Data Loading](https://tanstack.com/router/latest/docs/framework/solid/guide/deferred-data-loading)

## early-hints

Pass `onEarlyHints` to `handler.fetch()` in the server entry. It receives the manifest's preload links, which you send with the runtime's 103 API. `responseLinkHeader: true` puts them in a `Link` header instead.

```tsx
// src/server.ts
import handler from '@tanstack/solid-start/server-entry'
import type { ServerRequest } from 'srvx'

export default {
  fetch(request: Request) {
    const serverRequest = request as ServerRequest
    return handler.fetch(request, {
      onEarlyHints: ({ phase, allLinks }) => {
        if (phase !== 'dynamic') return
        const response = serverRequest.runtime?.node?.res
        if (response?.writeEarlyHints && allLinks.length) {
          response.writeEarlyHints({ link: allLinks })
        }
      },
    })
  },
}
```

Source: [TanStack Start: Early Hints](https://tanstack.com/start/latest/docs/framework/solid/guide/early-hints)
