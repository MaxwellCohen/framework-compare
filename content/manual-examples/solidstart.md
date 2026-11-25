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
