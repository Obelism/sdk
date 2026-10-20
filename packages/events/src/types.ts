/**
 * Event names GA4 / Google Tag Manager recommend. Reusing them lines your
 * events up with any GA4 tagging you have.
 *
 * @see https://support.google.com/analytics/answer/9267735
 */
export type RecommendedEventName =
	| 'page_view'
	| 'view_item'
	| 'view_item_list'
	| 'select_item'
	| 'add_to_cart'
	| 'remove_from_cart'
	| 'view_cart'
	| 'begin_checkout'
	| 'add_payment_info'
	| 'add_shipping_info'
	| 'purchase'
	| 'refund'
	| 'sign_up'
	| 'login'
	| 'search'
	| 'select_content'
	| 'share'
	| 'generate_lead'

/** An event's name: snake_case, any string, the GA4 ones suggested. */
export type EventName = RecommendedEventName | (string & {})

export type EmitOptions = {
	/**
	 * The stable second half of the event's identity, e.g.
	 * `'homepage_hero_signup'`. Default: the page's path when emitted.
	 */
	scope?: string | undefined
	/** A numeric value, e.g. an order total (GA4 `value`). */
	value?: number | undefined
	/** ISO 4217 currency for `value`, e.g. `'EUR'`. */
	currency?: string | undefined
	/** Extra parameters, e.g. a GA4 `ecommerce` object. */
	params?: Record<string, unknown> | undefined
	/**
	 * Emits the event once per page for this name and key, e.g. an item id
	 * for a `view_item` fired every render. Without it every call emits.
	 */
	dedupeKey?: string | undefined
}

/**
 * A visitor's assignment to a test's or flag's variant, published by SDKs
 * that run them (improve's). Trackers attribute the visitor's events to it.
 */
export type Exposure = {
	subjectKind: 'test' | 'flag'
	subjectId: string
	variant: string
}

/** What subscribers receive: something the visitor did. */
export type TrackedEvent = {
	kind: 'event'
	name: EventName
	scope: string
	value?: number
	currency?: string
	params?: Record<string, unknown>
	dedupeKey?: string
	/** Epoch ms when it was emitted, so a late subscriber sees when it was. */
	at: number
}

/** What subscribers receive: a variant the visitor was assigned. */
export type ExposureEvent = Exposure & {
	kind: 'exposure'
	at: number
}

export type BusEvent = TrackedEvent | ExposureEvent

export type Subscriber = (event: BusEvent) => void

export type SubscribeOptions = {
	/**
	 * Hands the subscriber the events emitted before it subscribed (the last
	 * 100), so a tracker that loads late misses nothing. Default on.
	 */
	replay?: boolean | undefined
}

export type AutoTrackOptions = {
	/** A `page_view` now and on every client-side navigation. Default on. */
	pageViews?: boolean | undefined
	/**
	 * A `click` event, scoped to the id, for every click on or inside an
	 * element with `data-events-id="…"` (or numbers' `data-numbers-id`).
	 * Default on.
	 */
	clicks?: boolean | undefined
}

export type Events = {
	/**
	 * Publishes an event to every subscriber. `false` when nothing was
	 * emitted: outside the browser or deduplicated.
	 */
	emit: (name: EventName, options?: EmitOptions) => boolean
	/** Publishes a test's or flag's assignment, once per subject per page. */
	expose: (exposure: Exposure) => boolean
	/** Adds a subscriber; returns a function that removes it. */
	subscribe: (subscriber: Subscriber, options?: SubscribeOptions) => () => void
	/**
	 * Emits page views and clicks on tagged elements; returns a function that
	 * stops them. One at a time: while it runs, another call does nothing.
	 */
	autoTrack: (options?: AutoTrackOptions) => () => void
}
