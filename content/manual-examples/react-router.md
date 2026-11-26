## picture

There is no image component, so write `<picture>` in a route or component, with files served from `public/`. React spells the attribute `srcSet`.

```tsx
// app/features/home/hero-image.tsx
export function HeroImage() {
  return (
    <picture>
      {/* art direction: a square crop on narrow screens */}
      <source media="(max-width: 640px)" type="image/avif"
              srcSet="/media/hero-square-640.avif" width={640} height={640} />
      {/* format fallback: AVIF, then WebP, then the <img> JPEG */}
      <source type="image/avif" sizes="100vw"
              srcSet="/media/hero-1280.avif 1280w, /media/hero-1920.avif 1920w" />
      <source type="image/webp" sizes="100vw"
              srcSet="/media/hero-1280.webp 1280w, /media/hero-1920.webp 1920w" />
      <img src="/media/hero-1280.jpg" alt="Shelves of books" width={1280} height={720}
           fetchPriority="high" decoding="async" />
    </picture>
  )
}
```

Source: [MDN: the picture element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)

## css-inlining

Import the stylesheet with Vite's `?inline` query instead of the port's `?url`, and render it in a `<style>` in the root `Layout`. The string also ships in the client bundle, so keep it small.

```tsx
// app/root.tsx
import appCss from './styles/global.css?inline'
// …
export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
  // no { rel: 'stylesheet' } entry: the CSS is inlined below
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
        <style dangerouslySetInnerHTML={{ __html: appCss }} />
      </head>
      {/* … */}
    </html>
  )
}
```

Source: [Vite: disabling CSS injection](https://vite.dev/guide/features.html#disabling-css-injection-into-the-page)

## third-party-scripts

`<Scripts />` only renders the app runtime, so write the tags yourself: `async` in `Layout` for early scripts, or inject in a `useEffect` after hydration.

```tsx
// app/root.tsx
import { useEffect } from 'react'
// …
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* … */}
        {/* React 19 hoists and de-duplicates <script async src> */}
        <script async src="https://plausible.io/js/script.js" data-domain="books.example" />
      </head>
      {/* … */}
    </html>
  )
}

export default function App() {
  useEffect(() => {
    // Client only, after hydration: load the chat widget when the browser is idle.
    ;(window.requestIdleCallback ?? setTimeout)(() => {
      const s = document.createElement('script')
      s.src = 'https://widget.example.com/chat.js'
      s.async = true
      document.body.append(s)
    })
  }, [])
  // …
}
```

Source: [React: the script component](https://react.dev/reference/react-dom/components/script)

## font-optimization

The port installs Fontsource's variable Geist packages and imports them at the top of the global stylesheet. The packages ship the `@font-face` rules and self-hosted font files, and Vite bundles them like any other CSS import.

```css
/* app/styles/global.css */
@import '@fontsource-variable/geist';
@import '@fontsource-variable/geist-mono';
@import 'tailwindcss';

@theme {
  /* … */
  --font-geist-sans: 'Geist Variable', 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-geist-mono: 'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace;
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

Source: [Fontsource: Installing fonts](https://fontsource.org/docs/getting-started/install)

## image-pipeline

Install `@unpic/react` and render its `<Image>` in place of `<img>`. When it recognizes the image CDN in the URL, it writes a responsive `srcset` that asks the CDN for each width. It also sets `sizes`, dimensions and lazy loading.

```tsx
// app/features/book/components/book-cover.tsx
import { Image } from '@unpic/react'

export function BookCover({ src, title }: { src: string; title: string }) {
  return (
    <Image
      src={src}
      layout="constrained"
      width={300}
      height={450}
      alt={title}
    />
  )
}
```

Source: [Unpic: @unpic/react](https://unpic.pics/img/react/)

## caching

Export `headers` from a route module to set `Cache-Control` on that route's document response. A child route can read `parentHeaders` and overwrite one value.

```tsx
// app/routes/book.tsx
import type { Route } from './+types/book'

export function headers({ parentHeaders }: Route.HeadersArgs) {
  parentHeaders.set(
    'Cache-Control',
    'max-age=3600, s-maxage=86400',
  )
  return parentHeaders
}
```

Source: [React Router: HTTP Headers](https://reactrouter.com/how-to/headers)

## route-prefetching

Set `prefetch` on `<Link>`. `"intent"` loads the route module and data on hover or focus, `"viewport"` when the link scrolls into view, and `"render"` as soon as it renders. The port wraps `<Link>` in its own `FastLink`.

```tsx
// app/components/ui/fast-link.tsx
import { Link } from 'react-router'
// …
export function FastLink({ href, prefetch = 'intent', ...rest }: Props) {
  return (
    <Link
      prefetch={prefetch === false ? 'none' : prefetch === true ? 'intent' : prefetch}
      to={href}
      {...rest}
    />
  )
}
```

Source: [React Router: Link](https://reactrouter.com/api/components/Link)

## islands

Swap `reactRouter()` for the unstable RSC plugin and add `@vitejs/plugin-rsc` after it. Route modules then render as React Server Components, and only `'use client'` modules ship JavaScript.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { unstable_reactRouterRSC as reactRouterRSC } from '@react-router/dev/vite'
import rsc from '@vitejs/plugin-rsc'

export default defineConfig({
  plugins: [reactRouterRSC(), rsc()],
})
```

Source: [React Router: React Server Components](https://reactrouter.com/how-to/react-server-components)

## render-modes

List the URLs to prerender at build time. Those paths become static HTML, and every other path is server-rendered because `ssr` stays `true`.

```ts
// react-router.config.ts
import type { Config } from '@react-router/dev/config'

export default {
  // Can be omitted - defaults to true
  ssr: true,
  prerender: ['/', '/blog', '/blog/popular-post'],
} satisfies Config
```

Source: [React Router: Pre-Rendering](https://reactrouter.com/how-to/pre-rendering)

## reactivity

Add the React Compiler's Babel plugin next to `reactRouter()`. The compiler memoizes components and hooks at build time, so fewer components re-render when state changes.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import babel from 'vite-plugin-babel'
import { reactRouter } from '@react-router/dev/vite'

export default defineConfig({
  plugins: [
    reactRouter(),
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        presets: ['@babel/preset-typescript'],
        plugins: [['babel-plugin-react-compiler', {}]],
      },
    }),
  ],
})
```

Source: [React: React Compiler installation](https://react.dev/learn/react-compiler/installation)

## bundle-analysis

Add `rollup-plugin-visualizer` to the Vite config. `react-router build` then writes a treemap of the client bundle to `stats.html`.

```ts
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    reactRouter(),
    visualizer({ filename: 'stats.html', gzipSize: true }),
  ],
})
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)

## multi-host-deployment

The port picks a host plugin from environment variables at build time. Cloudflare uses `@cloudflare/vite-plugin`, Netlify uses its own React Router plugin, and Vercel uses the `vercelPreset()` in `react-router.config.ts`.

```ts
// vite.config.ts
import { reactRouter } from '@react-router/dev/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import netlifyReactRouter from '@netlify/vite-plugin-react-router'
import { defineConfig, type PluginOption } from 'vite'

const env = process.env
const isCloudflare = !!(env.CLOUDFLARE || env.WORKERS_CI || env.CF_PAGES)
const isNetlify = !!env.NETLIFY && !isCloudflare

const hostPlugins: PluginOption[] = isCloudflare
  ? [cloudflare({ viteEnvironment: { name: 'ssr' } })]
  : isNetlify
    ? [netlifyReactRouter()]
    : []

export default defineConfig({
  plugins: [...hostPlugins, reactRouter()],
})
```

Source: [React Router: Deploying](https://reactrouter.com/start/framework/deploying)

## service-worker

Put a hand-written worker in `public/` and register it with an inline script in the root route.

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
// app/root.tsx
const swScript = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// … in <head>
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)

## early-hints

Export `headers` from a route module and return a `Link` header. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```tsx
// app/routes/home.tsx
export function headers() {
  return { Link: '<https://fonts.gstatic.com>; rel=preconnect; crossorigin' };
}
```

Source: [React Router: HTTP headers](https://reactrouter.com/how-to/headers)

## streaming-ssr

The loader awaits the critical data and returns the slow promise as-is. The component renders that promise with `<Await>` inside `<Suspense>`, so the fallback goes out first.

```tsx
// app/routes/book.tsx
import { Suspense } from 'react'
import { Await } from 'react-router'
import type { Route } from './+types/book'

export async function loader({ params }: Route.LoaderArgs) {
  const reviews = getReviews(params.id) // NOT awaited
  const book = await getBook(params.id)
  return { book, reviews }
}

export default function Book({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <h1>{loaderData.book.title}</h1>
      <Suspense fallback={<p>Loading reviews…</p>}>
        <Await resolve={loaderData.reviews}>
          {(reviews) => <ul>{reviews.map((r) => <li key={r.id}>{r.text}</li>)}</ul>}
        </Await>
      </Suspense>
    </>
  )
}
```

Source: [React Router: Streaming with Suspense](https://reactrouter.com/how-to/suspense)
