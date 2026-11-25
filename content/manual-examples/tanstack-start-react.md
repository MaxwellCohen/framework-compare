## picture

Wrap the port's Unpic `<Image>` in a hand-written `<picture>`, and add `<Source>` from `@unpic/react` for each art-directed variant. Pass `<Source>` the same CDN settings the port's `Image` wrapper uses.

```tsx
// src/features/book/components/book-cover.tsx
import { Source } from '@unpic/react'
import { Image } from '@/components/ui/image'
import { imageCdn } from '@/lib/image-config'
// …
const small = src ?? EMPTY_IMAGE_URL
const size = { layout: 'constrained', width: COVER_IMAGE_WIDTH, height: COVER_IMAGE_HEIGHT } as const

return (
  <picture>
    <Source
      {...size}
      media="(min-width: 768px)"
      src={getLargeBookImageUrl(small)}
      cdn={imageCdn}
      options={imageCdn === 'ipx' ? { ipx: { baseURL: '/_ipx' } } : undefined}
    />
    <Image {...size} alt={title} src={small} sizes={sizes} priority={priority}
           className="absolute inset-0 size-full object-cover" objectFit="cover" unstyled />
  </picture>
)
```
