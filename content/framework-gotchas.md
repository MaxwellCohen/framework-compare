<!--
Site-authored split of each feature's "Gotchas" list (from the source comparison).
`## <featureId>` replaces that feature's Gotchas section:
  `### general` bullets stay in the feature page's Gotchas section;
  `### <frameworkId>` bullets move onto that framework's card.
A feature with no section here keeps the source list unchanged.
-->

## css-inlining

### nuxt
- Nuxt keeps `inlineStyles` off in dev so stylesheet HMR still works; check the production build.

### general
- A `?inline` import puts the whole stylesheet in every HTML response, so it only suits small stylesheets.

## font-optimization

### nuxt
- `@nuxt/fonts` reads Tailwind v4's `--font-*` theme variables, so the family name must be written there literally (not `var(--font-geist-sans)`) for it to resolve, download and preload the font.

### angular
- The critical CSS inliner (Beasties) inlines and preloads `@font-face` only for families written literally. Tailwind v4's `font-family: var(--font-sans)` hides the name, so put the font tokens in `@theme inline`.
- `optimization.fonts.inline` only inlines the provider CSS; the font files still load from the font host and nothing is preloaded. Built-in self-hosting is an open request: [angular/angular-cli#27038](https://github.com/angular/angular-cli/issues/27038).

### qwik-city
- `qwikVite` preloads every font file in the build by default (every Fontsource subset, on every page). This port turns that off with `disableFontPreload` and preloads one file.

### vike
- Vike preloads every font file the page CSS references (here, all 12 Geist subsets); vike-react doesn't expose `injectFilter`, so narrowing it means writing your own `onRenderHtml`.

### general
- Importing Fontsource alone does not preload anything. Without a `<link rel="preload">` the browser finds the font only after the stylesheet is parsed.

## image-pipeline

### nuxt
- IPX does not run on Cloudflare Workers, so this port switches image optimization off there.

### sveltekit
- Sharp does not run on Cloudflare Workers, so this port switches image optimization off there.
- `@sveltejs/enhanced-img` only processes local images at build time; remote covers need a runtime optimizer.

### astro
- The Vercel image service requests `q=100` unless `quality` is set on `<Image>`.

### general
- Unpic only builds URLs; something (IPX, a host CDN) still has to serve the resized image.

## caching

### tanstack-start-react
- TanStack's ISR is a headers pattern, not a framework cache: `s-maxage` plus `stale-while-revalidate` only helps if your CDN honors them.

### tanstack-start-solid
- TanStack's ISR is a headers pattern, not a framework cache: `s-maxage` plus `stale-while-revalidate` only helps if your CDN honors them.

### astro
- Vercel ISR in `@astrojs/vercel` ignores query strings (`allowQuery`), so pages driven by search params use the route cache with the adapter's CDN provider instead.

### solidstart
- Nitro's Netlify runtime only reads a numeric `isr` value; the object form (needed on Vercel to pass the query string through) does not give the same cache on Netlify.

### qwik-city
- `cacheControl()` skips `maxAge: 0` and has no `must-revalidate` option; use `noCache` to revalidate on every request.

### pracht
- A route's own `headers()` Cache-Control overrides the adapter's ISG/CDN headers.

### react-router
- `headers` cannot see the response status; force `no-store` for 4xx/5xx in `entry.server` (`handleRequest` / `handleDataRequest`), or the CDN keeps error pages.

### void-react
- ISR (`revalidate`) and deploy-time prerendering run only on the Cloudflare target. On `target: 'node'`, `bun` or `deno` they are ignored, so cache with `Cache-Control` from `routing.headers`.

### void-vue
- ISR (`revalidate`) and deploy-time prerendering run only on the Cloudflare target. On `target: 'node'`, `bun` or `deno` they are ignored, so cache with `Cache-Control` from `routing.headers`.

### void-svelte
- ISR (`revalidate`) and deploy-time prerendering run only on the Cloudflare target. On `target: 'node'`, `bun` or `deno` they are ignored, so cache with `Cache-Control` from `routing.headers`.

### void-solid
- ISR (`revalidate`) and deploy-time prerendering run only on the Cloudflare target. On `target: 'node'`, `bun` or `deno` they are ignored, so cache with `Cache-Control` from `routing.headers`.

### general
- Host cache layers differ (Vercel runtime cache, Netlify Blobs, Cloudflare KV), so a "cache" written for one host needs a storage driver for the others.

## route-prefetching

### tanstack-start-react
- Preloading is off until you set `defaultPreload`.
- `defaultPreloadStaleTime: 0` makes data loaded on hover stale at once, so the click loads it again. Use 0 only when an outside cache such as TanStack Query handles reuse.

### tanstack-start-solid
- Preloading is off until you set `defaultPreload`.

### waku
- Preloading is off until you pass a prop to the link.

### sveltekit
- Needs the `data-sveltekit-preload-data` attribute somewhere (the starter template adds it).

### general
- Prefetching spends bandwidth on routes the user may never visit; `intent` (hover/focus) is the conservative setting.

## islands

### nuxt
- `nuxt-client` hydration and `Lazy*` hydration only work on SFCs; slot content passed to `nuxt-client` components is not interactive.

### tanstack-start-react
- `<Hydrate>` is a newer API: check the linked guide for current behavior.

### tanstack-start-solid
- `<Hydrate>` is a newer API: check the linked guide for current behavior.

### pracht
- Server islands are a newer API: check the linked guide for current behavior.

### void-react
- Island pages have no client router: links out of them are full page loads.

### void-vue
- Island pages have no client router: links out of them are full page loads. In the local Vue build the island page's chunk, static component included, still sat in the main pages bundle; the island page itself never requested it.

### void-svelte
- Island pages have no client router: links out of them are full page loads.

### void-solid
- Island pages have no client router: links out of them are full page loads.

### general
- `<ClientOnly>` and `clientOnly` skip server rendering; they are not deferred hydration.

## render-modes

### next
- With Cache Components on, the `dynamic`, `revalidate`, `fetchCache`, and `dynamicParams` exports are removed and `runtime` is unsupported; other segment config such as `maxDuration` and `ensureStatic` remains. Do not expect `export const dynamic` to work.

### tanstack-start-react
- `ssr: false` still runs on the client only; `'data-only'` is the middle option.

### tanstack-start-solid
- `ssr: false` still runs on the client only; `'data-only'` is the middle option.

### void-react
- With `output: 'static'` on `target: 'node'` (1.12.2), the prerendered HTML is written to `dist/client`, but the Node server renders those pages again on every request. The local ports needed middleware to serve the files.

### void-vue
- With `output: 'static'` on `target: 'node'` (1.12.2), the prerendered HTML is written to `dist/client`, but the Node server renders those pages again on every request. The local ports needed middleware to serve the files.

### void-svelte
- With `output: 'static'` on `target: 'node'` (1.12.2), the prerendered HTML is written to `dist/client`, but the Node server renders those pages again on every request. The local ports needed middleware to serve the files.

### void-solid
- With `output: 'static'` on `target: 'node'` (1.12.2), the prerendered HTML is written to `dist/client`, but the Node server renders those pages again on every request. The local ports needed middleware to serve the files.

### general
- Static modes need an adapter that can serve prerendered output on the host you deploy to.

## reactivity

### next
- The native Rust build of the React Compiler (`experimental.turbopackRustReactCompiler`) is experimental in Next 16.4; the stable path runs the Babel plugin.

### tanstack-start-react
- The React Compiler is opt-in: add its Babel preset to the React Vite plugin.

### react-router
- The React Compiler is opt-in: add its Babel preset to the React Vite plugin.

### angular
- Angular updates per component, not per DOM node: when a signal changes, the whole template of each component that reads it re-runs (only changed bindings touch the DOM). Components that don't read the signal are not refreshed, and nothing is re-created. Finer-grained updates are proposed in [angular/angular#70333](https://github.com/angular/angular/issues/70333).

### general
- The React Compiler is opt-in for every React framework here: nothing changes until you add it to the build.
- This row says nothing about first paint; do not read it as a loading-speed feature.

## bundle-analysis

### astro
- Astro's recipe warns that a visualizer report may not match what the client downloads.

### general
- Run the analyzer against a production build; development bundles are not representative.

## third-party-scripts

### next
- Next's `worker` strategy is experimental and `pages/`-only.

### nuxt
- Nuxt's `partytown` option needs `@nuxtjs/partytown` installed and configured separately.

### general
- Without a strategy API, ordering and deferral are your job: put `async`/`defer` and placement choices in the tag yourself.

## multi-host-deployment

### next
- Next on Cloudflare and Netlify uses adapters that are experimental or maintained by the host.

### solidstart
- The Cloudflare and Netlify Vite plugins are maintained by the hosts.

### tanstack-start-react
- The Cloudflare and Netlify Vite plugins are maintained by the hosts.

### tanstack-start-solid
- The Cloudflare and Netlify Vite plugins are maintained by the hosts.

### waku
- Waku's Deno, Bun, and Lambda adapters are experimental.

### void-react
- On `target: 'node'` (1.12.2), a root dynamic page such as `pages/[id].tsx` catches files from `public/` (`/icon.svg` returns 404). Serve them from middleware that runs before routing.
- With `output: 'static'`, the prerender step runs in Node, so `target: 'bun'` fails with `Bun is not defined` unless you build with `bunx --bun vite build`. Deno fails the same way.
- The build stops if the project root has any dotenv file other than `.env`, such as `.env.example`, on every target.

### void-vue
- On `target: 'node'` (1.12.2), a root dynamic page such as `pages/[id].tsx` catches files from `public/` (`/icon.svg` returns 404). Serve them from middleware that runs before routing.
- With `output: 'static'`, the prerender step runs in Node, so `target: 'bun'` fails with `Bun is not defined` unless you build with `bunx --bun vite build`. Deno fails the same way.
- The build stops if the project root has any dotenv file other than `.env`, such as `.env.example`, on every target.

### void-svelte
- On `target: 'node'` (1.12.2), a root dynamic page such as `pages/[id].tsx` catches files from `public/` (`/icon.svg` returns 404). Serve them from middleware that runs before routing.
- With `output: 'static'`, the prerender step runs in Node, so `target: 'bun'` fails with `Bun is not defined` unless you build with `bunx --bun vite build`. Deno fails the same way.
- The build stops if the project root has any dotenv file other than `.env`, such as `.env.example`, on every target.

### void-solid
- On `target: 'node'` (1.12.2), a root dynamic page such as `pages/[id].tsx` catches files from `public/` (`/icon.svg` returns 404). Serve them from middleware that runs before routing.
- With `output: 'static'`, the prerender step runs in Node, so `target: 'bun'` fails with `Bun is not defined` unless you build with `bunx --bun vite build`. Deno fails the same way.
- The build stops if the project root has any dotenv file other than `.env`, such as `.env.example`, on every target.

### general
- Presets and adapters change the build output; they don't set up data caching. Most ports here still write their own host-specific cache code (see [section 4](#4-data-and-html-caching)).
