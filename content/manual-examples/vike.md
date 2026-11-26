## css-inlining

Import the critical stylesheet with Vite's `?inline` query and print it in a `<style>` tag from `+Head`. Vike does not inject a `<link>` for a CSS file imported this way.

```tsx
// pages/+Head.tsx
import criticalCss from './critical.css?inline'

export function Head() {
  return <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
}
```

Source: [Vite: Disabling CSS injection into the page](https://vite.dev/guide/features#disabling-css-injection-into-the-page) · [Vike: Preloading](https://vike.dev/preloading)

## font-optimization

Install a Fontsource package and import it from `+Layout`. The font files are then local build assets, and Vike adds a `<link rel="preload" as="font">` for them.

```tsx
// pages/+Layout.tsx
import '@fontsource-variable/inter'
import './Layout.css' // body { font-family: "Inter Variable", sans-serif; }

export function Layout({ children }: { children: React.ReactNode }) {
  return <div id="app">{children}</div>
}
```

Source: [Fontsource: Install](https://fontsource.org/docs/getting-started/install) · [Vike: Preloading](https://vike.dev/preloading)

## image-pipeline

Use `<Image>` from `@unpic/react`. It builds a `srcset` for the image CDN that serves the URL and sets width, height and lazy loading.

```tsx
// pages/book/@id/+Page.tsx
import { Image } from '@unpic/react'
import { useData } from 'vike-react/useData'

export function Page() {
  const book = useData<{ title: string; coverUrl: string }>()
  return (
    <Image src={book.coverUrl} layout="constrained" width={400} height={600} alt={book.title} priority />
  )
}
```

Source: [Unpic: React](https://unpic.pics/img/react/)

## picture

Vike has no image component, so write `<picture>` in the page. With `@unpic/react`, each `<Source>` gets a `media` query and its own crop, and `<Image>` is the fallback.

```tsx
// pages/book/@id/BookCover.tsx
import { Image, Source } from '@unpic/react'

export function BookCover({ title, coverUrl, wideUrl }: { title: string; coverUrl: string; wideUrl: string }) {
  return (
    <picture>
      {/* art direction: a wide banner crop on large screens */}
      <Source media="(min-width: 768px)" src={wideUrl} layout="constrained" width={1200} height={400} />
      <Image src={coverUrl} alt={title} layout="constrained" width={400} height={600} priority />
    </picture>
  )
}
```

Source: [Unpic: React](https://unpic.pics/img/react/) · [MDN: the picture element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)

## caching

`prerender: true` builds pages to HTML. A dynamic page sets `Cache-Control` with `+headersResponse`. On Vercel, a page's `+config` can opt into ISR.

```ts
// pages/+config.ts
export default { prerender: true }

// pages/search/+config.ts
export default { prerender: false }

// pages/search/+headersResponse.ts
export function headersResponse() {
  return { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600' }
}

// pages/book/@id/+config.ts (Vercel only, with vite-plugin-vercel)
export default { vercel: { isr: { expiration: 30 } } }
```

Source: [Vike: Pre-rendering](https://vike.dev/pre-rendering) · [Vike: headersResponse](https://vike.dev/headersResponse) · [Vike: Vercel](https://vike.dev/vercel)

## route-prefetching

`prefetchStaticAssets` sets when a link's page assets are prefetched. A link can override it with `data-prefetch-static-assets`, and `prefetch()` starts it from code.

```tsx
// pages/+config.ts
export default { prefetchStaticAssets: 'viewport' }

// components/BookLink.tsx
import { prefetch } from 'vike/client/router'

export function BookLink({ id }: { id: string }) {
  return (
    <a href={`/book/${id}`} data-prefetch-static-assets="hover" onFocus={() => prefetch(`/book/${id}`)}>
      Details
    </a>
  )
}
```

Source: [Vike: prefetchStaticAssets](https://vike.dev/prefetchStaticAssets) · [Vike: prefetch()](https://vike.dev/prefetch)

## streaming-ssr

Set `stream: true` in `+config`. With `vike-react-query`, a component that calls `useSuspenseQuery()` streams in later, and `withFallback()` gives it a loading fallback.

```tsx
// pages/+config.ts
import vikeReact from 'vike-react/config'
import vikeReactQuery from 'vike-react-query/config'

export default { extends: [vikeReact, vikeReactQuery], stream: true }

// pages/book/@id/Reviews.tsx
import { useSuspenseQuery } from '@tanstack/react-query'
import { withFallback } from 'vike-react-query'

export const Reviews = withFallback(
  ({ id }: { id: string }) => {
    const { data } = useSuspenseQuery({
      queryKey: ['reviews', id],
      queryFn: () => fetch(`/api/reviews/${id}`).then((r) => r.json()),
    })
    return <ul>{data.map((r: { id: string; text: string }) => <li key={r.id}>{r.text}</li>)}</ul>
  },
  () => <p>Loading reviews…</p>,
)
```

Source: [Vike: stream](https://vike.dev/stream) · [vike-react-query README](https://github.com/vikejs/vike-react/tree/main/packages/vike-react-query)

## early-hints

`renderPage()` returns the page's assets in `pageContext.httpResponse.earlyHints`. Pass their `earlyHintLink` values to the runtime's 103 API before sending the body.

```ts
// server.ts
import { renderPage } from 'vike/server'

app.get('*', async (req, res) => {
  const pageContext = await renderPage({ urlOriginal: req.originalUrl })
  const { earlyHints } = pageContext.httpResponse
  // For example with Node.js 18:
  res.writeEarlyHints({ link: earlyHints.map((e) => e.earlyHintLink) })
  // … then send pageContext.httpResponse as usual
})
```

Source: [Vike: Preloading](https://vike.dev/preloading)

## islands

Make the page HTML-only so it ships no page JavaScript. Then `+client.tsx`, the page's only browser code, hydrates each marked component by hand.

```tsx
// renderer/+config.ts
export default {
  meta: { Page: { env: { server: true, client: false } } }, // HTML-only
}

// pages/about/+Page.tsx (server only)
<div data-island="like" data-props={JSON.stringify({ bookId })}>
  <LikeButton bookId={bookId} />
</div>

// pages/about/+client.tsx
import { hydrateRoot } from 'react-dom/client'
import { LikeButton } from '../../components/LikeButton'

for (const el of document.querySelectorAll<HTMLElement>('[data-island="like"]')) {
  hydrateRoot(el, <LikeButton {...JSON.parse(el.dataset.props!)} />)
}
```

Source: [Vike: Render Modes](https://vike.dev/render-modes) · [Vike: +client.js](https://vike.dev/client)

## render-modes

Put `ssr` and `prerender` in a directory's `+config`. The setting applies to every page under that directory.

```ts
// pages/+config.ts (all pages: SSR, pre-rendered)
export default { prerender: true }

// pages/admin/+config.ts (admin pages: SPA, not pre-rendered)
export default { ssr: false, prerender: false }

// pages/search/+config.ts (search: SSR on each request, streamed)
export default { prerender: false, stream: true }
```

Source: [Vike: ssr](https://vike.dev/ssr) · [Vike: Pre-rendering](https://vike.dev/pre-rendering) · [Vike: stream](https://vike.dev/stream)

## reactivity

With `vike-react`, add the React Compiler to the Vite config. It memoizes components and values at build time, so a state change re-renders less.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vike from 'vike/plugin'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    vike(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
```

Source: [React: React Compiler installation](https://react.dev/learn/react-compiler/installation) · [Vike: vike-react](https://vike.dev/vike-react)

## bundle-analysis

Add `rollup-plugin-visualizer` next to the Vike plugin. `vike build` then writes a treemap of the bundle to `stats.html`.

```ts
// vite.config.ts
import vike from 'vike/plugin'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default {
  plugins: [vike(), react(), visualizer({ filename: 'stats.html', gzipSize: true })],
}
```

Source: [rollup-plugin-visualizer README](https://github.com/btd/rollup-plugin-visualizer)

## third-party-scripts

Put scripts that should load early in `+Head` with `async`. Load the rest from `+client.ts` once the page has loaded and the browser is idle.

```tsx
// pages/+Head.tsx
export function Head() {
  return <script async src="https://example.com/critical.js" />
}

// pages/+client.ts
addEventListener('load', () => {
  requestIdleCallback(() => {
    const s = document.createElement('script')
    s.src = 'https://example-analytics.com/script.js'
    s.async = true
    document.head.append(s)
  })
})
```

Source: [Vike: Head tags](https://vike.dev/head-tags) · [Vike: +client.js](https://vike.dev/client)

## multi-host-deployment

`server: true` uses Vike's built-in server on Node, Bun or Deno. For Cloudflare or Vercel, add that host's Vite plugin.

```ts
// pages/+config.ts (self-host: node ./dist/server/index.mjs)
export default { server: true }

// vite.config.ts (Cloudflare)
import vike from 'vike/plugin'
import { cloudflare } from '@cloudflare/vite-plugin'

export default {
  plugins: [cloudflare({ viteEnvironment: { name: 'ssr' } }), vike()],
}

// vite.config.ts (Vercel)
import { vercel } from 'vite-plugin-vercel/vite'

export default { plugins: [vike(), vercel()] }
```

Source: [Vike: +server](https://vike.dev/server) · [Vike: Cloudflare](https://vike.dev/cloudflare) · [Vike: Vercel](https://vike.dev/vercel)

## service-worker

Write the worker in `public/sw.js`, which Vite serves at `/sw.js`. Register it from `+client.ts`.

```js
// public/sw.js
const CACHE = 'v1'
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    caches.match(event.request).then((hit) =>
      hit ?? fetch(event.request).then((res) => {
        caches.open(CACHE).then((c) => c.put(event.request, res.clone()))
        return res
      }),
    ),
  )
})
```

```ts
// pages/+client.ts
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
```

Source: [Vike: Static directory](https://vike.dev/static-directory) · [MDN: Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
