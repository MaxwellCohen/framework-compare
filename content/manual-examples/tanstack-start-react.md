## picture

Wrap the port's Unpic `<Image>` in a hand-written `<picture>`, and add `<Source>` from `@unpic/react` for each art-directed variant. Pass `<Source>` the same CDN settings the port's `Image` wrapper uses.

```tsx
// src/features/book/components/book-cover.tsx
import { Source } from '@unpic/react'
import { Image } from '@/components/ui/image'
import { imageCdn } from '@/lib/image-config'
// …
const small = src ?? EMPTY_IMAGE_URL
const size = { layout: 'constrained', width: COVER_IMAGE_WIDTH, height: COVER_IMAGE_HEIGHT } as const

return (
  <picture>
    <Source
      {...size}
      media="(min-width: 768px)"
      src={getLargeBookImageUrl(small)}
      cdn={imageCdn}
      options={imageCdn === 'ipx' ? { ipx: { baseURL: '/_ipx' } } : undefined}
    />
    <Image {...size} alt={title} src={small} sizes={sizes} priority={priority}
           className="absolute inset-0 size-full object-cover" objectFit="cover" unstyled />
  </picture>
)
```

## reactivity

Add the React Compiler preset through `@rolldown/plugin-babel` next to `viteReact()`. The compiler memoizes components and hooks at build time, so fewer components re-render when state changes.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteReact(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
```

Source: [React: React Compiler installation](https://react.dev/learn/react-compiler/installation)

## bundle-analysis

Add `rollup-plugin-visualizer` to the plugin list. `vite build` then writes a treemap of the bundle to `stats.html`.

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    tanstackStart(),
    viteReact(),
    visualizer({ filename: 'stats.html', gzipSize: true }),
  ],
})
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)

## service-worker

Put a hand-written worker in `public/` and register it with an inline script from the root route's `head`.

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
// src/routes/__root.tsx
const swScript = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// …
    scripts: [{ children: themeScript }, { children: swScript }],
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · [TanStack Start document head](https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management)
