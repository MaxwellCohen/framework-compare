## picture

There is no image component, so write the `<picture>` in the port's cover component. Wide screens get Goodreads' large cover, and narrow screens keep the medium one. React spells the attribute `srcSet`.

```tsx
// src/features/book/components/book-cover.tsx
'use client';
// …
const small = src ?? EMPTY_IMAGE_URL;
const large = getLargeBookImageUrl(small);

return (
  <picture>
    <source media="(min-width: 768px)" srcSet={large} />
    <img
      alt={title}
      className="absolute inset-0 size-full object-cover"
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailedSrc(small)}
      src={small}
    />
  </picture>
);
```

## css-inlining

In the root layout, import the stylesheet with Vite's `?inline` query instead of as a side effect. Render it as a React 19 `<style>` with `href` and `precedence`, and React hoists it into `<head>`. The CSS string also travels in the RSC payload, so keep it small.

```tsx
// src/pages/_layout.tsx
import appCss from '../styles.css?inline'; // was: import '../styles.css';
// …
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <title>Waku Books</title>
      <style href="app-css" precedence="default">{appCss}</style>
      {/* … */}
    </>
  );
}
```

## third-party-scripts

React 19 hoists an `<script async src>` rendered anywhere into `<head>` and deduplicates it. For a lazy strategy, write a small client component that injects the tag after load.

```tsx
// src/components/lazy-script.tsx
'use client';
import { useEffect } from 'react';

export function LazyScript({ src }: { src: string }) {
  useEffect(() => {
    const inject = () => {
      if (document.querySelector(`script[src="${src}"]`)) return;
      const s = Object.assign(document.createElement('script'), { src, async: true });
      document.head.append(s);
    };
    const idle = () => ('requestIdleCallback' in window ? requestIdleCallback(inject) : setTimeout(inject));
    if (document.readyState === 'complete') idle();
    else addEventListener('load', idle, { once: true });
  }, [src]);
  return null;
}

// src/pages/_layout.tsx
<script async src="https://example.com/critical.js" />        {/* afterInteractive-ish */}
<LazyScript src="https://example-analytics.com/script.js" />  {/* lazyOnload */}
```

## image-pipeline

There is no image component, so the port renders a plain `<img>` and rewrites the Goodreads URL itself. The regex swaps the medium-size token `m` for the large `l`. There is no resizing, `srcset` or format negotiation.

```tsx
// src/features/book/book-constants.ts
export function getLargeBookImageUrl(url: string): string {
  return url.replace(/^(https:\/\/images\.gr-assets\.com\/books\/\d+)m(\/\d+\.jpg)$/, '$1l$2');
}

// src/features/book/components/book-cover.tsx
const resolved = getLargeBookImageUrl(src ?? EMPTY_IMAGE_URL);
// …
<img
  alt={title}
  decoding="async"
  fetchPriority={priority ? 'high' : 'auto'}
  sizes={sizes}
  src={resolved}
/>
```

Source: [Waku: Static assets](https://waku.gg/#static-assets)

## bundle-analysis

Add `rollup-plugin-visualizer` under `vite.plugins` in `waku.config.ts`. `waku build` then writes a treemap of the bundle to `stats.html`.

```ts
// waku.config.ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'waku/config';

export default defineConfig({
  vite: {
    plugins: [
      tailwindcss(),
      react(),
      visualizer({ filename: 'stats.html', gzipSize: true }),
    ],
  },
});
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)
