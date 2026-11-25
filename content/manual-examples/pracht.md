## picture

Call `getImageProps()` from `@pracht/image` once per art-directed source, then write the `<picture>` yourself. The loader configured in the port's `src/lib/images.ts` still builds every `srcset` URL.

```tsx
// src/features/book/components/book-cover.tsx
import { getImageProps } from '@pracht/image';
import { EMPTY_IMAGE_URL, getLargeBookImageUrl } from '@/features/book/book-constants';
import '@/lib/images';
// …
const small = src ?? EMPTY_IMAGE_URL;
const common = { alt: title, fill: true, priority, sizes };
const { srcset: desktop } = getImageProps({ ...common, src: getLargeBookImageUrl(small) });
const mobile = getImageProps({ ...common, src: small });

return (
  <picture>
    <source media="(min-width: 768px)" srcset={desktop} sizes={sizes} />
    <img {...mobile} className="size-full object-cover" onError={() => setFailedSrc(small)} />
  </picture>
);
```
