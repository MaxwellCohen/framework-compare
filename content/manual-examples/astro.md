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
