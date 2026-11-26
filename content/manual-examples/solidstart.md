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

## islands

Solid 2's experimental server components replace islands. A `"use server"` function returns a component, the client mounts it with `dynamicComponent`, and only the client components passed in as props or children hydrate. Turn it on with `serverFunctions: { components: true }` on `@solidjs/vite-plugin`.

```tsx
// src/routes/story.tsx
import { dynamicComponent } from 'solid-js'

async function getStory(id: number) {
  'use server'
  const story = await db.stories.get(id)
  return (props) => (
    <article>
      <h1>{story.title}</h1>
      <footer>{props.children}</footer>
    </article>
  )
}

export default function StoryPage(props) {
  const Story = dynamicComponent(() => getStory(props.storyId))
  return (
    <Story>
      <ShareBar />
    </Story>
  )
}
```

Source: [Solid: RFC 11, Server components (experimental)](https://github.com/solidjs/solid/blob/main/documentation/solid-2.0/11-server-components.md)

## bundle-analysis

Add `rollup-plugin-visualizer` to the port's Vite config. `vite build` then writes a treemap of the bundle to `stats.html`.

```ts
// vite.config.ts
import { nitro } from 'nitro/vite'
import solid from '@solidjs/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    solid({ start: { /* … */ }, ssr: true }),
    nitro({ /* … */ }),
    visualizer({ filename: 'stats.html', gzipSize: true }),
  ],
})
```

Source: [rollup-plugin-visualizer: README](https://github.com/btd/rollup-plugin-visualizer)
