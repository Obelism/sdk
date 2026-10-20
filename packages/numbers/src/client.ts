import { type Events, getEvents } from '@obelism/events-sdk'

import {
	DEFAULT_ENDPOINT,
	MAX_BODY_BYTES,
	MAX_CURRENCY_LENGTH,
	MAX_FIELD_LENGTH,
	RATE_LIMIT_COOLDOWN_MS,
} from './constants'
import { detectDevice, getScreenSize } from './device'
import { getExternalReferrer, getPageContext } from './page'
import type {
	BeaconCommon,
	Device,
	Environment,
	EventBeacon,
	EventName,
	Exposure,
	ExposureBeacon,
	NumbersOptions,
	TrackOptions,
} from './types'
import { loadVisitor, type Visitor } from './visitor'

export type AutoTrackOptions = {
	/** A page view now and on every client-side navigation. Default on. */
	pageViews?: boolean
	/**
	 * A `click` event, scoped to the id, for every click on or inside an
	 * element with `data-numbers-id="…"`. Default on.
	 */
	clicks?: boolean
}

/** What a send resolves to: the response, or nothing when it failed. */
export type Sent = Promise<Response | undefined>

export type NumbersClient = {
	readonly organizationId: string
	readonly spaceId: string | undefined
	readonly environment: Environment
	/** The visitor, from the cookie or new. `null` outside the browser. */
	visitor: () => Visitor | null
	/** Replaces the device categories, e.g. from a fuller user-agent parser. */
	setDevice: (device: Device) => void
	setEndpoint: (endpoint: string) => void
	/**
	 * Sends an event. `scope` is the stable second half of its identity, e.g.
	 * `'homepage_hero_signup'` (default: the page's path). `null` when nothing
	 * was sent: outside the browser, deduplicated, or paused after a 429.
	 */
	track: (
		event: EventName,
		scope?: string,
		options?: TrackOptions,
	) => Sent | null
	/** Sends a page view of the current page. */
	pageView: () => Sent | null
	/** Sends a test's or flag's assignment, once per subject per client. */
	expose: (exposure: Exposure) => Sent | null
	/** Starts page views and click tracking; returns a function that stops them. */
	autoTrack: (options?: AutoTrackOptions) => () => void
	/**
	 * Subscribes to an events SDK bus (default: the page's, `getEvents()`)
	 * and sends what it carries: its events (`page_view` as a page view) and
	 * exposures, those from before it connected too. Returns a function that
	 * disconnects.
	 */
	connect: (events?: Events) => () => void
}

const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/

const parseRetryAfterMs = (header: string | null) => {
	if (!header) return undefined
	const seconds = Number(header)
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)
	const date = Date.parse(header)
	return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}

const isBrowser = () =>
	typeof window !== 'undefined' && typeof document !== 'undefined'

export const createNumbers = ({
	organizationId,
	spaceId,
	environment = 'production',
	endpoint = DEFAULT_ENDPOINT,
	device: givenDevice,
	disableWarnings = false,
}: NumbersOptions): NumbersClient => {
	let visitor: Visitor | null = null
	let device = givenDevice
	let url = endpoint
	// Epoch ms until which sending is paused after a 429.
	let pausedUntil = 0
	let firstPageView = true
	const sentKeys = new Set<string>()
	const exposed = new Set<string>()
	const warned = new Set<string>()

	const warn = (key: string, message: string) => {
		if (disableWarnings || warned.has(key)) return
		warned.add(key)
		if (typeof console !== 'undefined') console.warn(`[numbers] ${message}`)
	}

	const getVisitor = () => {
		if (!isBrowser()) return null
		visitor ??= loadVisitor()
		return visitor
	}

	const common = <T extends 'event' | 'exposure'>(
		type: T,
		current: Visitor,
	): BeaconCommon<T> => {
		device ??= detectDevice(navigator.userAgent)
		return {
			type,
			organizationId,
			...(spaceId && { spaceId }),
			environment,
			visitorId: current.id,
			pointer: device.pointer,
			device: device.device,
			screen: getScreenSize(),
			browser: device.browser,
			os: device.os,
			visitor: current.recurring ? 'recurring' : 'new',
		}
	}

	// A `keepalive` fetch, so it outlives a navigation. Never rejects.
	const send = (body: EventBeacon | ExposureBeacon, label: string): Sent => {
		const serialized = JSON.stringify(body)
		if (
			typeof TextEncoder !== 'undefined' &&
			new TextEncoder().encode(serialized).length > MAX_BODY_BYTES
		)
			warn(
				`size:${label}`,
				`"${label}" is over ${MAX_BODY_BYTES} bytes and will be refused: trim its \`params\`.`,
			)
		return fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: serialized,
			keepalive: true,
		}).then(
			(response) => {
				// Over the Organization's limit: back off, by Retry-After when given.
				if (response.status === 429)
					pausedUntil =
						Date.now() +
						(parseRetryAfterMs(response.headers.get('Retry-After')) ??
							RATE_LIMIT_COOLDOWN_MS)
				return response
			},
			() => undefined,
		)
	}

	const paused = () => Date.now() < pausedUntil

	const sendEvent = (
		event: string,
		scope: string,
		options: TrackOptions,
		referrer?: string,
	) => {
		const current = getVisitor()
		if (!current || paused()) return null

		const { value, currency, params, dedupeKey } = options
		if (dedupeKey !== undefined) {
			const key = `${event}:${dedupeKey}`
			if (sentKeys.has(key)) return null
			sentKeys.add(key)
		}

		const body: EventBeacon = {
			...common('event', current),
			...getPageContext(),
			event: event.slice(0, MAX_FIELD_LENGTH),
			scope: scope.slice(0, MAX_FIELD_LENGTH),
		}
		if (referrer) body.referrer = referrer
		if (typeof value === 'number' && Number.isFinite(value)) body.value = value
		if (currency) body.currency = currency.slice(0, MAX_CURRENCY_LENGTH)
		// numbers refuses `params` that aren't a plain object, and the event
		// with it: leave them out instead.
		if (params && typeof params === 'object' && !Array.isArray(params))
			body.params = params
		return send(body, event)
	}

	const track: NumbersClient['track'] = (event, scope, options = {}) => {
		if (!isBrowser()) return null
		if (!SNAKE_CASE.test(event))
			warn(
				`name:${event}`,
				`"${event}" isn't snake_case. Prefer GA4-style names like "add_to_cart" or "sign_up"; \`disableWarnings: true\` silences this.`,
			)
		return sendEvent(event, scope || location.pathname, options)
	}

	const pageView = () => {
		if (!isBrowser()) return null
		// Where the visit came from belongs to its first page view only.
		const referrer = firstPageView ? getExternalReferrer() : undefined
		firstPageView = false
		return sendEvent('page_view', location.pathname, {}, referrer)
	}

	const expose = (exposure: Exposure) => {
		const current = getVisitor()
		if (!current || paused()) return null
		const key = `${exposure.subjectKind}:${exposure.subjectId}`
		if (exposed.has(key)) return null
		exposed.add(key)
		return send({ ...common('exposure', current), ...exposure }, key)
	}

	const autoTrack = ({
		pageViews = true,
		clicks = true,
	}: AutoTrackOptions = {}) => {
		if (!isBrowser()) return () => {}
		const stops: (() => void)[] = []

		if (pageViews) {
			// One page view per path: replaceState for a query or hash change
			// isn't a new page.
			let lastPath: string | null = null
			const onNavigate = () => {
				if (location.pathname === lastPath) return
				lastPath = location.pathname
				pageView()
			}
			const wrap = (name: 'pushState' | 'replaceState') => {
				const original = history[name]
				const wrapped: typeof original = function (this: History, ...args) {
					const result = original.apply(this, args)
					onNavigate()
					return result
				}
				history[name] = wrapped
				stops.push(() => {
					// Leave a wrapper someone added after ours in place.
					if (history[name] === wrapped) history[name] = original
				})
			}
			wrap('pushState')
			wrap('replaceState')
			window.addEventListener('popstate', onNavigate)
			stops.push(() => window.removeEventListener('popstate', onNavigate))
			onNavigate()
		}

		if (clicks) {
			// Captured, so a handler that stops the click still counts it.
			const onClick = (event: MouseEvent) => {
				const target = event.target as Element | null
				const id = target
					?.closest?.('[data-numbers-id]')
					?.getAttribute('data-numbers-id')
				if (id) track('click', id)
			}
			document.addEventListener('click', onClick, true)
			stops.push(() => document.removeEventListener('click', onClick, true))
		}

		return () => {
			for (const stop of stops) stop()
		}
	}

	const connect = (events: Events = getEvents()) =>
		events.subscribe((event) => {
			if (event.kind === 'exposure') {
				const { subjectKind, subjectId, variant } = event
				expose({ subjectKind, subjectId, variant })
			} else if (event.name === 'page_view') pageView()
			else
				track(event.name, event.scope, {
					value: event.value,
					currency: event.currency,
					params: event.params,
					dedupeKey: event.dedupeKey,
				})
		})

	return {
		organizationId,
		spaceId,
		environment,
		visitor: getVisitor,
		setDevice: (next) => {
			device = next
		},
		setEndpoint: (next) => {
			url = next
		},
		track,
		pageView,
		expose,
		autoTrack,
		connect,
	}
}
