## css-inlining

Void has no CSS inlining of its own, but the Svelte compiler does: `<svelte:options css="injected" />` puts the component's styles in an inline `<style>` in the server-rendered HTML. Set `compilerOptions.css: 'injected'` through `voidSvelte({ svelte: { ... } })` to do it for every component. Global stylesheets imported from a layout stay linked files.

```svelte
<!-- pages/about.svelte -->
<svelte:options css="injected" />

<main>
  <h1>About</h1>
</main>

<style>
  h1 { font-size: 2rem; }
</style>
```

Source: [Svelte: svelte:options](https://svelte.dev/docs/svelte/svelte-options) · [Void: SSR](https://void.cloud/guide/ssr)

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

Void has no image component. For remote covers, use `@unpic/svelte` with an image CDN; for local files, resize and re-encode at build time with `vite-imagetools` query imports. Either way write `width`, `height` and `loading` yourself.

```svelte
<!-- components/Cover.svelte -->
<script lang="ts">
  import { Image } from '@unpic/svelte'
  let { src, title } = $props()
</script>

<Image {src} cdn="ipx" layout="fixed" width={320} height={480} loading="lazy" alt={title} />
```

Source: [Unpic](https://unpic.pics/img/svelte/) · [vite-imagetools](https://github.com/JonasKruckenberg/imagetools)

## picture

Write the `<picture>` by hand. The `?as=srcset` imports give each `<source>` its own format or crop, and the `<img>` is the fallback.

```svelte
<!-- components/Cover.svelte -->
<script lang="ts">
  import avif from './cover.jpg?w=320;640;960&format=avif&as=srcset'
  import webp from './cover.jpg?w=320;640;960&format=webp&as=srcset'
  import fallback from './cover.jpg?w=640&format=webp'
  let { title } = $props()
</script>

<picture>
  <source type="image/avif" srcset={avif} sizes="320px" />
  <img src={fallback} srcset={webp} sizes="320px" width="320" height="480" alt={title} />
</picture>
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

Add `prefetch` to `<Link>`. It loads the destination's code and runs its loader before the click. Strategies are `hover`, `click`, `mount` and `visible`, and `prefetch.defaultStrategy` on `voidSvelte()` turns it on for every link.

```svelte
<!-- components/BookLink.svelte -->
<script lang="ts">
  import { Link } from '@void/svelte'
  let { id, title } = $props()
</script>

<Link href={`/${id}`} prefetch="hover">{title}</Link>
```

Source: [Void: Prefetching](https://void.cloud/reference/api/pages#prefetching)

## streaming-ssr

Wrap a slow value in `defer()`. The page is sent first, and the value follows later in the same response. The Svelte page gets an object with `loading`, `value` and `error`.

```ts
// pages/[id].server.ts
import { defer, defineHandler } from 'void'

export const loader = defineHandler(async (c) => ({
  book: await getBook(c.req.param('id')),
  reviews: defer(() => getReviews(c.req.param('id'))),
}))
```

```svelte
<!-- pages/[id].svelte -->
<script lang="ts">
  let { book, reviews } = $props()
</script>
<h1>{book.title}</h1>
{#if reviews.loading}<p>Loading reviews…</p>{:else}<Reviews items={reviews.value} />{/if}
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

Name the page `*.island.svelte` and import each interactive component with an `island` import attribute. Components imported without it render to HTML and ship no JavaScript. Island pages have no client router.

```svelte
<!-- pages/about.island.svelte -->
<script lang="ts">
  import Counter from './_Counter.svelte' with { island: 'visible' } // load | visible | idle | media:(query)
  import StaticNote from './_StaticNote.svelte'
</script>

<main>
  <StaticNote />
  <Counter />
</main>
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

`@void/svelte` keeps Svelte 5 runes: `$state` updates only the DOM nodes that read it, and the component script runs once.

```svelte
<!-- pages/counter.svelte -->
<script lang="ts">
  let count = $state(0)
</script>

<button onclick={() => count++}>Count: {count}</button>
```

Source: [Void: Pages API](https://void.cloud/reference/api/pages) · [Svelte: $state](https://svelte.dev/docs/svelte/$state)

## bundle-analysis

Void has no analyze command. Add `rollup-plugin-visualizer` to `vite.config.ts` for the client build.

```ts
// vite.config.ts
import { voidSvelte } from '@void/svelte/plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import { voidPlugin } from 'void'

export default defineConfig({
  plugins: [
    voidPlugin(),
    voidSvelte(),
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
