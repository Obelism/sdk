import { startAutoTrack } from './autoTrack'
import type {
	BusEvent,
	EmitOptions,
	Events,
	Exposure,
	Subscriber,
	TrackedEvent,
} from './types'

/** How many events a late subscriber is handed. */
export const REPLAY_LIMIT = 100

/** Where the page's bus lives, so every copy of this package shares it. */
export const GLOBAL_KEY = 'obelismEvents'

export type EventsWindow = Window & { [GLOBAL_KEY]?: Events }

const isBrowser = () =>
	typeof window !== 'undefined' && typeof document !== 'undefined'

// A subscriber that throws mustn't stop the others, nor the site's handler
// that emitted: report it the way an uncaught error would be.
const report = (error: unknown) => {
	if (typeof reportError === 'function') reportError(error)
	else if (typeof console !== 'undefined') console.error(error)
}

/**
 * A bus of its own. Sites want `getEvents()`, the page's one; this is for
 * tests and for keeping a widget's events apart.
 */
export const createEvents = (): Events => {
	const subscribers = new Set<Subscriber>()
	const buffer: BusEvent[] = []
	const emittedKeys = new Set<string>()
	const exposed = new Set<string>()
	let stopAutoTrack: (() => void) | null = null

	const publish = (event: BusEvent) => {
		buffer.push(event)
		if (buffer.length > REPLAY_LIMIT) buffer.shift()
		// A copy: a subscriber may unsubscribe, or subscribe another, meanwhile.
		for (const subscriber of Array.from(subscribers)) {
			try {
				subscriber(event)
			} catch (error) {
				report(error)
			}
		}
	}

	const emit: Events['emit'] = (name, options: EmitOptions = {}) => {
		if (!isBrowser()) return false
		const { scope, value, currency, params, dedupeKey } = options
		if (dedupeKey !== undefined) {
			const key = `${name}:${dedupeKey}`
			if (emittedKeys.has(key)) return false
			emittedKeys.add(key)
		}
		const event: TrackedEvent = {
			kind: 'event',
			name,
			scope: scope || location.pathname,
			at: Date.now(),
		}
		if (value !== undefined) event.value = value
		if (currency !== undefined) event.currency = currency
		if (params !== undefined) event.params = params
		if (dedupeKey !== undefined) event.dedupeKey = dedupeKey
		publish(event)
		return true
	}

	const expose = ({ subjectKind, subjectId, variant }: Exposure) => {
		if (!isBrowser()) return false
		const key = `${subjectKind}:${subjectId}`
		if (exposed.has(key)) return false
		exposed.add(key)
		publish({
			kind: 'exposure',
			subjectKind,
			subjectId,
			variant,
			at: Date.now(),
		})
		return true
	}

	const subscribe: Events['subscribe'] = (
		subscriber,
		{ replay = true } = {},
	) => {
		if (!isBrowser()) return () => {}
		if (replay)
			// A copy: a subscriber that emits while replayed grows the buffer.
			for (const event of Array.from(buffer)) {
				try {
					subscriber(event)
				} catch (error) {
					report(error)
				}
			}
		subscribers.add(subscriber)
		return () => {
			subscribers.delete(subscriber)
		}
	}

	const autoTrack: Events['autoTrack'] = (options) => {
		if (!isBrowser() || stopAutoTrack) return () => {}
		const stop = startAutoTrack(emit, options)
		stopAutoTrack = stop
		return () => {
			if (stopAutoTrack !== stop) return
			stopAutoTrack = null
			stop()
		}
	}

	return { emit, expose, subscribe, autoTrack }
}

// Outside the browser: one bus that does nothing, so server rendering never
// keeps one request's events for the next.
let inert: Events | null = null

/**
 * The page's bus: on `window.obelismEvents`, made by whichever copy of this
 * package (or script tag) asked first. Safe on the server, where it does
 * nothing.
 */
export const getEvents = (): Events => {
	if (!isBrowser()) return (inert ??= createEvents())
	const target = window as EventsWindow
	return (target[GLOBAL_KEY] ??= createEvents())
}
