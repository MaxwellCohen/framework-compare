## css-inlining

Styles written with `css(...)` and applied through the `mix` prop are collected during server rendering. Remix dedupes them and writes them into `<style data-rmx-style>` tags in the document head.

```tsx
// app/ui/book-card.tsx
import { css } from "remix/component";
import type { Handle } from "remix/component";

export function BookCard(handle: Handle<{ title: string; author: string }>) {
  return () => (
    <article
      mix={css({
        border: "1px solid #d6d6d6",
        borderRadius: "12px",
        padding: "1rem",
        "&:hover": { borderColor: "#6d28d9" },
        "@media (max-width: 40rem)": { borderRadius: 0 },
      })}
    >
      <h2>{handle.props.title}</h2>
      <p>{handle.props.author}</p>
    </article>
  );
}
```

Source: [Remix: Rendering UI, styling with css](https://docs.remix.run/rendering-ui/#styling-with-css)

## font-optimization

Install Fontsource, allow the package in the asset server, and link its stylesheet. The asset server rewrites the `url()` references in the CSS. The preload is a hand-written `<link>` with a URL from `getHref()`.

```tsx
// app/assets.ts  (npm i @fontsource-variable/inter)
export const assets = createAssetServer({
  // …
  allowPackages: ["remix", "@fontsource-variable/inter"],
  files: { extensions: [".svg", ".png", ".jpg", ".woff2"] },
});

export const fontCssHref = await assets.getHref(
  "node_modules/@fontsource-variable/inter/index.css",
);
export const fontHref = await assets.getHref(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);

// app/actions/document.tsx, inside <head>
<link rel="preload" href={fontHref} as="font" type="font/woff2" crossOrigin="anonymous" />
<link rel="stylesheet" href={fontCssHref} />
```

Source: [Remix: Files and assets, reference styles, images, and fonts](https://docs.remix.run/files-and-assets/)

## image-pipeline

The asset server runs named file transforms that the app writes with Sharp. A URL picks the chain, and `createFsFileCache()` keeps the results on disk.

```ts
// app/assets.ts  (npm i sharp)
import { createAssetServer, createFsFileCache, defineFileTransform } from "remix/assets";
import sharp from "sharp";

export const assets = createAssetServer({
  // …
  files: {
    extensions: [".png", ".jpg"],
    transforms: {
      resize: defineFileTransform({
        extensions: [".png", ".jpg"],
        param: true,
        // check that param is a width in range before using it
        transform: (bytes, { param }) => sharp(bytes).resize({ width: Number(param) }).toBuffer(),
      }),
      webp: defineFileTransform({
        extensions: [".png", ".jpg"],
        transform: async (bytes) => ({ content: await sharp(bytes).webp().toBuffer(), extension: ".webp" }),
      }),
    },
    cache: createFsFileCache(),
  },
});

// in an action
let coverHref = await assets.getHref("app/ui/public/cover.jpg", { transform: [["resize", "400"], "webp"] });
```

Source: [Remix: Files and assets, transform images and other files](https://docs.remix.run/files-and-assets/)

## caching

There is no data or HTML cache, so each action sets `Cache-Control` on its own response. `context.render()` takes a `ResponseInit` for that.

```tsx
// app/actions/books/controller.tsx
import { createController } from "remix/router";
import { routes } from "../../routes.ts";
import { getBook } from "./data.ts";
import { BookPage } from "./show-page.tsx";

export default createController(routes.books, {
  actions: {
    async show(context) {
      let book = await getBook(context.params.bookId);
      if (!book) return new Response("Book not found", { status: 404 });

      return context.render(<BookPage book={book} />, {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" },
      });
    },
  },
});
```

Source: [Remix: Rendering UI, rendering pages through request context](https://docs.remix.run/rendering-ui/#rendering-pages-through-request-context)

## route-prefetching

Add `data-rmx-prefetch` to a link to load the destination on hover or focus (`intent`) or when it scrolls into view (`viewport`). `prefetch()` does the same from code.

```tsx
// app/ui/book-link.tsx
import { prefetch } from "remix/component";
import type { Handle } from "remix/component";
import { routes } from "../routes.ts";

export function BookLink(handle: Handle<{ bookId: string; title: string }>) {
  return () => (
    <a href={routes.books.show.href({ bookId: handle.props.bookId })} data-rmx-prefetch="intent">
      {handle.props.title}
    </a>
  );
}

// elsewhere, from custom logic
prefetch(routes.books.show.href({ bookId: "dune" }));
```

Source: [Remix: Interactivity, prefetch links before navigation](https://docs.remix.run/interactivity/)

## streaming-ssr

The `render()` middleware streams the component tree. A `<Frame>` with a `fallback` sends the fallback in the first chunk, then streams the frame route's HTML when it is ready.

```tsx
// app/router.ts
import { render } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { assets } from "./assets.ts";

export const router = createRouter({
  middleware: [render({ assets })],
});

// app/actions/books/show-page.tsx
<main>
  <h1>{book.title}</h1>
  <Frame
    src={routes.books.reviews.href({ bookId: book.id })}
    fallback={<p>Loading reviews…</p>}
  />
</main>
```

Source: [Remix: Streaming UI with frames, stream a fallback first](https://docs.remix.run/streaming-ui-with-frames/)

## early-hints

There is no Early Hints API, so set a `Link` preload header yourself on the response the action returns.

```tsx
// app/actions/books/controller.tsx
import { assets, stylesheetHref } from "../../assets.ts";

// inside the show action:
let coverHref = await assets.getHref("app/ui/public/cover.jpg");

return context.render(<BookPage book={book} coverHref={coverHref} />, {
  headers: {
    Link: [
      `<${stylesheetHref}>; rel=preload; as=style`,
      `<${coverHref}>; rel=preload; as=image; fetchpriority=high`,
    ].join(", "),
  },
});
```

Source: [Remix: Rendering UI, rendering pages through request context](https://docs.remix.run/rendering-ui/#rendering-pages-through-request-context)

## islands

Pages are server HTML. Only a component wrapped in `clientEntry(import.meta.url, ...)` is loaded and hydrated in the browser, with its props serialized into the page.

```tsx
// app/actions/books/public/add-to-cart.tsx
import { clientEntry, on } from "remix/component";
import type { Handle } from "remix/component";

export const AddToCart = clientEntry(
  import.meta.url,
  function AddToCart(handle: Handle<{ bookId: string }>) {
    let added = false;
    return () => (
      <button
        type="button"
        mix={on("click", () => {
          added = true;
          handle.update();
        })}
      >
        {added ? "Added" : "Add to cart"}
      </button>
    );
  },
);
```

Source: [Remix: Interactivity, hydration boundaries with clientEntry](https://docs.remix.run/interactivity/#cliententry)

## render-modes

Every route renders per request. To serve one page as static HTML, render it once at startup with `renderToString()` and return the stored string from that route.

```tsx
// app/router.ts
import { renderToString } from "remix/component/server";
import { render } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import { createRouter } from "remix/router";
import { assets } from "./assets.ts";
import { AboutPage } from "./actions/about-page.tsx";

// rendered once, when the server starts
const aboutHtml = await renderToString(<AboutPage />);

export const router = createRouter({ middleware: [render({ assets })] });

router.get("/about", () =>
  createHtmlResponse(aboutHtml, { headers: { "Cache-Control": "public, max-age=3600" } }),
);
// all other routes: context.render(...) on each request
```

Source: [Remix: Streaming UI with frames, render the response as a stream](https://docs.remix.run/streaming-ui-with-frames/#server-rendering-with-rendertostream-and-rendertostring)

## picture

There is no image component, so write `<picture>` yourself. Resolve each crop and format with `assets.getHref()` transforms in the action and pass the URLs in as props.

```tsx
// app/ui/hero-image.tsx
import type { Handle } from "remix/component";
import { assets } from "../assets.ts";

export async function getHeroSources() {
  let get = (file: string, transform: (string | [string, string])[]) => assets.getHref(`app/ui/public/${file}`, { transform });
  return {
    square: await get("hero-square.jpg", [["resize", "640"], "webp"]),
    wide: await get("hero-wide.jpg", [["resize", "1280"], "webp"]),
    fallback: await get("hero-wide.jpg", [["resize", "1280"]]),
  };
}

export function HeroImage(handle: Handle<Awaited<ReturnType<typeof getHeroSources>>>) {
  return () => (
    <picture>
      {/* art direction: a square crop on narrow screens */}
      <source media="(max-width: 640px)" type="image/webp" srcset={handle.props.square} />
      <source type="image/webp" srcset={handle.props.wide} />
      <img src={handle.props.fallback} alt="Shelves of books" width={1280} height={720}
           fetchpriority="high" decoding="async" />
    </picture>
  );
}
```

Source: [Remix: Files and assets, transform images and other files](https://docs.remix.run/files-and-assets/)

## reactivity

State is a plain variable in setup scope. The component renders again only when you call `handle.update()`.

```tsx
// app/ui/public/counter.tsx
import { on } from "remix/component";
import type { Handle } from "remix/component";

export function Counter(handle: Handle<{ initialCount: number }>) {
  let count = handle.props.initialCount;

  return () => (
    <button
      type="button"
      mix={on("click", () => {
        count++;
        handle.update();
      })}
    >
      Count: {count}
    </button>
  );
}
```

Source: [Remix: Interactivity, state, updates, and post-render tasks](https://docs.remix.run/interactivity/)

## bundle-analysis

There is no bundle. The `remix assets` CLI lists every file the browser can reach and explains one URL. It reads the `assets` section of `remix.json` and does not report sizes.

```jsonc
// remix.json
{
  "$schema": "./node_modules/remix/schema/remix.json",
  "assets": {
    "basePath": "/assets",
    "allowFiles": ["app/routes.ts", "app/**/public/**"],
    "allowPackages": ["remix"],
    "files": { "extensions": [".svg", ".png", ".jpg", ".woff2"] }
  }
}
```

```sh
npx remix assets                                   # URL -> file for every reachable file
npx remix assets inspect /assets/app/ui/public/cart.ts
```

Source: [Remix: Files and assets, debug asset URLs with remix assets](https://docs.remix.run/files-and-assets/)

## third-party-scripts

There is no script loader. Put the `<script>` tag in the document shell's `<head>` with `async` or `defer`.

```tsx
// app/actions/document.tsx
export function Document(handle: Handle<DocumentProps>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{handle.props.title ?? "Books"}</title>
        {/* … import map, module preloads, entry script */}
        <script async src="https://plausible.io/js/script.js" data-domain="books.example.com"></script>
      </head>
      <body>{handle.props.children}</body>
    </html>
  );
}
```

Source: [Remix: Rendering UI, document shells and head content](https://docs.remix.run/rendering-ui/#document-shells-and-head-content)

## multi-host-deployment

The router is a Fetch handler. Node wraps it with `createRequestListener`; Bun, Deno and Workers call `router.fetch` directly.

```ts
// server.ts (Node)
import * as http from "node:http";
import { createRequestListener } from "remix/node-fetch-server";
import { router } from "./app/router.ts";

http.createServer(createRequestListener(router.fetch)).listen(44100);

// server.ts (Bun)
Bun.serve({ port: 44100, fetch: (request) => router.fetch(request) });

// server.ts (Deno)
Deno.serve({ port: 44100 }, router.fetch);

// worker.ts (Cloudflare)
export default { fetch: (request) => router.fetch(request) } satisfies ExportedHandler;
```

Source: [Remix: Request handling, alternate runtimes](https://docs.remix.run/request-handling/#alternate-runtimes-bun-deno-workers)

## service-worker

Write `sw.js` by hand, serve it from the root `public/` directory with `staticFiles()` so its scope is `/`, and register it from the browser entry.

```ts
// app/router.ts
export const router = createRouter({
  middleware: [staticFiles("./public", { index: false }), render({ assets })],
});

// app/actions/public/entry.ts
import { run } from "remix/component";

let app = run({ /* loadModule, … */ });
await app.ready();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js");
}
```

Source: [Remix: Request handling, common middleware](https://docs.remix.run/request-handling/#common-middleware)
