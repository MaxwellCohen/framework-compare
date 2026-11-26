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
