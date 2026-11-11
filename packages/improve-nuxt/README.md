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
	// Pages wait for the datafile: fail fast rather than retry.
	configRetries: 0,
	fetchTimeout: 2000,
})

export default generateImproveNuxtMiddleware({
	improveSdk,
	serverABtests: [{ slug: 'startpage-visual', routeHandler: '/' }],
})
```

For each request on a route with a server test, the middleware:

- leaves bots, non-GET requests, Nuxt's own requests (`/_nuxt/`,
  `/__nuxt_error`, payloads), `/api/` and files alone;
- fetches the datafile on the first request a server instance gets, and keeps
  it: a test changed after that reaches the instance when it restarts or
  through a deploy;
- reads the visitor and the variant from their cookies, or a query parameter
  named after the test (`/?startpage-visual=variation`, for testing a
  variant), and decides only when there is nothing to reuse;
- passes the visitor's country from `x-vercel-ip-country` or `cf-ipcountry`,
  so country audiences resolve;
- sets the `obelism_visitor_id` cookie and one named after the test;
- leaves the variants on `event.context.improve`.

`routeHandler` is the page route: a path (`/`), a parameter
(`/products/[id]`, letters, digits and `-`) or a catch-all
(`/blog/[...slug]`). Optional parameters (`[[id]]`) don't match. With
`app.baseURL` set, include it.

## Render the variant

Unlike Next.js, the request isn't rewritten to another route: Nuxt hydrates
the route the browser shows, so the page renders the variant itself. Hand the
server's decision to the browser with `useState`, and render the value of
`useTestValue` from `@obelism/improve-sdk-vue` with it as the fallback:

```vue
<script setup lang="ts">
import { getImproveContext } from '@obelism/improve-sdk-nuxt'
import { useTestValue } from '~/improve'

const decided = useState('improve:startpage-visual', () => {
	const event = useRequestEvent()
	return (event && getImproveContext(event)['startpage-visual']) || null
})
const variant = useTestValue('startpage-visual', decided.value ?? 'control')
</script>

<template>
	<HeroVariation v-if="variant === 'variation'" />
	<HeroControl v-else />
</template>
```

- On a page load the server decided: the first paint has the variant, and the
  browser reads the same value from the cookie once the SDK is set up, which
  records the exposure. The decision on the server alone is not one.
- After a client-side navigation no request reached the middleware, so the
  browser decides (and keeps it in the same cookie).

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
