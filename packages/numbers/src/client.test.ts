// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createNumbers } from './client'
import { DEFAULT_ENDPOINT } from './constants'
import { isVisitorId } from './visitor'

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

const sentBodies = () =>
	fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init!.body)))

const clearCookies = () => {
	for (const row of document.cookie.split('; ')) {
		const name = row.split('=')[0]
		if (name)
			document.cookie = `${name}=;path=/;expires=${new Date(0).toUTCString()}`
	}
}

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>(async () => new Response('{}'))
	vi.stubGlobal('fetch', fetchMock)
	clearCookies()
	sessionStorage.clear()
	history.replaceState(null, '', '/')
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

const numbersFor = (
	options: Partial<Parameters<typeof createNumbers>[0]> = {},
) =>
	createNumbers({ organizationId: 'org_1', disableWarnings: true, ...options })

describe('visitor', () => {
	it('makes a new visitor and keeps it in the namespaced cookie', () => {
		const visitor = numbersFor().visitor()!
		expect(isVisitorId(visitor.id)).toBe(true)
		expect(visitor.id).toMatch(/^visi_[A-Z0-9]{26}$/)
		expect(visitor.recurring).toBe(false)
		expect(document.cookie).toContain(`obelism_visitor_id=${visitor.id}`)
	})

	it('reuses a valid cookie as a recurring visitor', () => {
		document.cookie =
			'obelism_visitor_id=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ;path=/'
		expect(numbersFor().visitor()).toEqual({
			id: 'visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
			recurring: true,
		})
	})

	it('reads the old visitorId cookie and keeps it in step', () => {
		document.cookie = 'visitorId=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ;path=/'
		const visitor = numbersFor().visitor()!
		expect(visitor).toEqual({
			id: 'visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
			recurring: true,
		})
		expect(document.cookie).toContain(
			'visitorId=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		)
		expect(document.cookie).toContain(
			'obelism_visitor_id=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		)
	})

	it('replaces an invalid cookie', () => {
		document.cookie = 'obelism_visitor_id=nope;path=/'
		const visitor = numbersFor().visitor()!
		expect(visitor.id).not.toBe('nope')
		expect(visitor.recurring).toBe(false)
	})

	it('keeps a session visitor in sessionStorage, without a cookie', () => {
		sessionStorage.clear()
		const first = numbersFor({ storage: 'session' }).visitor()!
		const second = numbersFor({ storage: 'session' }).visitor()!
		expect(second).toEqual({ id: first.id, recurring: true })
		expect(document.cookie).not.toContain('visitorId')
		expect(document.cookie).not.toContain('obelism_visitor_id')
	})

	it('makes a new visitor per page load with storage none', () => {
		const first = numbersFor({ storage: 'none' }).visitor()!
		const second = numbersFor({ storage: 'none' }).visitor()!
		expect(first.id).not.toBe(second.id)
		expect(first.recurring).toBe(false)
		expect(document.cookie).not.toContain('visitorId')
		expect(document.cookie).not.toContain('obelism_visitor_id')
	})
})

describe('track', () => {
	it('sends an event with the visitor, device and page', async () => {
		vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE)
		history.replaceState(null, '', '/pricing?utm_source=news&utm_campaign=fall')
		const numbers = numbersFor({ environment: 'staging' })

		await numbers.track('sign_up', 'footer_form', {
			value: 12.5,
			currency: 'EUR',
			params: { plan: 'pro' },
		})

		const [url, init] = fetchMock.mock.calls[0]!
		expect(url).toBe(DEFAULT_ENDPOINT)
		expect(init).toMatchObject({
			method: 'POST',
			keepalive: true,
			headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
		})
		expect(sentBodies()[0]).toEqual({
			type: 'event',
			organizationId: 'org_1',
			environment: 'staging',
			visitorId: numbers.visitor()!.id,
			pointer: 'coarse',
			device: 'mobile',
			screen: 'medium',
			browser: 'safari',
			os: 'ios',
			visitor: 'new',
			path: '/pricing',
			utmSource: 'news',
			utmCampaign: 'fall',
			event: 'sign_up',
			scope: 'footer_form',
			value: 12.5,
			currency: 'EUR',
			params: { plan: 'pro' },
		})
	})

	it('names the space when it has one', () => {
		numbersFor({ spaceId: 'space_1' }).track('sign_up', 'footer_form')
		numbersFor().track('sign_up', 'footer_form')

		const [withSpace, without] = sentBodies()
		expect(withSpace).toMatchObject({
			organizationId: 'org_1',
			spaceId: 'space_1',
		})
		expect(without).not.toHaveProperty('spaceId')
	})

	it('scopes to the path without a scope, and caps what numbers would refuse', () => {
		history.replaceState(null, '', '/about')
		numbersFor().track('a'.repeat(300), '', {
			currency: 'EUROPEANS',
			value: Number.NaN,
			params: [1, 2] as unknown as Record<string, unknown>,
		})
		const [body] = sentBodies()
		expect(body.scope).toBe('/about')
		expect(body.event).toHaveLength(256)
		expect(body.currency).toBe('EUROPEAN')
		expect(body).not.toHaveProperty('value')
		expect(body).not.toHaveProperty('params')
	})

	it('sends every call, or once per dedupeKey', () => {
		const numbers = numbersFor()
		numbers.track('click', 'cta')
		numbers.track('click', 'cta')
		expect(
			numbers.track('view_item', 'list', { dedupeKey: 'sku_1' }),
		).not.toBeNull()
		expect(
			numbers.track('view_item', 'list', { dedupeKey: 'sku_1' }),
		).toBeNull()
		numbers.track('view_item', 'list', { dedupeKey: 'sku_2' })
		expect(fetchMock).toHaveBeenCalledTimes(4)
		expect(sentBodies()[2]).not.toHaveProperty('dedupeKey')
	})

	it('pauses after a 429 for its Retry-After', async () => {
		vi.useFakeTimers({ now: 0, toFake: ['Date'] })
		fetchMock.mockResolvedValueOnce(
			new Response('', { status: 429, headers: { 'Retry-After': '30' } }),
		)
		const numbers = numbersFor()
		await numbers.track('one', 'x')
		expect(numbers.track('two', 'x')).toBeNull()
		vi.setSystemTime(30_001)
		expect(numbers.track('three', 'x')).not.toBeNull()
		vi.useRealTimers()
	})

	it('never rejects when the request fails', async () => {
		fetchMock.mockRejectedValueOnce(new TypeError('offline'))
		await expect(numbersFor().track('one', 'x')).resolves.toBeUndefined()
	})

	it('warns once about a name that isn’t snake_case, and about an oversized body', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const numbers = numbersFor({ disableWarnings: false })
		numbers.track('addToCart', 'x')
		numbers.track('addToCart', 'x')
		numbers.track('big', 'x', { params: { blob: 'x'.repeat(9000) } })
		expect(warn).toHaveBeenCalledTimes(2)
		expect(warn.mock.calls[0]![0]).toContain('"addToCart" isn\'t snake_case')
		expect(warn.mock.calls[1]![0]).toContain('over 8192 bytes')
	})

	it('goes to another endpoint, with the device given', () => {
		const numbers = numbersFor({
			endpoint: 'https://example.com/numbers',
			device: {
				pointer: 'fine',
				device: 'console',
				browser: 'other',
				os: 'unix',
			},
		})
		numbers.track('one', 'x')
		numbers.setEndpoint('https://example.com/elsewhere')
		numbers.setDevice({
			pointer: 'coarse',
			device: 'smarttv',
			browser: 'other',
			os: 'unix',
		})
		numbers.track('two', 'x')
		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			'https://example.com/numbers',
			'https://example.com/elsewhere',
		])
		expect(sentBodies().map((body) => body.device)).toEqual([
			'console',
			'smarttv',
		])
	})
})

describe('pageView', () => {
	it('sends the referrer from another site on the first page view only', () => {
		vi.spyOn(document, 'referrer', 'get').mockReturnValue(
			'https://news.example/story?id=1',
		)
		const numbers = numbersFor()
		numbers.pageView()
		numbers.pageView()
		const [first, second] = sentBodies()
		expect(first).toMatchObject({
			event: 'page_view',
			scope: '/',
			path: '/',
			referrer: 'https://news.example/story',
		})
		expect(second).not.toHaveProperty('referrer')
	})

	it('leaves out a referrer from the site itself', () => {
		vi.spyOn(document, 'referrer', 'get').mockReturnValue(
			`${location.origin}/home`,
		)
		numbersFor().pageView()
		expect(sentBodies()[0]).not.toHaveProperty('referrer')
	})
})

describe('expose', () => {
	it('sends an exposure once per subject', () => {
		const numbers = numbersFor()
		const exposure = {
			subjectKind: 'test',
			subjectId: 'test_1',
			variant: 'b',
		} as const
		numbers.expose(exposure)
		expect(numbers.expose(exposure)).toBeNull()
		numbers.expose({ ...exposure, subjectKind: 'flag' })
		expect(sentBodies()).toMatchObject([
			{
				type: 'exposure',
				subjectKind: 'test',
				subjectId: 'test_1',
				variant: 'b',
			},
			{ type: 'exposure', subjectKind: 'flag' },
		])
		expect(sentBodies()[0]).not.toHaveProperty('path')
	})
})

describe('autoTrack', () => {
	it('sends a page view now and on each new path, until stopped', () => {
		const numbers = numbersFor()
		const stop = numbers.autoTrack({ clicks: false })
		history.pushState(null, '', '/one')
		history.replaceState(null, '', '/one?tab=2')
		history.pushState(null, '', '/two')
		stop()
		history.pushState(null, '', '/three')
		expect(sentBodies().map((body) => body.path)).toEqual(['/', '/one', '/two'])
	})

	it('sends a click for a tagged element, also when the click is stopped', () => {
		document.body.innerHTML =
			'<section data-numbers-id="block_1"><button>Go</button></section><p>plain</p>'
		const button = document.querySelector('button')!
		button.addEventListener('click', (event) => event.stopPropagation())
		const stop = numbersFor().autoTrack({ pageViews: false })
		button.click()
		document.querySelector('p')!.click()
		stop()
		button.click()
		expect(sentBodies()).toMatchObject([{ event: 'click', scope: 'block_1' }])
	})

	it('replaces the previous autoTrack instead of stacking listeners', () => {
		document.body.innerHTML =
			'<a id="out" href="https://elsewhere.example/x">out</a>'
		document.body.addEventListener('click', (event) => event.preventDefault())
		const numbers = numbersFor()
		numbers.autoTrack({ clicks: false })
		const stop = numbers.autoTrack({
			pageViews: false,
			clicks: false,
			outbound: true,
		})
		history.pushState(null, '', '/one')
		document
			.getElementById('out')!
			.dispatchEvent(
				new MouseEvent('click', { bubbles: true, cancelable: true }),
			)
		stop()
		expect(sentBodies()).toMatchObject([
			{ event: 'page_view', path: '/' },
			{ event: 'outbound_click', path: '/one' },
		])
	})

	it('counts outbound links and downloads when asked', () => {
		document.body.innerHTML = `
			<a id="out" href="https://elsewhere.example/path?q=1">out</a>
			<a id="file" href="/files/report.pdf">pdf</a>
			<a id="same" href="/pricing">same</a>`
		document.body.addEventListener('click', (event) => event.preventDefault())
		const stop = numbersFor().autoTrack({
			pageViews: false,
			clicks: false,
			outbound: true,
			downloads: true,
		})
		for (const id of ['out', 'file', 'same'])
			document
				.getElementById(id)!
				.dispatchEvent(
					new MouseEvent('click', { bubbles: true, cancelable: true }),
				)
		stop()
		expect(sentBodies()).toMatchObject([
			{ event: 'outbound_click', scope: 'https://elsewhere.example/path' },
			{ event: 'file_download', scope: 'report.pdf' },
		])
	})

	it('counts a form_submit, by its data-numbers-id, id or action', () => {
		document.body.innerHTML = `
			<form id="signup" action="/newsletter"></form>
			<form data-numbers-id="footer_form"></form>`
		const stop = numbersFor().autoTrack({
			pageViews: false,
			clicks: false,
			forms: true,
		})
		for (const form of document.querySelectorAll('form'))
			form.dispatchEvent(
				new Event('submit', { bubbles: true, cancelable: true }),
			)
		stop()
		expect(sentBodies()).toMatchObject([
			{ event: 'form_submit', scope: 'signup' },
			{ event: 'form_submit', scope: 'footer_form' },
		])
	})

	it('sends a form_submit by hand', () => {
		document.body.innerHTML = '<form action="/checkout"></form>'
		const form = document.querySelector('form') as HTMLFormElement
		numbersFor().formSubmit(form)
		numbersFor().formSubmit(form, 'paid_order')
		expect(sentBodies()).toMatchObject([
			{ event: 'form_submit', scope: '/checkout' },
			{ event: 'form_submit', scope: 'paid_order' },
		])
	})
})
