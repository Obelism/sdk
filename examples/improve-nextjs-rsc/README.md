# Next.js — React Server Components + Cache Components

An A/B testing example using the [Obelism Improve](https://improve.obelism.studio)
SDK with **React Server Components** and Next.js **[Cache Components](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)**.

Unlike the [`nextjs`](../nextjs) example — which rewrites the URL per variant in
the proxy — this example keeps a **single URL** and resolves the variant
**server-side inside a Server Component**.

## How it works

1. **Proxy** (`src/proxy.ts`, formerly `middleware.ts`) assigns the visitor to a variant and
   persists it in cookies. It does **not** rewrite the URL; it forwards the
   cookie on the request so the Server Component can read it during the same
   render.
2. **`cacheComponents: true`** (`next.config.ts`) makes the route static by
   default and requires every dynamic read to sit inside `<Suspense>`.
3. **`CachedContent`** uses the `"use cache"` directive — it is shared,
   prerendered and the same for every visitor.
4. **`Experiment`** is a Server Component that reads the variant cookie (a
   dynamic API), so it is rendered inside `<Suspense>` and streamed in
   per request. No client round-trip and no URL rewrite are needed to pick the
   variant.
5. Client components (`Visual`, `TrackPageView`) only handle analytics via the
   `@obelism/improve-sdk-react` provider.

## Run locally

```bash
npm run dev   # http://localhost:3003
```

Refresh the page: the **cached shell timestamp stays fixed** while the
**variant** is resolved per request.
