## picture

The `?jsx` image import only emits an `<img>`, so write `<picture>` in JSX yourself, with files served from `public/`. Qwik uses HTML attribute names such as `srcset`.

```tsx
// src/components/hero-image/hero-image.tsx
import { component$ } from '@builder.io/qwik'

export const HeroImage = component$(() => (
  <picture>
    {/* art direction: a square crop on narrow screens */}
    <source media="(max-width: 640px)" type="image/avif"
            srcset="/media/hero-square-640.avif" width={640} height={640} />
    {/* format fallback: AVIF, then WebP, then the <img> JPEG */}
    <source type="image/avif" sizes="100vw"
            srcset="/media/hero-1280.avif 1280w, /media/hero-1920.avif 1920w" />
    <source type="image/webp" sizes="100vw"
            srcset="/media/hero-1280.webp 1280w, /media/hero-1920.webp 1920w" />
    <img src="/media/hero-1280.jpg" alt="Shelves of books" width={1280} height={720}
         fetchPriority="high" decoding="async" />
  </picture>
))
```

Source: [MDN: the picture element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)

## css-inlining

Import the global stylesheet in `root.tsx`. In production Qwik inlines it when it is under `inlineStylesUpToBytes` (20 KB by default). Component styles registered with `useStylesScoped$` load only with the component.

```tsx
// src/root.tsx
import { component$ } from '@builder.io/qwik'
import { QwikCityProvider, RouterOutlet } from '@builder.io/qwik-city'
import { RouterHead } from './components/router-head/router-head'

import './styles/global.css' // inlined in production if < 20 KB (inlineStylesUpToBytes)

export default component$(() => (
  <QwikCityProvider>
    <head><meta charset="utf-8" /><RouterHead /></head>
    <body><RouterOutlet /></body>
  </QwikCityProvider>
))
```

```tsx
// src/components/card/card.tsx
import { component$, useStylesScoped$ } from '@builder.io/qwik'
import styles from './card.css?inline'

export const Card = component$(() => {
  useStylesScoped$(styles)
  return <div class="card">…</div>
})
```

Source: [Qwik: Styling](https://qwik.dev/docs/components/styles/)

## font-optimization

The Qwik cookbook points to Fontsource for self-hosted files and Fontaine for fallback metrics. Install `@fontsource-variable/open-sans` and `fontaine`, import the font in the root layout, and add the Fontaine Vite plugin.

```tsx
// src/routes/layout.tsx
import '@fontsource-variable/open-sans/wght.css'
// global.css: body { font-family: "Open Sans Variable", sans-serif; }
```

```ts
// vite.config.ts
import { FontaineTransform } from 'fontaine'
// …
plugins: [
  qwikCity(), qwikVite(),
  FontaineTransform.vite({
    fallbacks: ['Arial'],
    resolvePath: (id) => new URL(`./public${id}`, import.meta.url),
  }),
],
```

Source: [Qwik: Fonts cookbook](https://qwik.dev/docs/cookbook/fonts/), [Fontsource: Qwik guide](https://fontsource.org/docs/guides/qwik)

## image-pipeline

Add `?jsx` to a local image import to get a component. It renders an `<img>` with a webp `srcset` (200w to 1200w), `loading="lazy"`, `decoding="async"`, and width/height.

```tsx
// src/components/hero/hero.tsx
import { component$ } from '@builder.io/qwik'
import HeroImage from '~/media/hero.jpg?quality=80&jsx'

export const Hero = component$(() => (
  <HeroImage alt="Shelves of books" loading="eager" decoding="sync" />
))
```

Source: [Qwik: Image optimization](https://qwik.dev/docs/integrations/image-optimization/)

## caching

Call `cacheControl` in a layout's or route's `onGet` to set the `Cache-Control` header for every page under it. A nested layout can override it.

```tsx
// src/routes/layout.tsx
import type { RequestHandler } from '@builder.io/qwik-city'

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    public: true,
    maxAge: 5,
    sMaxAge: 10,
    staleWhileRevalidate: 60 * 60 * 24 * 365,
  })
}
```

Source: [Qwik: Caching responses](https://qwik.dev/docs/caching/)

## route-prefetching

`<Link>` starts prefetching the next page when the user hovers it. Set `prefetch={false}` to turn that off for one link.

```tsx
// src/components/nav/nav.tsx
import { component$ } from '@builder.io/qwik'
import { Link } from '@builder.io/qwik-city'

export const Nav = component$(() => (
  <nav>
    <Link href="/books">Books</Link>
    <Link href="/account" prefetch={false}>Account</Link>
  </nav>
))
```

Source: [Qwik: Routing](https://qwik.dev/docs/routing/)

## islands

Qwik components do not hydrate. The click handler below is serialized into the HTML and its code chunk loads on the first click. React components can still run as islands through `qwikify$` with a `client:*` prop.

```tsx
// src/components/counter/counter.tsx
import { component$, useSignal } from '@builder.io/qwik'

export const Counter = component$(() => {
  const count = useSignal(0)
  // no JS runs until the first click; then only this handler loads
  return <button onClick$={() => count.value++}>Increment {count.value}</button>
})
```

```tsx
// src/integrations/react/slider.tsx
/** @jsxImportSource react */
import { qwikify$ } from '@builder.io/qwik-react'
import { Slider } from '@mui/material'

export const MUISlider = qwikify$(Slider)
// usage in a Qwik component: <MUISlider client:visible />
```

Source: [Qwik: Resumable](https://qwik.dev/docs/concepts/resumable/), [Qwik: React integration](https://qwik.dev/docs/integrations/react/)

## render-modes

A dynamic route that exports `onStaticGenerate` is prerendered for the params it returns. On Cloudflare Pages, the adapter's `ssg.include` and `ssg.exclude` choose which paths are static; the rest render on request.

```tsx
// src/routes/product/[id]/index.tsx
import { component$ } from '@builder.io/qwik'
import { useLocation, type StaticGenerateHandler } from '@builder.io/qwik-city'

export default component$(() => <p>Product {useLocation().params.id}</p>)

export const onStaticGenerate: StaticGenerateHandler = async () => {
  return { params: [{ id: '1' }, { id: '2' }] }
}
```

```ts
// adapters/cloudflare-pages/vite.config.ts
plugins: [
  cloudflarePagesAdapter({
    ssg: { include: ['/*'], exclude: ['/shop/*'], origin: 'https://example.com' },
  }),
],
```

Source: [Qwik: Static site generation](https://qwik.dev/docs/guides/static-site-generation/), [Qwik: Cloudflare Pages adapter](https://qwik.dev/docs/deployments/cloudflare-pages/)

## reactivity

`useSignal` and `useStore` are tracked. Changing a value updates the parts of the DOM that read it.

```tsx
// src/components/counter/counter.tsx
import { component$, useSignal, useStore } from '@builder.io/qwik'

export const Counter = component$(() => {
  const count = useSignal(0)
  const state = useStore({ name: 'Qwik' })
  return (
    <>
      <button onClick$={() => count.value++}>Increment {count.value}</button>
      <input value={state.name} onInput$={(_, el) => (state.name = el.value)} />
    </>
  )
})
```

Source: [Qwik: State](https://qwik.dev/docs/components/state/)

## bundle-analysis

Qwik has no analyzer of its own. Add `rollup-plugin-visualizer` to the base Vite config; `vite build` then writes a treemap of the client bundles.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { qwikVite } from '@builder.io/qwik/optimizer'
import { qwikCity } from '@builder.io/qwik-city/vite'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(() => ({
  plugins: [
    qwikCity(),
    qwikVite(),
    visualizer({ filename: 'stats.html', template: 'treemap', gzipSize: true }),
  ],
}))
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer), [Qwik: Bundle optimization](https://qwik.dev/docs/guides/bundle/)

## third-party-scripts

`qwik add partytown` creates a `QwikPartytown` component. Render it in the head with the globals to forward, and mark scripts `type="text/partytown"` so they run in a web worker.

```tsx
// src/root.tsx
import { QwikPartytown } from './components/partytown/partytown'
// …
<head>
  <QwikPartytown forward={['gtag', 'dataLayer.push']} />
  <script async type="text/partytown"
          src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX" />
  <RouterHead />
</head>
```

Source: [Qwik: Partytown](https://qwik.dev/docs/integrations/partytown/)

## multi-host-deployment

`qwik add express` (or `vercel-edge`, `netlify-edge`, `cloudflare-pages`) writes an adapter config that extends the base Vite config. The Books port keeps one per host under `adapters/`.

```ts
// adapters/express/vite.config.ts
import { nodeServerAdapter } from '@builder.io/qwik-city/adapters/node-server/vite'
import { extendConfig } from '@builder.io/qwik-city/vite'
import baseConfig from '../../vite.config'

export default extendConfig(baseConfig, () => ({
  build: {
    ssr: true,
    rollupOptions: { input: ['src/entry.express.tsx', '@qwik-city-plan'] },
  },
  plugins: [nodeServerAdapter({ name: 'express' })],
}))
```

Source: [Qwik: Node middleware deployment](https://qwik.dev/docs/deployments/node/)

## early-hints

Set a `Link` header in the root layout's `onGet` handler. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```tsx
// src/routes/layout.tsx
import type { RequestHandler } from '@builder.io/qwik-city'

export const onGet: RequestHandler = async ({ headers }) => {
  headers.set('Link', '<https://fonts.gstatic.com>; rel=preconnect; crossorigin')
}
```

Source: [Qwik City: caching and response headers](https://qwik.dev/docs/caching/)

## streaming-ssr

Return an async function from `routeLoader$` and render it with `<Resource>`. The HTML above the resource streams first, and the rest follows when the data resolves.

```tsx
// src/routes/books/[id]/index.tsx
import { Resource, component$ } from '@builder.io/qwik'
import { routeLoader$ } from '@builder.io/qwik-city'

export const useReviews = routeLoader$(({ params }) => {
  // returning a function defers it: rendering doesn't wait here
  return async () => {
    const res = await fetch(`https://api.example.com/books/${params.id}/reviews`)
    return (await res.json()) as { id: string; text: string }[]
  }
})

export default component$(() => {
  const reviews = useReviews()
  return (
    <>
      <h1>Reviews</h1>
      <Resource
        value={reviews}
        onPending={() => <p>Loading…</p>}
        onResolved={(list) => <ul>{list.map((r) => <li key={r.id}>{r.text}</li>)}</ul>}
      />
    </>
  )
})
```

Source: [Qwik: Streaming deferred loaders](https://qwik.dev/docs/cookbook/streaming-deferred-loaders/)

## service-worker

`@qwikdev/pwa` adds a `qwikPwa()` Vite plugin and a `setupPwa()` call in the service worker route. It precaches the built `q-*.js` files, images and `public/` assets.

```ts
// vite.config.ts (npm install -D @qwikdev/pwa)
import { qwikPwa } from '@qwikdev/pwa'
// …
plugins: [qwikCity(), qwikVite(), qwikPwa()],
```

```ts
// src/routes/service-worker.ts
import { setupServiceWorker } from '@builder.io/qwik-city/service-worker'
import { setupPwa } from '@qwikdev/pwa/sw'

setupServiceWorker()
setupPwa()
```

Source: [QwikDev/pwa README](https://github.com/QwikDev/pwa)
