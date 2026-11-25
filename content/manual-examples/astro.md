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
