## css-inlining

Void has no option to inline CSS, so import the stylesheet with Vite's `?inline` query and print it in a `<style>` tag. Void does not add a `<link>` for a file imported this way.

```tsx
// pages/about.tsx
import criticalCss from './critical.css?inline'

export default function About() {
  return (
    <main>
      <style id="about-critical" innerHTML={criticalCss} />
      <h1>About</h1>
    </main>
  )
}
```

Source: [Vite: Disabling CSS injection into the page](https://vite.dev/guide/features#disabling-css-injection-into-the-page) · [Void: Head](https://void.cloud/guide/pages-routing/head)

## font-optimization

Install a Fontsource package so the font files become local build assets, then add the preload link from the page's `head`.

```ts
// pages/index.server.ts
import '@fontsource-variable/geist' // @font-face with font-display: swap
import fontUrl from '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url'
import { defineHead } from 'void'

export const head = defineHead(() => ({
  link: [{ rel: 'preload', href: fontUrl, as: 'font', type: 'font/woff2', crossorigin: 'anonymous' }],
}))
```

Source: [Fontsource: Install](https://fontsource.org/docs/getting-started/install) · [Void: Head](https://void.cloud/guide/pages-routing/head)

## image-pipeline

Void has no image component. Resize and re-encode at build time with `vite-imagetools` query imports, and write `width`, `height` and `loading` yourself. For remote covers, use `@unpic/solid` with an image CDN.

```tsx
// components/Cover.tsx
import srcset from './cover.jpg?w=320;640;960&format=webp&as=srcset'
import fallback from './cover.jpg?w=640&format=webp'

export function Cover(props: { title: string }) {
  return (
    <img src={fallback} srcset={srcset} sizes="320px" width={320} height={480} loading="lazy" decoding="async" alt={props.title} />
  )
}
```

Source: [vite-imagetools](https://github.com/JonasKruckenberg/imagetools) · [Unpic](https://unpic.pics/img/solid/)

## picture

Write the `<picture>` by hand. The `?as=srcset` imports give each `<source>` its own format or crop, and the `<img>` is the fallback.

```tsx
// components/Cover.tsx
import avif from './cover.jpg?w=320;640;960&format=avif&as=srcset'
import webp from './cover.jpg?w=320;640;960&format=webp&as=srcset'
import fallback from './cover.jpg?w=640&format=webp'

export function Cover(props: { title: string }) {
  return (
    <picture>
      <source type="image/avif" srcset={avif} sizes="320px" />
      <img src={fallback} srcset={webp} sizes="320px" width={320} height={480} alt={props.title} />
    </picture>
  )
}
```

Source: [vite-imagetools: as=srcset](https://github.com/JonasKruckenberg/imagetools/blob/main/docs/directives.md) · [MDN: `<picture>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/picture)

## caching

On Cloudflare, give a page a revalidate time and Void caches the rendered HTML (ISR); `revalidate({ paths })` from `void/isr` purges it. On Node, Bun and Deno ISR is ignored, so set `Cache-Control` with `routing.headers`.

```ts
// pages/index.server.ts
import { defineHandler } from 'void'

export const revalidate = 120 // seconds, Cloudflare target

export const loader = defineHandler(async () => ({ books: await listBooks() }))
```

```ts
// void.config.ts
import { defineConfig } from 'void/config'

export default defineConfig({
  routing: { headers: { '/': ['Cache-Control: public, s-maxage=120, stale-while-revalidate=600'] } },
})
```

Source: [Void: Revalidation](https://void.cloud/guide/edge/revalidation) · [Void: Headers](https://void.cloud/guide/edge/headers)

## route-prefetching

Add `prefetch` to `<Link>`. It loads the destination's code and runs its loader before the click. Strategies are `hover`, `click`, `mount` and `visible`, and `prefetch.defaultStrategy` on `voidSolid()` turns it on for every link.

```tsx
// components/BookLink.tsx
import { Link } from '@void/solid'

export function BookLink(props: { id: string; title: string }) {
  return <Link href={`/${props.id}`} prefetch="hover">{props.title}</Link>
}
```

Source: [Void: Prefetching](https://void.cloud/reference/api/pages#prefetching)

## streaming-ssr

Wrap a slow value in `defer()`. The page is sent first, and the value follows later in the same response. The Solid page gets an object with `loading`, `value` and `error`.

```ts
// pages/[id].server.ts
import { defer, defineHandler } from 'void'

export const loader = defineHandler(async (c) => ({
  book: await getBook(c.req.param('id')),
  reviews: defer(() => getReviews(c.req.param('id'))),
}))
```

```tsx
// pages/[id].tsx
export default function Book(props: Props) {
  return (
    <>
      <h1>{props.book.title}</h1>
      {props.reviews.loading ? <p>Loading reviews…</p> : props.reviews.error ? <p>Reviews failed to load.</p> : <Reviews items={props.reviews.value} />}
    </>
  )
}
```

Source: [Void: Deferred props](https://void.cloud/guide/pages-routing/loaders#deferred-props)

## early-hints

Void sends no 103 and no preload `Link` header. It only puts `<link rel="modulepreload">` tags in the HTML. Add the header yourself with `routing.headers`.

```ts
// void.config.ts
import { defineConfig } from 'void/config'

export default defineConfig({
  routing: { headers: { '/*': ['Link: </fonts/geist.woff2>; rel=preload; as=font; crossorigin'] } },
})
```

Source: [Void: Headers](https://void.cloud/guide/edge/headers)

## islands

Name the page `*.island.tsx` and import each interactive component with an `island` import attribute. Components imported without it render to HTML and ship no JavaScript. Island pages have no client router.

```tsx
// pages/about.island.tsx
import Counter from './_counter' with { island: 'visible' } // load | visible | idle | media:(query)
import StaticNote from './_static-note'

export default function About() {
  return (
    <main>
      <StaticNote />
      <Counter />
    </main>
  )
}
```

Source: [Void: Islands](https://void.cloud/guide/pages-routing/islands)

## render-modes

Pages render on each request by default. A page's `.server.ts` can turn off SSR or prerender it, and `output: 'static'` in `void.config.ts` prerenders every page unless it opts out.

```ts
// pages/account.server.ts: rendered in the browser only; the loader still runs on the server
export const ssr = false
```

```ts
// pages/about.server.ts: built to HTML (deploy-time on Cloudflare, build-time with output: 'static')
export const prerender = true
```

Source: [Void: Pages routing](https://void.cloud/guide/pages-routing/overview) · [Void: Static sites](https://void.cloud/guide/ssg) · [Void: Prerendering](https://void.cloud/guide/edge/prerendering)

## reactivity

`@void/solid` keeps Solid's signals: a `createSignal` change updates only the bound text, and the component function runs once. The adapter needs `solid-js` ^1.9 (Solid 1).

```tsx
// pages/counter.tsx
import { createSignal } from 'solid-js'

export default function Counter() {
  const [count, setCount] = createSignal(0)
  return <button onClick={() => setCount(count() + 1)}>Count: {count()}</button>
}
```

Source: [Void: Pages API](https://void.cloud/reference/api/pages) · [Solid: Signals](https://docs.solidjs.com/concepts/signals)

## bundle-analysis

Void has no analyze command. Add `rollup-plugin-visualizer` to `vite.config.ts` for the client build.

```ts
// vite.config.ts
import { voidSolid } from '@void/solid/plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import { voidPlugin } from 'void'

export default defineConfig({
  plugins: [
    voidPlugin(),
    voidSolid(),
    process.env.ANALYZE && { ...visualizer({ filename: 'dist/stats.html' }), applyToEnvironment: (env) => env.name === 'client' },
  ],
})
```

Source: [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer) · [Void: CLI](https://void.cloud/reference/cli)

## third-party-scripts

Void has no script-loading strategy. Add the tag from `head` with `defer` or `async`.

```ts
// pages/layout.server.ts or any page's .server.ts
import { defineHead } from 'void'

export const head = defineHead(() => ({
  script: [{ src: 'https://example.com/analytics.js', defer: 'defer' }],
}))
```

Source: [Void: Head](https://void.cloud/guide/pages-routing/head)

## multi-host-deployment

Set `target` in `void.config.ts`. `cloudflare` (the default) deploys with `void deploy`. `node`, `bun` and `deno` build a Hono server in `dist/ssr` that you host yourself, without ISR, edge prerendering or the D1, KV and R2 bindings. No Vercel or Netlify target is documented.

```ts
// void.config.ts
import { defineConfig } from 'void/config'

export default defineConfig({
  target: 'node', // 'cloudflare' | 'node' | 'bun' | 'deno'
})
```

```sh
npx vite build && node dist/ssr/index.js
```

Source: [Void: Config](https://void.cloud/reference/config) · [Void: Node.js, Bun and Deno](https://void.cloud/integrations/nodejs-bun-deno)

## service-worker

Void has no service worker support. Put a hand-written worker in `public/` and register it from client code.

```ts
// src/register-sw.ts, imported from a client component
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

Source: [Void: Static assets](https://void.cloud/guide/edge/static-assets)
