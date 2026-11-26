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
- The official `@nuxt/fonts` module is first-party, but this port uses Fontsource instead.

### pracht
- Pracht has a first-party font feature, but this port uses Fontsource instead.

### general
- Importing Fontsource alone does not preload anything. Without a `<link rel="preload">` the browser finds the font only after the stylesheet is parsed.

## image-pipeline

### nuxt
- IPX does not run on Cloudflare Workers, so this port switches image optimization off there.

### sveltekit
- Sharp does not run on Cloudflare Workers, so this port switches image optimization off there.

### general
- Unpic only builds URLs; something (IPX, a host CDN) still has to serve the resized image.

## caching

### tanstack-start-react
- TanStack's ISR is a headers pattern, not a framework cache: `s-maxage` plus `stale-while-revalidate` only helps if your CDN honors them.

### tanstack-start-solid
- TanStack's ISR is a headers pattern, not a framework cache: `s-maxage` plus `stale-while-revalidate` only helps if your CDN honors them.

### general
- Host cache layers differ (Vercel runtime cache, Netlify Blobs, Cloudflare KV), so a "cache" written for one host needs a storage driver for the others.

## route-prefetching

### tanstack-start-react
- Preloading is off until you set `defaultPreload`.

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

### general
- `<ClientOnly>` and `clientOnly` skip server rendering; they are not deferred hydration.

## render-modes

### next
- With Cache Components on, the `dynamic`, `revalidate`, `fetchCache`, and `dynamicParams` exports are removed and `runtime` is unsupported; other segment config such as `maxDuration` and `ensureStatic` remains. Do not expect `export const dynamic` to work.

### tanstack-start-react
- `ssr: false` still runs on the client only; `'data-only'` is the middle option.

### tanstack-start-solid
- `ssr: false` still runs on the client only; `'data-only'` is the middle option.

### general
- Static modes need an adapter that can serve prerendered output on the host you deploy to.

## reactivity

### next
- The native Rust build of the React Compiler (`experimental.turbopackRustReactCompiler`) is experimental in Next 16.4; the stable path runs the Babel plugin.

### tanstack-start-react
- The React Compiler is opt-in: add its Babel preset to the React Vite plugin.

### react-router
- The React Compiler is opt-in: add its Babel preset to the React Vite plugin.

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

### general
- Presets and adapters change the build output; they don't set up data caching. Most ports here still write their own host-specific cache code (see [section 4](#4-data-and-html-caching)).
