# Obelism Improve Nuxt SDK

Server-side A/B tests for Nuxt: a Nitro server middleware decides the
visitor's variant before the page renders, so the first paint already has it.
It sits around the [Javascript Server SDK](https://improve.obelism.studio/docs/sdk/javascript#server).

## Install

```bash
npm i @obelism/improve-sdk @obelism/improve-sdk-nuxt
```

## Middleware

```ts
// server/middleware/improve.ts
import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { generateImproveNuxtMiddleware } from '@obelism/improve-sdk-nuxt'

const improveSdk = new ImproveServerSDK({
	organizationId: process.env.IMPROVE_ORGANIZATION_ID!,
	environment: 'production',
	token: process.env.IMPROVE_API_TOKEN!,
})

export default generateImproveNuxtMiddleware({
	improveSdk,
	serverABtests: [{ slug: 'startpage-visual', routeHandler: '/' }],
})
```

For each request on a route with a server test, the middleware:

- leaves bots alone;
- fetches the datafile once per server instance;
- reads the visitor and the variant from their cookies, or a query parameter
  named after the test (`/?startpage-visual=variation`, for testing a
  variant), and decides only when there is nothing to reuse;
- passes the visitor's country from `x-vercel-ip-country` or `cf-ipcountry`,
  so country audiences resolve;
- sets the `obelism_visitor_id` cookie and one named after the test;
- leaves the variants on `event.context.improve`.

`routeHandler` is the page route as Nuxt names it: `/`, `/products/[id]`,
`/blog/[...slug]`.

## Render the variant

Unlike Next.js, the request isn't rewritten to another route: Nuxt hydrates
the route the browser shows, so the page renders the variant itself. Read it
into `useState`, so the browser gets the server's value:

```vue
<script setup lang="ts">
import { getImproveContext } from '@obelism/improve-sdk-nuxt'

const variant = useState('improve:startpage-visual', () => {
	const event = useRequestEvent()
	return (event && getImproveContext(event)['startpage-visual']) || 'control'
})
</script>

<template>
	<HeroVariation v-if="variant === 'variation'" />
	<HeroControl v-else />
</template>
```

The decision on the server is not an exposure. Read the same test in the
browser with `useTestValue` from `@obelism/improve-sdk-vue`, with the server's
value as fallback: it reads the cookie and records the exposure.

Keep tested routes out of prerendering and route caches (`prerender`, `swr`,
`isr` in `routeRules`): a cached page shows one variant to everyone.

## Options

```ts
generateImproveNuxtMiddleware({
	improveSdk,
	serverABtests,
	options: {
		visitorId: { secure: true, sameSite: 'lax' },
		testValue: { maxAge: 60 * 60 * 24 * 30 },
	},
})
```

Cookie options for the visitor and the test cookies, as h3's `setCookie`
takes them. Defaults: `path: '/'` and a week.
