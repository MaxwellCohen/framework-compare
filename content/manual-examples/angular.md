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
