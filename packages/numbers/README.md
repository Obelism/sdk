# Obelism numbers SDK

Page views, events and clicks on tagged elements, sent to
[Obelism numbers](https://numbers.obelism.studio): the events every Obelism
product shares, and their dashboard. The improve SDK sends its events
through this client, so a site with improve already has it; this package is
for numbers on its own.

## Script tag

No bundler needed:

```html
<script
	defer
	src="https://numbers.obelism.studio/script.js"
	data-organization="org_…"
	data-space="space_…"
	data-environment="production"
></script>
```

It sends a page view on load and on every client-side navigation, a `click`
for clicks on (or inside) an element with `data-numbers-id="…"`, and puts the
client on `window.numbers`:

```js
numbers.track('sign_up', 'footer_form')
```

A page view is counted once per pathname: a change that only touches the
query string or hash (`?tab=2`, `#pricing`) isn't a second page view.

`data-space` names the space (one site or project of the organization) the
events belong to; without it they go to the organization's first space.
`data-endpoint="https://…"` sends somewhere else, e.g. a proxy on your own
domain; without it events go to numbers' origin, even when a CDN serves the
file. `data-debug` turns on the development warnings (snake_case names, an 8 KB
body, a `data-organization` or `data-space` it can't use, an unknown
`data-environment` or `data-storage`), and
`data-storage="session"` (or `"none"`) counts without a cookie, and
`data-routes` takes the site's routes with ids in them (see
[Routes](#routes)), separated by spaces or commas. npm CDNs
serve the same file from `@obelism/numbers-sdk/dist/script.global.js`.

## Module

```bash
npm i @obelism/numbers-sdk
```

```ts
import { createNumbers } from '@obelism/numbers-sdk'

const numbers = createNumbers({
	organizationId: 'org_…',
	spaceId: 'space_…', // optional: without it, the organization's first space
	environment: 'production', // default; or 'develop', 'staging'
	// endpoint: 'https://numbers.obelism.studio/api/log',
	// disableWarnings: true,
})

// Page views now and on every navigation, and clicks on tagged elements.
const stop = numbers.autoTrack()
// { pageViews?, clicks?, outbound?, downloads?, forms? }

numbers.track('add_to_cart', 'product_page', {
	value: 59.95,
	currency: 'EUR',
	params: { ecommerce: { items: [{ item_id: 'sku_1' }] } },
})
numbers.track('view_item', 'list', { dedupeKey: 'sku_1' }) // once per key
numbers.formSubmit(form, 'newsletter') // or autoTrack({ forms: true })
numbers.pageView() // by hand, without autoTrack
numbers.flush() // send what is queued now, instead of on the next microtask
```

Events made in the same task go to numbers together: a checkout that tracks
its items, or a page that reports a list of impressions, is one request of up
to ten events (and at most 4 KB of JSON) instead of many. Events made in
different tasks (a page view, then a click) are separate requests, so nothing
waits to be collected.

`autoTrack({ outbound: true })` sends `outbound_click` for links to another
site, `downloads: true` sends `file_download` for links to a file, and
`forms: true` sends `form_submit` for each submitted form. Calling
`autoTrack` again replaces the previous listeners, so it doesn't double
count.

A site that sends its events from its own pipeline, without `autoTrack`, can
use the same link rules:

```ts
import { classifyLink, isDownload, isOutbound } from '@obelism/numbers-sdk'

document.addEventListener('click', (event) => {
	const link = classifyLink(event.target as Element) // or { outbound, downloads }
	// { event: 'file_download' | 'outbound_click', scope, params? } or null
	if (link) numbers.track(link.event, link.scope, { params: link.params })
})

isOutbound('https://elsewhere.example') // http(s) on another origin
isDownload(anchor.href, anchor) // a file by extension, or a `download` link
```

The client is safe to create during server rendering: outside the browser
every call does nothing and returns `null`.

### Events

An event is a name and a scope. Use snake_case names, the GA4 recommended
ones where they fit (`sign_up`, `add_to_cart`, `purchase`): the client warns
once about any other. The scope is the stable second half of its identity,
where or what it is about (`homepage_hero_signup`); it defaults to the page's
path. Every event carries the page's path and UTM tags, the first page view
also the referrer when it is another site. Query strings never leave the
browser.

An event sent after the visitor moved on (from a queue, or a pipeline that
waits for the page to load) can name the page it happened on, so it isn't
counted on the next one:

```ts
numbers.track('view_item', 'sku_1', { page: { url: productUrl } })
numbers.pageView({ page: { url } })
```

Its path and UTM tags then come from `url` (absolute, or relative to the
current page); a URL that isn't http(s) falls back to the current page. The
referrer doesn't: it stays the other site the visit came from, on the first
page view.

`value` and `currency` are summed into revenue per variant in improve.
`params` are stored as JSON. `track` returns `null` when it sent nothing,
otherwise a promise of the response (`undefined` when the request failed; it
never rejects).

### Routes

A page whose path holds an id (`/orders/ord_123`, `/invite/a8F…`) is a page
of its own in a report, one per record. `routes` lists those routes as
patterns, and a path that matches one is sent as the pattern: as every
event's path, the page view's scope, and the scope `track()` and
`formSubmit()` default to:

```ts
createNumbers({
	organizationId: 'org_…',
	routes: ['/orders/[orderId]', '/orders/new', '/invite/[token]'],
})
```

`[name]` matches one segment of the path. A static segment wins over a
parameter, so list a static route a pattern would also match
(`/orders/new`) to keep it apart. A trailing slash doesn't count. Paths are
compared as the browser has them, percent-encoded. Paths that match no
pattern are sent as they are.

### Tagged elements

```html
<section data-numbers-id="hero_signup">…</section>
```

A click on or inside it is a `click` event with scope `hero_signup`. numbers
shows the most clicked elements; Content tags its blocks with their id, so
its visual editor shows each block's click rate.

### Visitors

A visitor is a random id in the `obelism_visitor_id` cookie (`visi_` and 26
characters, 30 days from the last visit), the same cookie the improve SDK
uses. The old `visitorId` cookie is read and written too, for a deprecation
window, so a site that still runs an older improve SDK keeps one visitor.
`numbers.visitor()` returns `{ id, recurring }`. The device categories
(pointer, device, browser, os, screen size) come from the user agent; pass
`device` to `createNumbers` (or call `setDevice`) to use your own.

For a site that counts without asking for consent, `storage: 'session'`
keeps the id in sessionStorage for the tab and `storage: 'none'` makes a new
one on every client (so every full load in a page that isn't an SPA): neither
sets a cookie. The script takes the same as
`data-storage`.

To count every visitor and add the cookie only once they consent, start
without it and switch when the consent changes:

```ts
const numbers = createNumbers({ organizationId: 'org_…', storage: 'session' })
numbers.setStorage('cookie') // consent given
numbers.setStorage('session') // consent withdrawn: deletes the cookies
```

Moving to the cookie keeps the visitor's id, so the visit isn't split, unless
the cookie already holds a returning visitor's id: then that one is used.
Leaving the cookie (for `session` or `none`) deletes `obelism_visitor_id` and
`visitorId` and starts a new id, so later events can't be tied to what the
cookie collected. Pass the consent you already know to `createNumbers`, so
the first events use the right storage.

The client deletes the cookies it sets: for the current host, on `/`. The
improve SDK's middleware sets the same cookie on every request, with the
`domain` you give it; gate it on the same consent, or it comes back.

### Limits

Strings are capped to what numbers accepts (256 characters, currency 8),
and the client warns about a request over 8 KB, which numbers refuses. After
a `429` it stops sending for the `Retry-After`, or a minute.
