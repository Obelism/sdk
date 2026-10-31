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
file. `data-debug` turns on the client's development warnings (snake_case
names, an 8 KB body, a `data-space` it can't use), and
`data-storage="session"` (or `"none"`) counts without a cookie. npm CDNs
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
```

`autoTrack({ outbound: true })` sends `outbound_click` for links to another
site, `downloads: true` sends `file_download` for links to a file, and
`forms: true` sends `form_submit` for each submitted form. Calling
`autoTrack` again replaces the previous listeners, so it doesn't double
count.

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

`value` and `currency` are summed into revenue per variant in improve.
`params` are stored as JSON. `track` returns `null` when it sent nothing,
otherwise a promise of the response (`undefined` when the request failed; it
never rejects).

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
uses. The old `visitorId` cookie is still read, so existing visitors keep
their id. `numbers.visitor()` returns `{ id, recurring }`. The device
categories (pointer, device, browser, os, screen size) come from the user
agent; pass `device` to `createNumbers` (or call `setDevice`) to use your
own.

For a site that counts without asking for consent, `storage: 'session'`
keeps the id in sessionStorage for the tab and `storage: 'none'` makes a new
one per page load: neither sets a cookie. The script takes the same as
`data-storage`.

### Limits

Strings are capped to what numbers accepts (256 characters, currency 8),
and the client warns about a request over 8 KB, which numbers refuses. After
a `429` it stops sending for the `Retry-After`, or a minute.
