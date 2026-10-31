import type { VisitorStorage } from './visitor'

export type Environment = 'develop' | 'staging' | 'production'

/**
 * The visitor's device categories, as improve's audiences know them. The
 * client works them out from the user agent; an SDK that parses it more
 * thoroughly (improve's) passes its own.
 */
export type Device = {
	pointer: 'coarse' | 'fine'
	device: string
	browser: string
	os: string
}

export type NumbersOptions = {
	organizationId: string
	/**
	 * The space (`space_…`) the events belong to: one site or project of the
	 * organization. Without it, the organization's first space.
	 */
	spaceId?: string | undefined
	/** Default `production`. */
	environment?: Environment
	/**
	 * Where events go. Default `https://numbers.obelism.studio/api/log`; point
	 * it at a proxy on your own domain to get past ad blockers.
	 */
	endpoint?: string
	/** The device categories, when you parse the user agent yourself. */
	device?: Device
	/** Silence the development warnings (e.g. a name that isn't snake_case). */
	disableWarnings?: boolean
	/**
	 * Where the visitor id lives. Default `cookie`: the shared 30-day
	 * `obelism_visitor_id` cookie. `session` keeps it in sessionStorage for the
	 * tab only, and `none` makes a new id per page load: neither sets a cookie,
	 * for a site that counts visits without asking for consent.
	 */
	storage?: VisitorStorage
}

/**
 * Event names GA4 / Google Tag Manager recommend. Reusing them lines your
 * numbers up with any GA4 tagging you have.
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

export type TrackOptions = {
	/** A numeric value, e.g. an order total (GA4 `value`). */
	value?: number
	/** ISO 4217 currency for `value`, e.g. `'EUR'`. */
	currency?: string
	/** Extra parameters, stored as JSON (e.g. a GA4 `ecommerce` object). */
	params?: Record<string, unknown>
	/**
	 * Sends the event once per client for this event and key, e.g. an item id
	 * for a `view_item` fired every render. Not sent; without it every call
	 * sends.
	 */
	dedupeKey?: string
}

/**
 * A visitor's assignment to a test's or flag's variant, for SDKs that run
 * them (improve's). numbers attributes the visitor's events to it.
 */
export type Exposure = {
	subjectKind: 'test' | 'flag'
	subjectId: string
	variant: string
}

/** Fields every request carries. */
export type BeaconCommon<T extends 'event' | 'exposure'> = {
	type: T
	organizationId: string
	spaceId?: string
	environment: Environment
	visitorId: string
	pointer: string
	device: string
	screen: string
	browser: string
	os: string
	visitor: 'new' | 'recurring'
}

/** The page an event happened on. Paths leave without their query string. */
export type PageContext = {
	path?: string
	referrer?: string
	utmSource?: string
	utmMedium?: string
	utmCampaign?: string
}

export type EventBeacon = BeaconCommon<'event'> &
	PageContext & {
		event: string
		scope: string
		value?: number
		currency?: string
		params?: Record<string, unknown>
	}

export type ExposureBeacon = BeaconCommon<'exposure'> & Exposure
