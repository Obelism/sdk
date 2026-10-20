// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
	createEvents,
	type EventsWindow,
	getEvents,
	REPLAY_LIMIT,
} from './events'
import type { BusEvent } from './types'

const record = () => {
	const received: BusEvent[] = []
	return { received, subscriber: (event: BusEvent) => received.push(event) }
}

beforeEach(() => {
	history.replaceState(null, '', '/')
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	delete (window as EventsWindow).obelismEvents
	document.body.innerHTML = ''
})

describe('emit', () => {
	it('hands every subscriber the event, scoped to the path by default', () => {
		const events = createEvents()
		const a = record()
		const b = record()
		events.subscribe(a.subscriber)
		events.subscribe(b.subscriber)
		history.replaceState(null, '', '/pricing')

		expect(events.emit('sign_up')).toBe(true)
		expect(
			events.emit('purchase', {
				scope: 'checkout',
				value: 42,
				currency: 'EUR',
				params: { id: 'o_1' },
			}),
		).toBe(true)

		expect(a.received).toEqual([
			{
				kind: 'event',
				name: 'sign_up',
				scope: '/pricing',
				at: expect.any(Number),
			},
			{
				kind: 'event',
				name: 'purchase',
				scope: 'checkout',
				value: 42,
				currency: 'EUR',
				params: { id: 'o_1' },
				at: expect.any(Number),
			},
		])
		expect(b.received).toEqual(a.received)
	})

	it('emits once per name and dedupeKey', () => {
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		expect(events.emit('view_item', { dedupeKey: 'sku_1' })).toBe(true)
		expect(events.emit('view_item', { dedupeKey: 'sku_1' })).toBe(false)
		expect(events.emit('view_item', { dedupeKey: 'sku_2' })).toBe(true)
		expect(events.emit('add_to_cart', { dedupeKey: 'sku_1' })).toBe(true)
		expect(received).toHaveLength(3)
	})

	it('keeps going when a subscriber throws, and reports it', () => {
		const reportError = vi.fn()
		vi.stubGlobal('reportError', reportError)
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(() => {
			throw new Error('tracker broke')
		})
		events.subscribe(subscriber)
		expect(events.emit('sign_up')).toBe(true)
		expect(received).toHaveLength(1)
		expect(reportError).toHaveBeenCalledWith(new Error('tracker broke'))
	})
})

describe('expose', () => {
	it('publishes each subject once', () => {
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		const exposure = {
			subjectKind: 'test',
			subjectId: 't_1',
			variant: 'b',
		} as const
		expect(events.expose(exposure)).toBe(true)
		expect(events.expose(exposure)).toBe(false)
		expect(events.expose({ ...exposure, subjectKind: 'flag' })).toBe(true)
		expect(received).toEqual([
			{ kind: 'exposure', ...exposure, at: expect.any(Number) },
			{
				kind: 'exposure',
				...exposure,
				subjectKind: 'flag',
				at: expect.any(Number),
			},
		])
	})
})

describe('subscribe', () => {
	it('replays what came before, up to the limit', () => {
		const events = createEvents()
		for (let i = 0; i < REPLAY_LIMIT + 5; i++)
			events.emit('click', { scope: `cta_${i}` })
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		expect(received).toHaveLength(REPLAY_LIMIT)
		expect(received[0]).toMatchObject({ scope: 'cta_5' })
	})

	it('skips the replay when asked', () => {
		const events = createEvents()
		events.emit('sign_up')
		const { received, subscriber } = record()
		events.subscribe(subscriber, { replay: false })
		expect(received).toEqual([])
	})

	it('stops handing events once unsubscribed', () => {
		const events = createEvents()
		const { received, subscriber } = record()
		const unsubscribe = events.subscribe(subscriber)
		events.emit('sign_up')
		unsubscribe()
		events.emit('login')
		expect(received).toHaveLength(1)
	})
})

describe('autoTrack', () => {
	it('emits a page view per path, now and on navigation', () => {
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		const stop = events.autoTrack()
		history.pushState(null, '', '/about')
		history.replaceState(null, '', '/about?tab=team')
		history.pushState(null, '', '/')
		stop()
		history.pushState(null, '', '/after')
		expect(received.map((event) => 'scope' in event && event.scope)).toEqual([
			'/',
			'/about',
			'/',
		])
	})

	it('emits clicks on elements tagged with either attribute', () => {
		document.body.innerHTML = `
			<a data-events-id="hero_cta"><span id="inner">Go</span></a>
			<button data-numbers-id="block_1">Buy</button>
			<p id="plain">Text</p>`
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		const stop = events.autoTrack({ pageViews: false })
		document.getElementById('inner')!.click()
		document.querySelector('button')!.click()
		document.getElementById('plain')!.click()
		stop()
		expect(received).toMatchObject([
			{ name: 'click', scope: 'hero_cta' },
			{ name: 'click', scope: 'block_1' },
		])
	})

	it('runs once at a time', () => {
		const events = createEvents()
		const { received, subscriber } = record()
		events.subscribe(subscriber)
		const stop = events.autoTrack()
		const second = events.autoTrack()
		second()
		history.pushState(null, '', '/next')
		stop()
		expect(received).toHaveLength(2)
	})
})

describe('getEvents', () => {
	it('is the page’s one bus, on window.obelismEvents', () => {
		const events = getEvents()
		expect(getEvents()).toBe(events)
		expect((window as EventsWindow).obelismEvents).toBe(events)
	})

	it('uses the bus another copy made first', () => {
		const other = createEvents()
		;(window as EventsWindow).obelismEvents = other
		expect(getEvents()).toBe(other)
	})
})
