## picture

NgOptimizedImage can't render `<picture>`, so write the element in a component template with plain `<source>` tags for format fallback and art direction.

```ts
// src/app/home/hero-image.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-hero-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <picture>
      <!-- art direction: a square crop on narrow screens -->
      <source media="(max-width: 640px)" type="image/avif"
              srcset="/media/hero-square-640.avif" width="640" height="640" />
      <!-- format fallback: AVIF, then WebP, then the <img> JPEG -->
      <source type="image/avif" sizes="100vw"
              srcset="/media/hero-1280.avif 1280w, /media/hero-1920.avif 1920w" />
      <source type="image/webp" sizes="100vw"
              srcset="/media/hero-1280.webp 1280w, /media/hero-1920.webp 1920w" />
      <img src="/media/hero-1280.jpg" alt="Shelves of books" width="1280" height="720"
           fetchpriority="high" decoding="async" />
    </picture>
  `,
})
export class HeroImage {}
```

Source: [Angular image optimization FAQ](https://angular.dev/guide/image-optimization)

## third-party-scripts

Put the loading strategy in the tag yourself: `async` in `src/index.html` for early scripts, or `afterNextRender` to inject one after the first browser render.

```ts
// src/index.html: loads in parallel, runs as soon as it arrives
// <script async src="https://plausible.io/js/script.js" data-domain="books.example"></script>

// src/app/app.ts: load a chat widget only in the browser, after first render
import { Component, afterNextRender } from '@angular/core';

@Component({ selector: 'app-root', templateUrl: './app.html' })
export class App {
  constructor() {
    afterNextRender(() => {
      // Never runs during SSR; wait for idle so the widget doesn't compete with hydration.
      (window.requestIdleCallback ?? setTimeout)(() => {
        const s = document.createElement('script');
        s.src = 'https://widget.example.com/chat.js';
        s.async = true;
        document.body.append(s);
      });
    });
  }
}
```

Source: [afterNextRender](https://angular.dev/api/core/afterNextRender)

## multi-host-deployment

From the port: one `AngularAppEngine` handler per host, each picked by a build configuration in `angular.json`. Vercel reuses the Node/Express build behind a function.

```ts
// angular-books/src/server.cloudflare.ts (Netlify's server.netlify.ts is the same shape)
import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
// …
const angularAppEngine = new AngularAppEngine();

async function handle(request: Request): Promise<Response> {
  const result = await angularAppEngine.handle(request);
  return result || new Response('Not found', { status: 404 });
}

export const reqHandler = createRequestHandler(handle);
export default { fetch: (request: Request) => handle(request) };

// angular-books/angular.json, build.configurations: one SSR entry per host
// "node":       { "ssr": { "entry": "src/server.ts" } },
// "cloudflare": { "ssr": { "entry": "src/server.cloudflare.ts", "platform": "neutral" } },
// "netlify":    {}  // default "ssr.entry": "src/server.netlify.ts"

// angular-books/api/index.js: Vercel function wrapping the Express build
// handler ??= (await import('../dist/angular-books/server/server.mjs')).reqHandler;
```

Source: [Angular SSR](https://angular.dev/guide/ssr)

## css-inlining

Critical CSS inlining is part of the production `optimization` setting. Angular inlines the CSS the first page needs and loads the rest of the stylesheet async.

```json
// angular.json
{
  "projects": {
    "books": {
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "configurations": {
            "production": {
              "optimization": {
                "scripts": true,
                "styles": { "minify": true, "inlineCritical": true },
                "fonts": true
              }
            }
          }
        }
      }
    }
  }
}
```

Source: [Angular: Workspace configuration](https://angular.dev/reference/configs/workspace-config)

## font-optimization

Link a Google Fonts stylesheet in `index.html` as usual. With `optimization.fonts.inline` on, the production build downloads that CSS and inlines it into the HTML, removing one render-blocking request.

```html
<!-- src/index.html -->
<head>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet" />
</head>
```

```json
// angular.json (production configuration; needs internet access at build time)
"optimization": {
  "fonts": { "inline": true }
}
```

Source: [Angular: Workspace configuration](https://angular.dev/reference/configs/workspace-config)

## image-pipeline

`NgOptimizedImage` with a built-in loader. The loader builds CDN URLs for each `ngSrcset` width; `priority` marks the LCP image and `placeholder` shows a low-res blur from the same CDN.

```ts
// src/app/app.config.ts
import { provideImgixLoader } from '@angular/common';

export const appConfig: ApplicationConfig = {
  providers: [provideImgixLoader('https://books.imgix.net/')],
};

// src/app/book/book-cover.ts
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-book-cover',
  imports: [NgOptimizedImage],
  template: `
    <img [ngSrc]="src()" width="400" height="600" [alt]="title()"
         ngSrcset="200w, 400w, 800w" sizes="(max-width: 640px) 50vw, 200px"
         [priority]="priority()" placeholder />
  `,
})
export class BookCover { /* … */ }
```

Source: [Angular: Getting started with NgOptimizedImage](https://angular.dev/guide/image-optimization)

## caching

Prerender stable pages at build time, and let the HttpClient transfer cache hand SSR responses to the browser so hydration does not fetch them again.

```ts
// src/app/app.routes.server.ts
export const serverRoutes: ServerRoute[] = [
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: '**', renderMode: RenderMode.Server, headers: { 'Cache-Control': 'public, max-age=60' } },
];

// src/app/app.config.ts
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';

providers: [
  provideClientHydration(
    withHttpTransferCacheOptions({
      includeHeaders: ['ETag', 'Cache-Control'],
      filter: (req) => !req.url.includes('/api/profile'),
      includePostRequests: false,
    }),
  ),
],
```

Source: [Angular: Server and hybrid rendering](https://angular.dev/guide/ssr)

## route-prefetching

The router preloads nothing by default (`NoPreloading`). Add `withPreloading(PreloadAllModules)` to fetch every lazy route chunk after the app starts. `@defer` blocks take their own `prefetch` trigger.

```ts
// src/app/app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withPreloading(PreloadAllModules))],
};
```

```html
<!-- any template: load the chunk on interaction, prefetch it when the browser is idle -->
@defer (on interaction; prefetch on idle) {
  <app-book-reviews />
} @placeholder {
  <button>Show reviews</button>
}
```

Source: [Angular: Customizing route behavior](https://angular.dev/guide/routing/customizing-route-behavior)

## islands

Incremental hydration is on by default with `provideClientHydration()`. A `@defer` block with a `hydrate` trigger renders on the server and stays dehydrated until the trigger fires.

```ts
// src/app/app.config.ts
providers: [provideClientHydration()],
```

```html
<!-- src/app/pages/book.page.ts template -->
<app-book-detail [book]="book()" />

@defer (hydrate on viewport) {
  <app-related-books [bookId]="book().id" />
}

@defer (on viewport; hydrate never) {
  <app-static-footer />
}
```

Source: [Angular: Incremental hydration](https://angular.dev/guide/incremental-hydration)

## render-modes

Each route picks a render mode in `app.routes.server.ts`: per-request SSR, build-time prerender, or client-only.

```ts
// src/app/app.routes.server.ts
import { inject } from '@angular/core';
import { RenderMode, PrerenderFallback, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'about', renderMode: RenderMode.Prerender },
  { path: 'account', renderMode: RenderMode.Client },
  {
    path: 'book/:id',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Server,
    async getPrerenderParams() {
      const ids = await inject(BooksApi).topIds();
      return ids.map((id) => ({ id }));
    },
  },
  { path: '**', renderMode: RenderMode.Server, status: 404 },
];
```

Source: [Angular: Server and hybrid rendering](https://angular.dev/guide/ssr)

## reactivity

From the Books port's cover component: `input()` and `signal()` hold state, `computed()` derives from them, and the template re-renders only what reads a changed signal.

```ts
// src/app/book/book-cover.ts
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-book-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showImage()) {
      <img [src]="readySrc()" [alt]="title()" (error)="failedSrc.set(readySrc())" />
    } @else {
      <div role="img">Cover unavailable</div>
    }
  `,
})
export class BookCover {
  readonly title = input.required<string>();
  readonly src = input.required<string | null>();
  protected readonly failedSrc = signal<string | null>(null);
  protected readonly readySrc = computed(() => getLargeBookImageUrl(this.src() ?? EMPTY_IMAGE_URL));
  protected readonly showImage = computed(() => this.readySrc() !== this.failedSrc());
}
```

Source: [Angular: Signals](https://angular.dev/guide/signals)

## bundle-analysis

`--stats-json` writes `browser-stats.json` (and `server-stats.json` with SSR). Load it into the esbuild analyzer at esbuild.github.io/analyze. Budgets in `angular.json` fail the build when bundles grow.

```sh
ng build --stats-json
# then open https://esbuild.github.io/analyze/ and load dist/books/browser-stats.json
```

```json
// angular.json, configurations.production
"budgets": [
  { "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
]
```

Source: [Angular CLI: ng build](https://angular.dev/cli/build)

## early-hints

Add a `Link` header to the server route's `headers`. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```ts
// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
    headers: { Link: '<https://fonts.gstatic.com>; rel=preconnect; crossorigin' },
  },
];
```

Source: [Angular SSR: setting headers and status codes](https://angular.dev/guide/ssr)
