# Obelism events SDK

One event bus per page. The site publishes what the visitor did (`sign_up`
on the footer form, `add_to_cart` on a product page) and every tracker that
subscribes gets it. The trackers stay out of the site's code: a click on a
CTA emits one event, not a call per analytics tool.

[Obelism numbers](../numbers/README.md) is the first subscriber
(`numbers.connect()`).

```bash
npm i @obelism/events-sdk
```

```ts
import { getEvents } from '@obelism/events-sdk'

const events = getEvents()

events.emit('sign_up', { scope: 'footer_form' })
events.emit('purchase', {
	scope: 'checkout',
	value: 59.95,
	currency: 'EUR',
	params: { transaction_id: 'o_123' },
})
events.emit('view_item', { scope: 'list', dedupeKey: 'sku_1' }) // once per key

// Page views now and on every navigation, and clicks on tagged elements.
const stop = events.autoTrack() // { pageViews?: boolean, clicks?: boolean }
```

`getEvents()` is safe during server rendering: outside the browser nothing
is emitted or kept, and every call returns `false` or does nothing.

## Events

An event is a name and a scope. Use snake_case names, the GA4 recommended
ones where they fit (`sign_up`, `add_to_cart`, `purchase`). The scope is
the stable second half of its identity, where or what it is about
(`homepage_hero_signup`); it defaults to the page's path when emitted.
`value`, `currency` and `params` are passed on as they are; each subscriber
maps them to its own tracker.

`emit` returns `false` when nothing was emitted: on the server, or a
`dedupeKey` already emitted for that name on this page.

### Tagged elements

```html
<section data-events-id="hero_signup">…</section>
```

With `autoTrack`, a click on or inside it is a `click` event with scope
`hero_signup`. numbers' `data-numbers-id` works the same way.

### Exposures

SDKs that run tests and flags publish the visitor's assignment, once per
test or flag per page, so trackers can attribute events to the variant:

```ts
events.expose({ subjectKind: 'test', subjectId: 'test_…', variant: 'b' })
```

## Subscribing

```ts
const unsubscribe = events.subscribe((event) => {
	if (event.kind === 'event') gtag('event', event.name, event.params)
	// event.kind === 'exposure': event.subjectId, event.variant
})
```

A subscriber gets the events emitted before it subscribed too (the last
100), so a tracker that loads late (a deferred script, after consent)
misses nothing; `{ replay: false }` skips them. A subscriber that throws is
reported like an uncaught error and doesn't stop the others.

## One bus per page

`getEvents()` keeps the bus on `window.obelismEvents`, and uses the one
already there. Every copy of this package on the page (the site's bundle,
the numbers script tag, another SDK's dependency) shares it, and sites
without a bundler can emit on it:

```js
obelismEvents.emit('sign_up', { scope: 'footer_form' })
```

`createEvents()` makes a bus of its own, for tests or for keeping a widget's
events apart.
