## picture

The `?jsx` image import only emits an `<img>`, so write `<picture>` in JSX yourself, with files served from `public/`. Qwik uses HTML attribute names such as `srcset`.

```tsx
// src/components/hero-image/hero-image.tsx
import { component$ } from '@builder.io/qwik'

export const HeroImage = component$(() => (
  <picture>
    {/* art direction: a square crop on narrow screens */}
    <source media="(max-width: 640px)" type="image/avif"
            srcset="/media/hero-square-640.avif" width={640} height={640} />
    {/* format fallback: AVIF, then WebP, then the <img> JPEG */}
    <source type="image/avif" sizes="100vw"
            srcset="/media/hero-1280.avif 1280w, /media/hero-1920.avif 1920w" />
    <source type="image/webp" sizes="100vw"
            srcset="/media/hero-1280.webp 1280w, /media/hero-1920.webp 1920w" />
    <img src="/media/hero-1280.jpg" alt="Shelves of books" width={1280} height={720}
         fetchPriority="high" decoding="async" />
  </picture>
))
```

Source: [MDN: the picture element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/picture)

## early-hints

Set a `Link` header in the root layout's `onGet` handler. This one preconnects to the font host. To preload a built file with a hashed name, read its URL from the Vite manifest.

```tsx
// src/routes/layout.tsx
import type { RequestHandler } from '@builder.io/qwik-city'

export const onGet: RequestHandler = async ({ headers }) => {
  headers.set('Link', '<https://fonts.gstatic.com>; rel=preconnect; crossorigin')
}
```

Source: [Qwik City: caching and response headers](https://qwik.dev/docs/caching/)
