# Obelism Improve NextJS SDK

The NextJS SDK sits around the [Javascript Server SDK](https://improve.obelism.studio/docs/sdk/javascript#server) and gives React specific handlers.

## Install

```bash
npm i @obelism/improve-sdk-next
```

## Generator

The main export exposes a generator to create the middleware handler using the passed configuration.

```ts
import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { generateImproveNextMiddleware } from '@obelism/improve-sdk-next'

const improveMiddlewareHandler = generateImproveNextMiddleware({
	improveSdk: new ImproveServerSDK(IMPROVE_ARGS),
	serverABtests: [],
})
```

### improveSdk

```ts
generateImproveNextMiddleware({
	improveSdk: ImproveServerSDK,
})
```

The [ImproveServerSDK](https://improve.obelism.studio/docs/sdk/javascript#server) to be used. Required to be loaded with a configuration in place before handlig requests.

### serverABtests

```ts
generateImproveNextMiddleware({
    serverABtests: ServerABTestConfig[]
})
```

Not every AB test from the config needs to be used be used for the middleware handler. For each one that does need to be used it needs to be passed in this argument. Each entry in this list resembles one server side AB test.

```ts
export type OptionConfig = {
	value: string // Should match the slug from the option
	slug: string // Slug to send people towards when this version is active
}

export type ServerABTestConfig = {
	// Needs to match an AB test in Improve
	slug: string

	// Route to run the AB test on, usually this matches the slug
	routeHandler: string

	// For more complicated rewrites pass a function to format a NextUrl based on the matching option
	formatSlug?: (url: NextURL, matchingOption: OptionConfig) => NextURL

	// List of options for the AB test
	options: OptionConfig[]
}
```

## MiddlewareHandler

```ts
const improveMiddlewareHandler = generateImproveNextMiddleware(...)

export const middleware = async (request: NextRequest) => {
	return improveMiddlewareHandler(request)
}
```

The generated handler based on your configuration. Receives a `NextRequest` and rewrites based on one of three reasons:

- Search parameters matching a valid test with option configuration. Recommended for development or testing purposes, shouldn't be used for real users since it will impact the distribution.
- AB test cookie value which matches a valid test for name with option for value, the `improveMiddlewareHandler` will both read and write this cookie
- Visitor ID cookie, for long running servers the `ImproveServerSDK` will also be able to store the saved decision for a visitor in memory and use that to serve the same result. For serverless or edge this won't work for this purpose.
