## picture

NgOptimizedImage can't render `<picture>`, so write the element in a page template with plain `<source>` tags. Files in `public/` are served from the site root.

```ts
// src/app/pages/index.page.ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  template: `
    <picture>
      <!-- art direction: a square crop on narrow screens -->
      <source media="(max-width: 640px)" type="image/avif"
              srcset="/media/hero-square-640.avif" width="640" height="640" />
      <source type="image/avif" sizes="100vw"
              srcset="/media/hero-1280.avif 1280w, /media/hero-1920.avif 1920w" />
      <img src="/media/hero-1280.jpg" alt="Shelves of books" width="1280" height="720"
           fetchpriority="high" decoding="async" />
    </picture>
  `,
})
export default class HomePage {}
```

Source: [Angular image optimization FAQ](https://angular.dev/guide/image-optimization)

## css-inlining

Analog has no inlining option, so inline the above-the-fold rules in `index.html` yourself and load the full stylesheet without blocking render.

```html
<!-- index.html -->
<head>
  <base href="/" />
  <!-- hand-picked rules for the header and first row of cards -->
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; }
    .site-header { height: 56px; display: flex; align-items: center; }
  </style>
  <!-- the rest loads async: applied once it arrives -->
  <link rel="stylesheet" href="/src/styles.css" media="print" onload="this.media='all'" />
  <noscript><link rel="stylesheet" href="/src/styles.css" /></noscript>
</head>
```

Source: [Analog: Migrating an Angular app](https://analogjs.org/docs/guides/migrating)

## font-optimization

Install a Fontsource package and import it from the global stylesheet. Vite bundles the font files with hashed names and serves them from your own origin.

```css
/* src/styles.css (npm install @fontsource-variable/open-sans) */
@import '@fontsource-variable/open-sans';

body {
  font-family: 'Open Sans Variable', sans-serif;
}
```

Source: [Fontsource: Install](https://fontsource.org/docs/getting-started/install)

## image-pipeline

Import `NgOptimizedImage` from `@angular/common` and use `ngSrc`. Width and height are required, `priority` marks the LCP image, and a loader provider builds CDN URLs.

```ts
// src/app/pages/index.page.ts
import { Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  imports: [NgOptimizedImage],
  template: `
    <img ngSrc="covers/dune.jpg" width="400" height="600" priority />
    <img ngSrc="covers/emma.jpg" ngSrcset="200w, 400w" sizes="50vw" width="400" height="600" />
  `,
})
export default class HomePage {}

// src/app/app.config.ts
// providers: [provideImgixLoader('https://books.imgix.net/'), /* … */]
```

Source: [Angular: Image optimization](https://angular.dev/guide/image-optimization)

## caching

List routes under `prerender.routes` to build them as static HTML. Set `staticData: true` on a route to write its server-side data to static files too. Dynamic responses get headers from server middleware.

```ts
// vite.config.ts
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [
    analog({
      prerender: {
        routes: async () => ['/', '/about', { route: '/books', staticData: true }],
      },
    }),
  ],
}));
```

```ts
// src/server/middleware/cache.ts
import { defineEventHandler, setResponseHeader } from 'h3';

export default defineEventHandler((event) => {
  if (event.path.startsWith('/books/')) {
    setResponseHeader(event, 'Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  }
});
```

Source: [Analog: Static site generation](https://analogjs.org/docs/features/server/static-site-generation), [Analog: Middleware](https://analogjs.org/docs/features/routing/middleware)

## route-prefetching

`provideFileRouter()` takes Angular router features. `withPreloading(PreloadAllModules)` loads every lazy page chunk after the app starts.

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideFileRouter } from '@analogjs/router';
import { PreloadAllModules, withComponentInputBinding, withPreloading } from '@angular/router';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFileRouter(withComponentInputBinding(), withPreloading(PreloadAllModules)),
    // …
  ],
};
```

Source: [Analog: Routing](https://analogjs.org/docs/features/routing/overview), [Angular: PreloadAllModules](https://angular.dev/api/router/PreloadAllModules)

## streaming-ssr

Turn on the experimental flag and export `renderStream` from the server entry. It needs Angular 21+ and Vite 6+.

```ts
// vite.config.ts
import analog from '@analogjs/platform';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [analog({ experimental: { streaming: true } })],
});

// src/main.server.ts
import { renderStream } from '@analogjs/router/server';
import { config } from './app/app.config.server';
import { AppComponent } from './app/app.component';

export default renderStream(AppComponent, config);
```

Source: [Analog: Streaming SSR](https://analogjs.org/docs/features/server/streaming-ssr)

## early-hints

Set a `Link` header by hand in server middleware. Files in `src/server/middleware/` are registered automatically.

```ts
// src/server/middleware/preload.ts
import { defineEventHandler, setResponseHeader } from 'h3';

export default defineEventHandler((event) => {
  if (event.path.startsWith('/api')) return;
  setResponseHeader(
    event,
    'Link',
    '<https://fonts.gstatic.com>; rel=preconnect; crossorigin, </media/hero-1280.avif>; rel=preload; as=image',
  );
});
```

Source: [Analog: Middleware](https://analogjs.org/docs/features/routing/middleware)

## islands

Enable incremental hydration, then wrap a part of the page in `@defer` with a `hydrate` trigger. It renders on the server and hydrates when it scrolls into view.

```ts
// src/app/app.config.ts (Angular 21; on by default with provideClientHydration() from Angular 22)
import { provideClientHydration, withIncrementalHydration } from '@angular/platform-browser';
// providers: [provideClientHydration(withIncrementalHydration()), /* … */]

// src/app/pages/books/[id].page.ts
import { Component, signal } from '@angular/core';
import { Reviews } from '../../reviews/reviews';

@Component({
  imports: [Reviews],
  template: `
    <h1>{{ title() }}</h1>
    @defer (hydrate on viewport) {
      <app-reviews />
    } @placeholder {
      <div>Reviews</div>
    }
  `,
})
export default class BookPage {
  protected title = signal('Dune');
}
```

Source: [Angular: Incremental hydration](https://angular.dev/guide/incremental-hydration), [Analog: Streaming SSR](https://analogjs.org/docs/features/server/streaming-ssr)

## render-modes

Pages render on the server by default. `routeRules` in the Nitro plugin makes matching routes client-only, and `prerender.routes` builds the listed routes as static HTML.

```ts
// vite.config.ts
import analog from '@analogjs/platform';
import angular from '@analogjs/vite-plugin-angular';
import nitro from '@analogjs/vite-plugin-nitro';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [
    analog({ prerender: { routes: ['/', '/about'] } }), // static HTML
    angular(),
    nitro({
      routeRules: {
        '/admin/**': { ssr: false }, // client-only
      },
    }),
  ],
}));
```

Source: [Analog: Server-side rendering](https://analogjs.org/docs/features/server/server-side-rendering)

## reactivity

A signal holds the search text. `injectServerFn` returns an Angular resource that refetches when a signal read in its args factory changes.

```ts
// src/app/pages/search.page.ts
import { Component, computed, signal } from '@angular/core';
import { injectServerFn } from '@analogjs/router';
import { searchBooks } from '../server-fns/books.server';

@Component({
  template: `
    <input [value]="query()" (input)="query.set($any($event.target).value)" />
    <p>{{ count() }} results</p>
    @for (book of books.value() ?? []; track book.id) {
      <p>{{ book.title }}</p>
    }
  `,
})
export default class SearchPage {
  query = signal('');
  protected books = injectServerFn(searchBooks, () => ({ q: this.query() }));
  count = computed(() => this.books.value()?.length ?? 0);
}
```

Source: [Analog: Server functions](https://analogjs.org/docs/features/data-fetching/server-functions), [Angular: Signals](https://angular.dev/guide/signals)

## bundle-analysis

Add `rollup-plugin-visualizer` to the Vite config. `vite build` then writes a treemap of the client bundle.

```ts
// vite.config.ts (npm install -D rollup-plugin-visualizer)
import analog from '@analogjs/platform';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [
    analog(),
    visualizer({ filename: 'stats.html', gzipSize: true, template: 'treemap' }),
  ],
}));
```

Source: [rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer)

## third-party-scripts

Write the loading strategy yourself: `async` in `index.html` for early scripts, or `afterNextRender` to inject one in the browser after the first render.

```ts
// index.html: loads in parallel, runs as soon as it arrives
// <script async src="https://plausible.io/js/script.js" data-domain="books.example"></script>

// src/app/app.component.ts: load a chat widget only in the browser
import { Component, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({ selector: 'app-root', imports: [RouterOutlet], template: '<router-outlet />' })
export class AppComponent {
  constructor() {
    afterNextRender(() => {
      const s = document.createElement('script');
      s.src = 'https://widget.example.com/chat.js';
      s.async = true;
      document.body.append(s);
    });
  }
}
```

Source: [Angular: afterNextRender](https://angular.dev/api/core/afterNextRender)

## multi-host-deployment

Analog builds a Node server by default. Pick another Nitro preset in the Nitro plugin, or with `BUILD_PRESET` at build time.

```ts
// vite.config.ts
import analog from '@analogjs/platform';
import angular from '@analogjs/vite-plugin-angular';
import nitro from '@analogjs/vite-plugin-nitro';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [analog(), angular(), nitro({ preset: 'vercel' })],
}));
```

```sh
# Node (default): node dist/analog/server/index.mjs
BUILD_PRESET=cloudflare-pages npm run build
npx wrangler pages dev ./dist/analog/public
```

Source: [Analog: Deployment providers](https://analogjs.org/docs/features/deployment/providers)

## service-worker

Put a hand-written worker in `public/` and register it with an inline script in `index.html`.

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

```html
<!-- index.html, before </head> -->
<script>
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
  }
</script>
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
