## picture

Write the same `<picture>` as the React port, with `Source` from `@unpic/solid` around the port's `<Image>` wrapper. Solid uses `class` instead of `className`.

```tsx
// src/features/book/components/book-cover.tsx
import { Source } from "@unpic/solid";
import { Image } from "@/components/ui/image";
import { imageCdn } from "@/lib/image-config";
// …
const small = () => props.src ?? EMPTY_IMAGE_URL;
const size = { layout: "constrained", width: COVER_IMAGE_WIDTH, height: COVER_IMAGE_HEIGHT } as const;

return (
  <picture>
    <Source
      {...size}
      media="(min-width: 768px)"
      src={getLargeBookImageUrl(small())}
      cdn={imageCdn}
      options={imageCdn === "ipx" ? { ipx: { baseURL: "/_ipx" } } : undefined}
    />
    <Image {...size} alt={props.title} src={small()} sizes={props.sizes} priority={props.priority}
           class="absolute inset-0 size-full object-cover" objectFit="cover" unstyled />
  </picture>
);
```

## third-party-scripts

Use the root route's `head().scripts`, which the port already uses for its theme script. Since there is no loading-strategy option, add a small inline loader that injects the third-party tag once the page has loaded.

```tsx
// src/routes/__root.tsx
const lazyAnalytics = `addEventListener("load",function(){(window.requestIdleCallback||setTimeout)(function(){var s=document.createElement("script");s.src="https://example-analytics.com/script.js";s.async=true;document.head.appendChild(s);});});`;

export const Route = createRootRoute({
  head: () => ({
    // … meta, links, styles from the port …
    scripts: [
      { children: themeScript },                              // from the port
      { src: "https://example.com/critical.js", async: true }, // load as soon as possible
      { children: lazyAnalytics },                             // like Next's lazyOnload
    ],
  }),
  // …
});
```
