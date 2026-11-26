## islands

Serve the page with a small entry instead of `app/entry.js`. Then mount each interactive component into its placeholder with `renderComponent` from `@ember/renderer`. The rest of the page stays static HTML.

```gjs
// app/islands.js (the only <script type="module"> on a static page)
import { renderComponent } from '@ember/renderer';
import FavoriteButton from './components/islands/favorite-button';

const islands = { 'favorite-button': FavoriteButton };

for (const el of document.querySelectorAll('[data-island]')) {
  const args = JSON.parse(el.dataset.args ?? '{}');
  el.replaceChildren(); // no hydration: drop the server markup, then render fresh
  renderComponent(islands[el.dataset.island], { into: el, args });
}

// app/components/islands/favorite-button.gjs
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';

export default class FavoriteButton extends Component {
  @tracked saved = false;
  toggle = () => (this.saved = !this.saved);
  <template>
    <button type="button" {{on "click" this.toggle}}>
      {{if this.saved "Saved" "Save"}} {{@title}}
    </button>
  </template>
}
```

Source: [RFC 1099: renderComponent](https://github.com/emberjs/rfcs/blob/main/text/1099-renderComponent.md)

## picture

Replace the `<img>` in the port's cover component with a hand-written `<picture>`. Wide screens get Goodreads' large cover, and narrow screens keep the medium one.

```gjs
// app/components/book/book-cover.gjs
import { EMPTY_IMAGE_URL, getLargeBookImageUrl } from '../../lib/book/book-constants';
// …
  get small() {
    return this.args.src ?? EMPTY_IMAGE_URL;
  }

  get large() {
    return getLargeBookImageUrl(this.small);
  }

  <template>
    <picture>
      <source media="(min-width: 768px)" srcset={{this.large}} />
      <img
        alt={{@title}}
        class="absolute inset-0 size-full object-cover"
        decoding="async"
        loading={{this.loading}}
        src={{this.small}}
        {{on "error" this.onError}}
      />
    </picture>
  </template>
```

## css-inlining

The port's build step already rewrites the HTML template. Extend it to swap the built stylesheet `<link>` for a `<style>` tag. The Node, Vercel, Netlify and Cloudflare deploys all use that template, so they all get the inlined CSS.

```js
// scripts/prepare-server-template.mjs
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const clientIndex = resolve(root, 'dist/client/index.html');
const serverTemplate = resolve(root, 'dist/server/template.html');

let html = await readFile(clientIndex, 'utf8');
const link = html.match(/<link[^>]+href="(\/assets\/[^"]+\.css)"[^>]*>/);
if (link) {
  const css = await readFile(resolve(root, 'dist/client', link[1].slice(1)), 'utf8');
  html = html.replace(link[0], `<style>${css}</style>`);
}

await mkdir(resolve(root, 'dist/server'), { recursive: true });
await writeFile(serverTemplate, html);
await rm(clientIndex);
```

## render-modes

Choose the mode per path in the port's request handler. Server-render the routes that need it. For the rest, return the unrendered template: the same SPA shell the port's Netlify and Cloudflare deploys serve.

```js
// server/handle-request.js
const CLIENT_ONLY = [/^\/account(\/|$)/]; // example: routes that skip SSR

export async function handleFetch(request, options = {}) {
  const url = new URL(request.url);
  // … /api/* handlers from the port …

  const template = await getTemplate();
  if (CLIENT_ONLY.some((re) => re.test(url.pathname))) {
    // SPA shell: app/entry.js boots the app in the browser
    return new Response(template, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const emberApp = await getEmberApp();
  const rendered = await emberApp.renderRoute(`${url.pathname}${url.search}`, {
    settledTimeout: 8000,
  });
  return new Response(assembleHTML(template, rendered), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    status: rendered.statusCode,
  });
}
```

## route-prefetching

Write an `ember-modifier` that starts the book request on hover or focus and caches the promise. The route's `model` hook then reads the same cached promise. `<LinkTo>` passes the modifier through to its `<a>`.

```gjs
// app/lib/book/load-catalog.js
const bookCache = new Map();
export function prefetchBook(id, searchParams) {
  const key = `${id}?${stringifySearchParams(searchParams)}`;
  if (!bookCache.has(key)) bookCache.set(key, loadBook(id, searchParams));
  return bookCache.get(key);
}

// app/modifiers/prefetch-book.js
import { modifier } from 'ember-modifier';
import { prefetchBook } from '../lib/book/load-catalog';

export default modifier((element, [id, searchParams]) => {
  const warm = () => prefetchBook(id, searchParams);
  element.addEventListener('pointerenter', warm, { once: true });
  element.addEventListener('focus', warm, { once: true });
  return () => {
    element.removeEventListener('pointerenter', warm);
    element.removeEventListener('focus', warm);
  };
});

// app/routes/book.js: model(params) { return prefetchBook(params.id, parseSearchParams(params)); }
// app/components/book/book-card.gjs
<LinkTo @route="book" @model={{this.bookId}} @query={{this.query}}
        {{prefetchBook this.bookId @searchParams}}>
  {{! … }}
</LinkTo>
```

## third-party-scripts

There is no script component, so put the loading strategy in `index.html`. This one waits for the `load` event and an idle moment before it injects the tag, like Next's `lazyOnload`.

```html
<!-- index.html -->
<head>
  <!-- … -->
  <script>
    addEventListener('load', function () {
      (window.requestIdleCallback || setTimeout)(function () {
        var s = document.createElement('script');
        s.src = 'https://example-analytics.com/script.js';
        s.async = true;
        document.head.appendChild(s);
      });
    });
  </script>
</head>
```

## multi-host-deployment

From the port: each host gets its own entry file and config, written by hand. Vercel runs the SSR handler as a function (`vercel.json` rewrites everything to `/api`). Cloudflare runs a Worker that serves the API and the static SPA shell. Netlify uses `netlify.toml` redirects plus `netlify/functions/api.mjs`.

```js
// api/index.js (Vercel: SSR + API)
import '../server/load-env.js';
import { handleNodeRequest } from '../server/handle-request.js';
export default handleNodeRequest;

// workers/index.mjs (Cloudflare: API only, assets from dist/client)
import { bookPayload, catalogPayload, searchParamsFromUrl } from '../server/catalog-api.js';

export default {
  async fetch(request, env) {
    if (env?.POSTGRES_URL) process.env.POSTGRES_URL = env.POSTGRES_URL;
    const url = new URL(request.url);
    if (url.pathname === '/api/catalog') {
      return Response.json(await catalogPayload(searchParamsFromUrl(url.href)));
    }
    // … /api/books/:id …
    return env.ASSETS.fetch(request); // SPA shell (not_found_handling: single-page-application)
  },
};
```

## image-pipeline

Add the `@responsive-image/vite-plugin` to the Embroider Vite config. An import ending in `?responsive` is resized at build time, and the `<ResponsiveImage>` component from `@responsive-image/ember` renders the `srcset`.

```js
// vite.config.mjs
import { defineConfig } from 'vite';
import { extensions, ember } from '@embroider/vite';
import { babel } from '@rollup/plugin-babel';
import { responsiveImage } from '@responsive-image/vite-plugin';

export default defineConfig({
  plugins: [ember(), babel({ babelHelpers: 'runtime', extensions }), responsiveImage()],
});
```

```gjs
// app/components/home/hero.gjs
import { ResponsiveImage } from '@responsive-image/ember';
import heroImage from './hero.jpg?w=640;1280;1920&responsive';

<template>
  <ResponsiveImage @src={{heroImage}} @size={{100}} alt="Shelves of books" />
</template>
```

Source: [responsive-image: Image component](https://responsive-image.dev/usage/component)

## bundle-analysis

Embroider points to the community `vite-bundle-visualizer`, a CLI wrapper around `rollup-plugin-visualizer`. It builds with the app's Vite config and writes a treemap.

```sh
# in the app root; Ember's config file is vite.config.mjs
npx vite-bundle-visualizer -c vite.config.mjs -o stats.html
```

Source: [Embroider: Analyzing Bundles](https://github.com/embroider-build/embroider/blob/main/docs/analyzing.md)

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

## early-hints

Set a `Link` header on the Fastify reply that sends the rendered page. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```js
// server.js
const LINK = '<https://fonts.gstatic.com>; rel=preconnect; crossorigin';
// … in the handler that sends the SSR result
const { html } = await renderHtml(emberApp, request.url, template);
return reply.header('Link', LINK).type('text/html').send(html);
```

Source: [Fastify Reply: `.header()`](https://fastify.dev/docs/latest/Reference/Reply/#headerkey-value)
