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
	/**
	 * An `outbound_click` for clicks on links to another site, scoped to the
	 * destination (or the link's `data-numbers-id`). Default off.
	 */
	outbound?: boolean
	/**
	 * A `file_download` for clicks on links to a file, scoped to its name (or
	 * the link's `data-numbers-id`). Default off.
	 */
	downloads?: boolean
	/**
	 * A `form_submit` for every submitted form, scoped to its
	 * `data-numbers-id`, its `id`, or its action. Default off.
	 */
	forms?: boolean
}

// Documents, archives and media, not images a browser shows inline (a link
// with `download` still counts, whatever it points at).
const DOWNLOAD_EXTENSIONS = [
	'7z',
	'avi',
	'csv',
	'doc',
	'docx',
	'gz',
	'mov',
	'mp3',
	'mp4',
	'pdf',
	'ppt',
	'pptx',
	'rar',
	'tar',
	'txt',
	'wav',
	'xls',
	'xlsx',
	'xml',
	'zip',
]

const isDownload = (url: URL, link: HTMLAnchorElement) =>
	link.hasAttribute('download') ||
	DOWNLOAD_EXTENSIONS.includes(
		url.pathname.split('.').pop()?.toLowerCase() ?? '',
	)

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
	/** Sends a `form_submit` for a form, scoped to its id or action. */
	formSubmit: (form: HTMLFormElement, scope?: string) => Sent | null
	/** Sends a test's or flag's assignment, once per subject per client. */
	expose: (exposure: Exposure) => Sent | null
	/** Starts automatic tracking; returns a function that stops it. */
	autoTrack: (options?: AutoTrackOptions) => () => void
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
	storage = 'cookie',
}: NumbersOptions): NumbersClient => {
	let visitor: Visitor | null = null
	let device = givenDevice
	let url = endpoint
	// Epoch ms until which sending is paused after a 429.
	let pausedUntil = 0
	let firstPageView = true
	let stopAutoTrack: (() => void) | null = null
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
		visitor ??= loadVisitor(storage)
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
			// A CORS-safelisted type, so a browser sends the event without a
			// preflight; numbers parses the body as JSON either way.
			headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
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

	const formScope = (form: HTMLFormElement) => {
		const given = form.getAttribute('data-numbers-id') || form.id
		if (given) return given
		try {
			const action = new URL(form.action, location.href)
			return action.origin === location.origin
				? action.pathname
				: `${action.origin}${action.pathname}`
		} catch {
			return 'form'
		}
	}

	const formSubmit: NumbersClient['formSubmit'] = (form, scope) =>
		track('form_submit', scope || formScope(form))

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
		outbound = false,
		downloads = false,
		forms = false,
	}: AutoTrackOptions = {}) => {
		if (!isBrowser()) return () => {}
		// A second call replaces the first instead of stacking listeners, so a
		// site can add outbound/download/form tracking to the script's autoTrack.
		stopAutoTrack?.()
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

		if (outbound || downloads) {
			const onLinkClick = (event: MouseEvent) => {
				const target = event.target as Element | null
				const link = target?.closest?.('a[href]') as HTMLAnchorElement | null
				if (!link) return
				let url: URL
				try {
					url = new URL(link.href, location.href)
				} catch {
					return
				}
				const id = link
					.closest('[data-numbers-id]')
					?.getAttribute('data-numbers-id')
				if (downloads && isDownload(url, link))
					track(
						'file_download',
						id ?? url.pathname.split('/').pop() ?? url.pathname,
					)
				else if (
					outbound &&
					url.origin !== location.origin &&
					/^https?:$/.test(url.protocol)
				)
					track('outbound_click', id ?? `${url.origin}${url.pathname}`)
			}
			document.addEventListener('click', onLinkClick, true)
			stops.push(() => document.removeEventListener('click', onLinkClick, true))
		}

		if (forms) {
			const onSubmit = (event: Event) => {
				const form = event.target
				if (form instanceof HTMLFormElement) formSubmit(form)
			}
			document.addEventListener('submit', onSubmit, true)
			stops.push(() => document.removeEventListener('submit', onSubmit, true))
		}

		const stop = () => {
			for (const fn of stops) fn()
			if (stopAutoTrack === stop) stopAutoTrack = null
		}
		stopAutoTrack = stop
		return stop
	}

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
		formSubmit,
		expose,
		autoTrack,
	}
}
