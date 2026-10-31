# Obelism Improve JS SDK

## Install

```bash
npm i @obelism/improve-sdk
```

## Class

The Improve JS SDK exposes two classes;

- [ImproveServerSDK](https://improve.obelism.studio/docs/sdk/javascript#server)
- [ImproveClientSDK](https://improve.obelism.studio/docs/sdk/javascript#client)
- [Types](https://improve.obelism.studio/docs/sdk/javascript#types)

While similar they both work slightly different but are based on the same base. This base defines the constructor and three methods;

### constructor

```ts
constructor({
	organizationId: string
	spaceId?: string
	environment: 'develop' | 'staging' | 'production'
	config?: Configuration
	fetchTimeout?: number
	dataLayer?: boolean
}) => void
```

- **organizationId** - Unique identifier of your Organization, available from your dashboard
- **spaceId** - (optional) The space (`space_…`) to work in: one site or project of your Organization, with its own tests, flags, audiences, API tokens and allowed origins. Copy it from Settings → Implementation. Without it, the Organization's first space
- **environment** - Application environment, can be one of three values
- **config** - (optional) Configuration file, this can be either fetched or provided on initialization
- **fetchTimeout** - (optional) When fetching the config after what amount of ms should it abort, default; 3000ms
- **dataLayer** - (optional) Mirror analytics onto the GTM `window.dataLayer` (with `improve: { test, variant, visitorId }` dimensions) so they can drive Google Tag Manager / Google Ads conversions. Default; `true`, set to `false` to opt out

### fetchConfig

```ts
async fetchConfig() => void
```

Asynchronous function that fetches the config from Improve. Either provide the config on initialization or use this function to get started.

### loadConfig

```ts
loadConfig = (config: ImproveConfiguration) => void
```

When loading an Improve config file from a different source you can either pass it directly into the class constructor or load it with the `loadConfig` method.

### generateVisitorId

```ts
generateVisitorId() => string
```

Method to get a unique identifier for a visitor. Recommended to save the generated visitor ID in a cookie with a max-age so that between visits you'll be able to keep serving the same version to this visitor.

### getVisitorCookieName

```ts
getVisitorCookieName() => string
```

Helper method that gives you the name for the visitorID cookie name. If this name is used on the server, the client will be able to pick up and send events to Improve.

### validateTestValue

```ts
validateTestValue = (testName: string, testValue: string) => boolean
```

Validate if a test name and test value are a valid combination. Requires a config to be loaded by either passing it in the constructor, using [loadConfig](/docs/sdk/javascript#loadconfig) or [fetchConfig](/docs/sdk/javascript#fetchconfig).

## Server

The server class is setup that it can run on either serverless or serverfull environments. When running in a serverfull envrionment it will use memory to keep track of recent visitors decisions. However it is recommend to always store the made decision in a cookie in case the memory has been purged between visits of a visitor.

### getFlagConfig

```ts
getFlagConfig(flagSlug: string) => {
	id: string
	name: string
	audience: string
	options: {
        name: string
        slug: string
        value: string | undefined
        split: number
    }[]
} | undefined
```

Exposed for when needed but in most cases it's recommended to use the [getFlagValue](/docs/sdk/javascript#getflagvalue) directly.

### getTestConfig

```ts
getTestConfig(testSlug: string) => {
	id: string
	name: string
	defaultValue: string
	audience: string
	allocation: number
	options: {
        name: string
        slug: string
        value: string | undefined
        split: number
    }[]
	events: {
        start: { event: string; scope: string }
        metrics: { event: string; scope: string }[]
        conversion: { event: string; scope: string }
    }
} | undefined
```

Exposed for when needed but in most cases it's recommended to use the [getTestValue](/docs/sdk/javascript#gettestvalue) directly.

### getFlagValue

```ts
getFlagValue = (flagSlug: string, visitorId: string, userAgent: string) =>
	string | null
```

Based on the slug, visitorId and userAgent this method gives you back what version of the flag this visitor should get. If no config is loaded yet or no flag with the given slug is found it returns `null`. When the userAgent of the visitor doesn't match the audience of the Flag it will always return the control value. If the visitor does match the audience it will receive the control or variation based on the randomization using the odds setup in the split.

### getTestValue

```ts
getTestValue = (testSlug: string, visitorId: string, userAgent: string) =>
	string | null
```

Based on the slug, visitorId and userAgent this method gives you back what version of the AB test this visitor should get. If no config is loaded yet or no AB test with the given slug is found it returns `null`. When the userAgent of the visitor doesn't match the audience of the Test it will always return the control value. If the visitor does match the audience it will then check the allocation. If that's lower than 100% it will based on randomization check if this visitor should get the AB test. After that it will receive a random version of the test based on the randomization using the odds setup in the split.

### Without a stored token

On Vercel, or in GitHub Actions, the server SDK can send the identity token its host gives it instead of an API token: nothing to store or rotate. Connect the deployment first, under **Connected deployments** on the space's page on www.obelism.studio, with Improve on for the environments it runs in (each maps to one environment of the space, which has to be the one the client asks for), then pass a token source:

```ts
import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { vercelOidc } from '@obelism/improve-sdk/oidc' // needs @vercel/oidc installed

const improve = new ImproveServerSDK({
	organizationId: 'org_…',
	environment: 'production',
	token: vercelOidc(), // or githubOidc() in a workflow with `permissions: id-token: write`
})
```

`token` takes any function that gives a token per request. The tokens are requested for `https://improve.obelism.studio`; for events sent straight to numbers, use `vercelOidc({ audience: 'https://numbers.obelism.studio' })`.

Locally, `vercelOidc()` works after `vercel link` and `vercel login`: it takes the token `vercel env pull` wrote, or asks Vercel for a new one with your sign-in. That token's environment is `development`, so the connection needs a rule for it with Improve on, and `environment` names the space environment that rule maps to. Anyone outside the Vercel team uses an API token.

## Client

### setupVisitor

```ts
setupVisitor(userAgent: string = window.navigator.userAgent) => string | null
```

Optional method to setup the visitor, if this is not called before using any of the other Client methods it will be called automatically. You only have to call this yourself if you want to make sure it gets the `userAgent` from somewhere else.

This method will automatically save the visitorID to the class and cookie + parse the userAgent to be used in the postAnalytic. The visitor comes from the [numbers SDK](https://www.npmjs.com/package/@obelism/numbers-sdk), which keeps it in the same `obelism_visitor_id` cookie, so it is the same visitor in numbers' own script tag. The old `visitorId` cookie is still read.

### getFlagValue

```ts
getFlagValue = (flagSlug: string) => string | null
```

Same as [getFlagValue](/docs/sdk/javascript#getflagvalue) on the server class this generates and give the unique value. However on the client it also saves the value to a cookie that's stored for one month.

### getTestValue

```ts
getTestValue = (testSlug: string) => string | null
```

Same as [getTestValue](/docs/sdk/javascript#gettestvalue) on the server class this generates and give the unique value. However on the client it also saves the value to a cookie that's stored for one month.

### setAnalyticsUrls

```ts
setAnalyticsUrls = (url: string) => void
```

Configure the analytics url to post message towards. Convenient in case add blockers block the direct post requests you can proxy them through your domain and pathname. By default events go to Obelism numbers (`https://numbers.obelism.studio/api/log`); with a custom `baseUrl` to that url's `/api/log`.

### postAnalytic

```ts
postAnalytic = (
	event: string,
	scope: string,
	payload?: ImproveAnalyticPayload,
) => Promise<Response> | null
```

Posts an analytic event to Obelism numbers or the url configured with [setAnalyticsUrls](/docs/sdk/javascript#setanalyticsurls), through the [numbers SDK](https://www.npmjs.com/package/@obelism/numbers-sdk): each event also carries the page's path and UTM tags. Exposures to tests and flags go the same way. Use the numbers SDK directly for page views and click tracking without tests.
`scope` is required — a short, stable identifier for where/what the event refers to
(e.g. `"homepage_hero_login"`), distinct from the optional `value`/`currency`/`params`/
`dedupeKey` extras in `payload`.
