import { ImproveEventName } from '../types'

export type ImproveDataLayerEntry = {
	event: ImproveEventName
	improve: {
		// Events are test-independent; attribution to a test/variant happens
		// server-side by joining the visitor's exposures, so only the visitor is
		// carried here.
		visitorId: string
	}
	/** GA4 numeric value / currency, when provided on the analytic. */
	value?: number
	currency?: string
	/**
	 * Marks the entry as originating from Improve so platform-side dataLayer
	 * importers can ignore it (loop prevention).
	 */
	_improve: true
	/** Any extra event params (e.g. a GA4 `ecommerce` object) spread onto the entry. */
	[param: string]: unknown
}

declare global {
	interface Window {
		dataLayer?: Record<string, unknown>[]
	}
}

/**
 * Mirror an analytic onto the GTM dataLayer (with experiment dimensions) so it
 * can drive Google Tag Manager / Google Ads conversions. No-op outside the
 * browser. Initializes window.dataLayer if GTM hasn't yet.
 */
export const pushDataLayer = (entry: ImproveDataLayerEntry) => {
	if (typeof window === 'undefined') return

	window.dataLayer = window.dataLayer || []
	window.dataLayer.push(entry)
}

/**
 * Clear the dataLayer `ecommerce` object before pushing an ecommerce event, so
 * leftover keys (old `items`, a stale `coupon`…) from a previous event don't
 * bleed into the next one — the GTM/GA4 recommended reset. No-op outside the
 * browser.
 */
export const resetDataLayerEcommerce = () => {
	if (typeof window === 'undefined') return

	window.dataLayer = window.dataLayer || []
	window.dataLayer.push({ ecommerce: null })
}
