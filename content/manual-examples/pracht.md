## picture

Call `getImageProps()` from `@pracht/image` once per art-directed source, then write the `<picture>` yourself. The loader configured in the port's `src/lib/images.ts` still builds every `srcset` URL.

```tsx
// src/features/book/components/book-cover.tsx
import { getImageProps } from '@pracht/image';
import { EMPTY_IMAGE_URL, getLargeBookImageUrl } from '@/features/book/book-constants';
import '@/lib/images';
// …
const small = src ?? EMPTY_IMAGE_URL;
const common = { alt: title, fill: true, priority, sizes };
const { srcset: desktop } = getImageProps({ ...common, src: getLargeBookImageUrl(small) });
const mobile = getImageProps({ ...common, src: small });

return (
  <picture>
    <source media="(min-width: 768px)" srcset={desktop} sizes={sizes} />
    <img {...mobile} className="size-full object-cover" onError={() => setFailedSrc(small)} />
  </picture>
);
```

## reactivity

Install `@preact/signals`. Passing the signal itself into JSX (`{count}`, not `{count.value}`) binds it straight to the text node, so the component does not re-render when it changes.

```tsx
// src/components/counter.tsx
import { signal } from '@preact/signals'

const count = signal(0)

export function Counter() {
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => count.value++}>click me</button>
    </div>
  )
}
```

Source: [Preact: Signals](https://preactjs.com/guide/v11/signals/)

## service-worker

Put a hand-written worker in `public/` and register it with an inline script from the shell's `head()`.

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
// src/shells/public.tsx
const swScript = `if('serviceWorker' in navigator)addEventListener('load',function(){navigator.serviceWorker.register('/sw.js')});`;
// … in the shell's head()
    script: [{ children: themeScript }, { children: swScript }],
```

Source: [Using Service Workers (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) · [Pracht shells](https://pracht.resynapse.dev/docs/shells)
