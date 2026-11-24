// @vitest-environment jsdom
import type { MetricWithAttribution } from 'web-vitals/attribution'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	inSample,
	scrubSelector,
	startWebVitals,
	VITALS_SAMPLE_KEY,
	WEB_VITAL_EVENT,
	webVitalEvent,
} from './webVitals'

const LANDING = 'https://shop.example/'
const ROUTE = 'https://shop.example/checkout'

const metric = (fields: Record<string, unknown>) =>
	({
		value: 1234.5,
		rating: 'needs-improvement',
		navigationType: 'navigate',
		...fields,
	}) as unknown as MetricWithAttribution

describe('webVitalEvent', () => {
	it('is a web_vital scoped to the metric, with its value, rating and release', () => {
		const event = webVitalEvent(
			metric({ name: 'LCP', attribution: { target: 'main>img.hero' } }),
			{
				sampleRate: 1,
				release: 'a1b2c3d',
				landingUrl: LANDING,
				routeUrl: ROUTE,
			},
		)

		expect(event).toEqual({
			event: WEB_VITAL_EVENT,
			value: 1234.5,
			options: {
				params: {
					rating: 'needs-improvement',
					navigation: 'navigate',
					release: 'a1b2c3d',
					element: 'main>img.hero',
				},
				page: { url: LANDING },
			},
		})
	})

	it('files an interaction or a shift under the route it was reported on', () => {
		const inp = webVitalEvent(metric({ name: 'INP', attribution: {} }), {
			sampleRate: 1,
			release: undefined,
			landingUrl: LANDING,
			routeUrl: ROUTE,
		})
		const lcp = webVitalEvent(metric({ name: 'LCP', attribution: {} }), {
			sampleRate: 1,
			release: undefined,
			landingUrl: LANDING,
			routeUrl: ROUTE,
		})

		expect(inp.options.page).toEqual({ url: ROUTE })
		expect(lcp.options.page).toEqual({ url: LANDING })
	})

	it('leaves out what the site gave not, and says the sample rate', () => {
		const event = webVitalEvent(metric({ name: 'TTFB', attribution: {} }), {
			sampleRate: 0.5,
			release: undefined,
			landingUrl: LANDING,
			routeUrl: ROUTE,
		})

		expect(event.options.params).toEqual({
			rating: 'needs-improvement',
			navigation: 'navigate',
			sample: '0.5',
		})
	})
})

describe('scrubSelector', () => {
	it('hides an id made from a record', () => {
		expect(scrubSelector('li#row-entry_01HX2>a.title')).toBe('li#[id]>a.title')
		expect(scrubSelector('div#main>button#save')).toBe('div#main>button#save')
	})
})

describe('inSample', () => {
	const store = () => {
		const items = new Map<string, string>()
		return {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => void items.set(key, value),
		}
	}

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('always reports a rate of 1', () => {
		vi.spyOn(Math, 'random').mockReturnValue(0.99)
		expect(inSample(1, store())).toBe(true)
	})

	it('decides once per tab, and every page of it agrees', () => {
		const storage = store()
		vi.spyOn(Math, 'random').mockReturnValue(0.9)
		expect(inSample(0.5, storage)).toBe(false)
		expect(storage.getItem(VITALS_SAMPLE_KEY)).toBe('0')
		vi.spyOn(Math, 'random').mockReturnValue(0.1)
		expect(inSample(0.5, storage)).toBe(false)
		expect(inSample(0.5, store())).toBe(true)
	})
})

describe('startWebVitals', () => {
	const listeners: Record<string, (metric: MetricWithAttribution) => void> = {}

	const watch = () =>
		Object.fromEntries(
			['onLCP', 'onINP', 'onCLS', 'onFCP', 'onTTFB'].map((name) => [
				name,
				(handler: (metric: MetricWithAttribution) => void) => {
					listeners[name] = handler
				},
			]),
		)

	beforeEach(() => {
		for (const name of Object.keys(listeners)) delete listeners[name]
		history.replaceState(null, '', '/')
	})

	it('reports each metric once, and stops when asked', async () => {
		const report = vi.fn()
		const stop = await startWebVitals({ load: async () => watch() }, report)
		const lcp = metric({ name: 'LCP', id: 'v1', attribution: {} })

		listeners.onLCP!(lcp)
		listeners.onLCP!(lcp)
		await stop?.()

		expect(report).toHaveBeenCalledOnce()
		expect(report).toHaveBeenCalledWith(lcp, location.href)
	})

	it('follows the route a client-side navigation shows', async () => {
		const report = vi.fn()
		await startWebVitals({ load: async () => watch() }, report)

		history.pushState(null, '', '/checkout')
		listeners.onINP!(metric({ name: 'INP', id: 'inp', attribution: {} }))

		expect(report.mock.calls[0]![1]).toBe('http://localhost:3000/checkout')
	})

	it('reports nothing without the web-vitals package', async () => {
		const report = vi.fn()

		expect(await startWebVitals({ load: async () => ({}) }, report)).toBeNull()
		expect(report).not.toHaveBeenCalled()
	})
})
