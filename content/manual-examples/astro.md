## picture

`<Picture />` handles formats, not breakpoints. Astro's recipe calls `getImage()` once per crop and writes the `<picture>` by hand.

```astro
---
// src/components/Hero.astro
import { getImage } from "astro:assets";
import wide from "../assets/hero-wide.jpg";
import square from "../assets/hero-square.jpg";

const desktop = await getImage({ src: wide, width: 1600, format: "avif" });
const mobile = await getImage({ src: square, width: 600, format: "webp" });
const fallback = await getImage({ src: square, width: 600 });
---
<picture>
  <source media="(min-width: 768px)" srcset={desktop.src} type="image/avif" />
  <source srcset={mobile.src} type="image/webp" />
  <img src={fallback.src} {...fallback.attributes} alt="Shelves of books" />
</picture>
```

Source: [Astro: build a custom image component](https://docs.astro.build/en/recipes/build-custom-img-component/)

## css-inlining

`build.inlineStylesheets` controls whether project CSS ships as `<style>` tags or linked files. `'always'` inlines every stylesheet; the default `'auto'` inlines only files under Vite's 4kB `assetsInlineLimit`.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    inlineStylesheets: 'always', // 'auto' (default) | 'never'
  },
});
```

Source: [Astro: configuration reference, build.inlineStylesheets](https://docs.astro.build/en/reference/configuration-reference/#buildinlinestylesheets)

## font-optimization

Register the font in the top-level `fonts` config, then render `<Font />` in the layout head. Astro downloads and serves the files itself, and `preload` adds a preload link.

```js
// astro.config.mjs
import { defineConfig, fontProviders } from 'astro/config';

export default defineConfig({
  fonts: [{
    provider: fontProviders.fontsource(),
    name: 'Roboto',
    cssVariable: '--font-roboto',
  }],
});
```

```astro
---
// src/layouts/Layout.astro
import { Font } from 'astro:assets';
---
<html>
  <head>
    <Font cssVariable="--font-roboto" preload />
  </head>
  <body><slot /></body>
</html>
```

Source: [Astro: Using custom fonts](https://docs.astro.build/en/guides/fonts/)

## image-pipeline

`<Image />` from `astro:assets` resizes and converts imported local images at build time. `layout="constrained"` adds a responsive `srcset`, and `image.domains` lets remote images through the same pipeline.

```astro
---
// src/components/Cover.astro
import { Image } from 'astro:assets';
import cover from '../assets/cover.jpg';
---
<Image src={cover} alt="Book cover" layout="constrained" width={800} height={600} />
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  image: {
    domains: ['covers.example.com'],
  },
});
```

Source: [Astro: Images](https://docs.astro.build/en/guides/images/)

## caching

Pick a cache provider in the config, then set cache options from an on-demand page. `routeRules` sets defaults for groups of routes, and `cache.invalidate()` purges by tag or path.

```js
// astro.config.mjs
import { defineConfig, memoryCache } from 'astro/config';

export default defineConfig({
  cache: { provider: memoryCache() },
  routeRules: {
    '/books/[...slug]': { maxAge: 3600, tags: ['books'] },
  },
});
```

```astro
---
// src/pages/index.astro
export const prerender = false;
Astro.cache.set({ maxAge: 120, swr: 60, tags: ['home'] });
---
```

```ts
// src/pages/api/revalidate.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async (context) => {
  await context.cache.invalidate({ tags: ['books'] });
  return new Response(null, { status: 204 });
};
```

Source: [Astro: Route caching](https://docs.astro.build/en/guides/caching/)

## route-prefetching

`prefetch: true` turns on the prefetch script. Links opt in with `data-astro-prefetch` and a strategy, or `prefetchAll` covers every link.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';

export default defineConfig({
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'viewport', // 'hover' (default) | 'tap' | 'viewport' | 'load'
  },
});
```

```astro
<!-- src/components/Nav.astro -->
<a href="/books" data-astro-prefetch="tap">Books</a>
<a href="/account" data-astro-prefetch="false">Account</a>
```

Source: [Astro: Prefetch](https://docs.astro.build/en/guides/prefetch/)

## islands

Components render to HTML with no client JS unless a `client:*` directive hydrates them. `server:defer` turns an Astro component into a server island that renders after the page, with fallback content until it arrives.

```astro
---
// src/pages/index.astro
import Counter from '../components/Counter.jsx';
import Avatar from '../components/Avatar.astro';
import GenericAvatar from '../components/GenericAvatar.astro';
---
<Counter client:visible />

<Avatar server:defer>
  <GenericAvatar slot="fallback" />
</Avatar>
```

Source: [Astro: Server islands](https://docs.astro.build/en/guides/server-islands/)

## render-modes

Pages prerender by default. `export const prerender = false` renders one page on demand; with `output: 'server'`, `prerender = true` opts a page back into static output.

```astro
---
// src/pages/[id].astro
export const prerender = false; // render on each request (needs an adapter)

const { id } = Astro.params;
---
<h1>Book {id}</h1>
```

Source: [Astro: On-demand rendering](https://docs.astro.build/en/guides/on-demand-rendering/)

## reactivity

`.astro` components have no client state. Add a UI framework integration (here Solid via `astro add solid`) and use its signals inside an island.

```tsx
// src/components/Counter.tsx
import { createSignal } from 'solid-js';

export default function Counter() {
  const [count, setCount] = createSignal(0);
  return <button onClick={() => setCount(count() + 1)}>Clicked {count()}</button>;
}
```

```astro
---
// src/pages/index.astro
import Counter from '../components/Counter';
---
<Counter client:load />
```

Source: [Astro: @astrojs/solid-js](https://docs.astro.build/en/guides/integrations-guide/solid-js/)

## bundle-analysis

Astro's recipe adds `rollup-plugin-visualizer` as a Vite plugin. `astro build` then writes `stats.html`. The report covers the whole site, not each page.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  vite: {
    plugins: [visualizer({ emitFile: true, filename: 'stats.html' })],
  },
});
```

Source: [Astro: Analyze bundle size](https://docs.astro.build/en/recipes/analyze-bundle-size/)

## third-party-scripts

Install the integration with `npx astro add partytown`, then mark scripts `type="text/partytown"` so they run in a web worker. `forward` exposes globals such as `dataLayer.push` to the worker.

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import partytown from '@astrojs/partytown';

export default defineConfig({
  integrations: [partytown({ config: { forward: ['dataLayer.push'] } })],
});
```

```astro
<!-- src/layouts/Layout.astro -->
<script type="text/partytown" src="https://example.com/analytics.js"></script>
```

Source: [Astro: @astrojs/partytown](https://docs.astro.build/en/guides/integrations-guide/partytown/)

## multi-host-deployment

The Books port picks an official adapter from the build environment and falls back to Node. Each adapter is installed with `astro add <name>`.

```js
// astro.config.mjs
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

async function pickAdapter() {
  if (process.env.NETLIFY) return (await import('@astrojs/netlify')).default();
  if (process.env.CF_PAGES) return (await import('@astrojs/cloudflare')).default();
  if (process.env.VERCEL) return (await import('@astrojs/vercel')).default();
  return node({ mode: 'standalone' });
}

export default defineConfig({
  output: 'server',
  adapter: await pickAdapter(),
});
```

Source: [Astro: @astrojs/node](https://docs.astro.build/en/guides/integrations-guide/node/)

## early-hints

Set a `Link` header on HTML responses in the middleware. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware'

const LINK = '<https://fonts.gstatic.com>; rel=preconnect; crossorigin'

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next()
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const headers = new Headers(response.headers)
  headers.set('Link', LINK)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
})
```

Source: [Astro middleware](https://docs.astro.build/en/guides/middleware/)
