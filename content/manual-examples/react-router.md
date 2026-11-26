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
