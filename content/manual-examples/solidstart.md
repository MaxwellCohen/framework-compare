## third-party-scripts

Write the tags in the port's `Document.tsx`, next to its inline theme script. For a lazy strategy, add an inline loader that injects the third-party script once the page is idle.

```tsx
// src/Document.tsx
const themeScript = `(function(){ /* … from the port … */ })();`;
const lazyAnalytics = `addEventListener("load",function(){(window.requestIdleCallback||setTimeout)(function(){var s=document.createElement("script");s.src="https://example-analytics.com/script.js";s.async=true;document.head.appendChild(s);});});`;

export default function Document(props: ParentProps) {
  return (
    <html lang="en">
      <head>
        {/* … meta, font preload, inlined CSS from the port … */}
        <script>{themeScript}</script>
        <script src="https://example.com/critical.js" async />
        <script>{lazyAnalytics}</script>
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
```

## picture

`@solidjs/image` covers formats but not breakpoints, so write the `<picture>` in the port's cover component. Wide screens get Goodreads' large cover, and narrow screens keep the medium one.

```tsx
// src/features/book/components/book-cover.tsx
import { getLargeBookImageUrl } from "@/features/book/book-constants";
import { imageSrcset } from "@/lib/image-cdn";
// …
{(src) => (
  <picture>
    <source
      media="(min-width: 768px)"
      srcset={imageSrcset(getLargeBookImageUrl(src())) ?? getLargeBookImageUrl(src())}
      sizes={props.sizes}
    />
    <img
      alt={props.title}
      class="absolute inset-0 h-full w-full object-cover"
      decoding="async"
      width={COVER_WIDTH}
      height={COVER_HEIGHT}
      sizes={props.sizes}
      srcset={imageSrcset(src())}
      src={src()}
    />
  </picture>
)}
```
