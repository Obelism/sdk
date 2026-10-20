import type { Exposure } from '@obelism/events-sdk'

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
}

// The event names and exposures are the events SDK's: the bus numbers
// subscribes to (`connect`) carries them.
export type {
	EventName,
	Exposure,
	RecommendedEventName,
} from '@obelism/events-sdk'

export type TrackOptions = {
	/** A numeric value, e.g. an order total (GA4 `value`). */
	value?: number | undefined
	/** ISO 4217 currency for `value`, e.g. `'EUR'`. */
	currency?: string | undefined
	/** Extra parameters, stored as JSON (e.g. a GA4 `ecommerce` object). */
	params?: Record<string, unknown> | undefined
	/**
	 * Sends the event once per client for this event and key, e.g. an item id
	 * for a `view_item` fired every render. Not sent; without it every call
	 * sends.
	 */
	dedupeKey?: string | undefined
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
