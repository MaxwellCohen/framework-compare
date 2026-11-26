## islands

Pages and layouts are Server Components by default and send no component JavaScript. Mark only the interactive part with `'use client'`. That component still hydrates, but the rest of the page stays server-only.

```tsx
// app/[id]/page.tsx (Server Component)
import LikeButton from '@/app/ui/like-button'
import { getPost } from '@/lib/data'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const post = await getPost(id)
  return (
    <main>
      <h1>{post.title}</h1>
      <LikeButton likes={post.likes} />
    </main>
  )
}
```

```tsx
// app/ui/like-button.tsx
'use client'

import { useState } from 'react'

export default function LikeButton({ likes }: { likes: number }) {
  // …
}
```

Source: [Next.js: Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)

## render-modes

With `cacheComponents: true`, a layout or page exports `ensureStatic` to say how much of the route must be static. The port sets `'shell'` on the root layout, so the App Shell is prerendered and request-specific content streams in behind `<Suspense>`. `'navigation'` would require the whole route to be static.

```tsx
// app/layout.tsx
import { Suspense } from 'react'
// …
// Every route's App Shell (sidebar, header, Suspense fallbacks) must stay static;
// request-specific content streams in behind Suspense at prefetch/navigation time.
export const ensureStatic = 'shell'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<HomeLinkFallback />}>
          <HomeLink />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
```

Source: [Next.js: ensureStatic](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/ensureStatic)
