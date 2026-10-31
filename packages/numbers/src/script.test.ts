// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_ENDPOINT } from './constants'
import { type ScriptWindow, startScript } from './script'

const scriptTag = (attributes: Record<string, string>) => {
	const script = document.createElement('script')
	for (const [name, value] of Object.entries(attributes))
		script.setAttribute(name, value)
	return script
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

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
	delete (window as ScriptWindow).numbers
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

describe('startScript', () => {
	it('sends a page view to the origin it came from and puts the client on window.numbers', () => {
		const numbers = startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-environment': 'staging',
			}),
		)
		expect((window as ScriptWindow).numbers).toBe(numbers)
		const [url, init] = fetchMock.mock.calls[0]!
		expect(url).toBe('https://numbers.obelism.studio/api/log')
		expect(JSON.parse(String(init!.body))).toMatchObject({
			organizationId: 'org_1',
			environment: 'staging',
			event: 'page_view',
		})
	})

	it('defaults to numbers when a CDN serves the file', () => {
		startScript(
			window,
			scriptTag({
				src: 'https://cdn.jsdelivr.net/npm/@obelism/numbers-sdk/dist/script.global.js',
				'data-organization': 'org_1',
			}),
		)
		expect(fetchMock.mock.calls[0]![0]).toBe(DEFAULT_ENDPOINT)
	})

	it('takes data-space', () => {
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-space': 'space_1',
			}),
		)
		const [, init] = fetchMock.mock.calls[0]!
		expect(JSON.parse(String(init!.body)).spaceId).toBe('space_1')
	})

	it('warns about a data-space it has to drop', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-space': 'Example Shop',
			}),
		)
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('data-space "Example Shop"'),
		)
		expect(
			JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)),
		).not.toHaveProperty('spaceId')
	})

	it('warns about an unknown data-storage only with data-debug', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-storage': 'sesssion',
			}),
		)
		expect(warn).not.toHaveBeenCalled()

		delete (window as ScriptWindow).numbers
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-storage': 'sesssion',
				'data-debug': '',
			}),
		)
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('data-storage "sesssion"'),
		)
	})

	it('takes data-endpoint, and production by default', () => {
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-endpoint': 'https://example.com/e',
			}),
		)
		const [url, init] = fetchMock.mock.calls[0]!
		expect(url).toBe('https://example.com/e')
		expect(JSON.parse(String(init!.body)).environment).toBe('production')
	})

	it('turns the client warnings on with data-debug', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
			}),
		)
		;(window as ScriptWindow).numbers!.track('addToCart', 'x')
		expect(warn).not.toHaveBeenCalled()

		delete (window as ScriptWindow).numbers
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-debug': '',
			}),
		)
		;(window as ScriptWindow).numbers!.track('addToCart', 'x')
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('"addToCart" isn\'t snake_case'),
		)
	})

	it('counts without a cookie with data-storage', () => {
		startScript(
			window,
			scriptTag({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
				'data-storage': 'session',
			}),
		)
		expect(document.cookie).not.toContain('visitorId')
		expect(document.cookie).not.toContain('obelism_visitor_id')
		expect(sessionStorage.getItem('obelism_visitor_id')).toMatch(/^visi_/)
	})

	it('does nothing without an organization, or when it already runs', () => {
		expect(startScript(window, null)).toBeNull()
		expect(startScript(window, scriptTag({ src: '/script.js' }))).toBeNull()
		;(window as ScriptWindow).numbers = {} as never
		expect(
			startScript(window, scriptTag({ 'data-organization': 'org_1' })),
		).toBeNull()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
