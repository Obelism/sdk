import type { MetricWithAttribution } from 'web-vitals/attribution'

import type { EventName, TrackOptions } from './types'

export const WEB_VITAL_EVENT = 'web_vital'
export const VITALS_SAMPLE_KEY = 'obelism_vitals_sampled'

// LCP, FCP and TTFB describe the page the visit landed on; INP and CLS run
// until the visit ends, and are filed under the page open when they arrive.
const LANDING_VITALS: ReadonlyArray<MetricWithAttribution['name']> = [
	'LCP',
	'FCP',
	'TTFB',
]

/** A CSS selector's id made from a record would leak it: `#[id]`. */
const RECORD_ID = /#[^\s>.#:[]*\d[^\s>.#:[]*/g

export const scrubSelector = (selector: string) =>
	selector.replace(RECORD_ID, '#[id]')

const elementOf = (metric: MetricWithAttribution) => {
	switch (metric.name) {
		case 'LCP':
			return metric.attribution.target
		case 'INP':
			return metric.attribution.interactionTarget
		case 'CLS':
			return metric.attribution.largestShiftTarget
		default:
			return undefined
	}
}

export type VitalEvent = {
	event: EventName
	value: number
	options: TrackOptions
}

export const webVitalEvent = (
	metric: MetricWithAttribution,
	{
		sampleRate,
		release,
		landingUrl,
		routeUrl,
	}: {
		sampleRate: number
		release: string | undefined
		landingUrl: string
		routeUrl: string
	},
): VitalEvent => {
	const element = elementOf(metric)
	const page = LANDING_VITALS.includes(metric.name) ? landingUrl : routeUrl
	return {
		event: WEB_VITAL_EVENT,
		value: metric.value,
		options: {
			params: {
				rating: metric.rating,
				navigation: metric.navigationType,
				...(release && { release }),
				...(sampleRate < 1 && { sample: String(sampleRate) }),
				...(element && { element: scrubSelector(element) }),
			},
			page: { url: page },
		},
	}
}

export const inSample = (
	rate: number,
	store: Pick<Storage, 'getItem' | 'setItem'> | undefined,
) => {
	if (!(rate < 1)) return true
	try {
		const stored = store?.getItem(VITALS_SAMPLE_KEY)
		if (stored !== null && stored !== undefined) return stored === '1'
		const sampled = Math.random() < rate
		store?.setItem(VITALS_SAMPLE_KEY, sampled ? '1' : '0')
		return sampled
	} catch {
		return Math.random() < rate
	}
}

export const safeSessionStorage = () => {
	try {
		return window.sessionStorage ?? undefined
	} catch {
		return undefined
	}
}

type Attribution = typeof import('web-vitals/attribution')
type Observer = keyof Pick<
	Attribution,
	'onCLS' | 'onFCP' | 'onINP' | 'onLCP' | 'onTTFB'
>

export type WebVitalsOptions = {
	/**
	 * The part of the visits that report, 0 to 1. Decided once per tab, before
	 * the first metric, and sent as `sample` so a report can tell what part of
	 * the traffic it saw.
	 * Default 1: every visit.
	 */
	sampleRate?: number | undefined
	/**
	 * The site's deploy, e.g. the commit. With it, numbers' report tells the
	 * release that made a metric slower. Default none.
	 */
	release?: string | undefined
	/**
	 * Where the `web-vitals` attribution build comes from. Default the
	 * `web-vitals` package, which a bundler loads as its own chunk; a
	 * script-tag site points it at the package's ES module on a CDN instead.
	 */
	load?: (() => Promise<Partial<Attribution>>) | undefined
}

export type StartWebVitals = {
	load?: () => Promise<Partial<Attribution>>
	storage?: Pick<Storage, 'getItem' | 'setItem'> | undefined
}

export const loadWebVitals = (): Promise<Partial<Attribution>> =>
	import('web-vitals/attribution').then(
		(module) => module,
		() => ({}),
	)

const WATCHED: ReadonlyArray<Observer> = [
	'onLCP',
	'onINP',
	'onCLS',
	'onFCP',
	'onTTFB',
]

export const startWebVitals = async (
	{ load = loadWebVitals }: StartWebVitals,
	report: (metric: MetricWithAttribution, route: string) => void,
): Promise<(() => void) | null> => {
	const metrics = await load()
	if (WATCHED.some((name) => !metrics[name])) return null

	let stopped = false
	let routePath = location.pathname
	let route = location.href
	const send = (metric: MetricWithAttribution) => {
		if (stopped) return
		report(metric, route)
	}

	const wrap = (name: 'pushState' | 'replaceState') => {
		const original = history[name]
		const wrapped: typeof original = function (this: History, ...args) {
			const result = original.apply(this, args)
			if (location.pathname !== routePath) {
				routePath = location.pathname
				route = location.href
			}
			return result
		}
		history[name] = wrapped
		return () => {
			if (history[name] === wrapped) history[name] = original
		}
	}
	const unwrap = [wrap('pushState'), wrap('replaceState')]
	const onNavigate = () => {
		if (location.pathname !== routePath) {
			routePath = location.pathname
			route = location.href
		}
	}
	window.addEventListener('popstate', onNavigate)

	const fired = new Set<string>()
	const once = (metric: MetricWithAttribution) => {
		const key = `${metric.name}:${metric.id}`
		if (fired.has(key)) return
		fired.add(key)
		send(metric)
	}
	for (const name of WATCHED) metrics[name]?.(once)

	return () => {
		stopped = true
		for (const unwrapOne of unwrap) unwrapOne()
		window.removeEventListener('popstate', onNavigate)
	}
}
