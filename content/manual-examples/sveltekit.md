## bundle-analysis

Add `rollup-plugin-visualizer` after `sveltekit()` in the Vite config. `vite build` then writes a treemap of the bundle to `stats.html`.

```ts
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({ /* … */ }),
		visualizer({ filename: 'stats.html', gzipSize: true })
	]
});
```

Source: [SvelteKit: Performance](https://svelte.dev/docs/kit/performance)

## third-party-scripts

Install `@qwik.dev/partytown`, add its Vite plugin, and print the Partytown snippet in the root layout. Scripts tagged `type="text/partytown"` then run in a web worker instead of the main thread.

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';
import { partytownVite } from '@qwik.dev/partytown/utils';

export default { plugins: [sveltekit(), partytownVite()] };
```

```svelte
<!-- src/routes/+layout.svelte -->
<script>
	import { partytownSnippet } from '@qwik.dev/partytown/integration';
</script>

<svelte:head>
	<script>
		// Forward the necessary functions to the web worker layer
		partytown = { forward: ['dataLayer.push'] };
	</script>
	{@html '<script>' + partytownSnippet() + '</script>'}
	<script type="text/partytown" src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID-HERE"></script>
</svelte:head>
```

Source: [Partytown: SvelteKit](https://partytown.qwik.dev/sveltekit/)
