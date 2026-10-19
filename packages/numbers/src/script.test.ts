// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type ScriptWindow, startScript } from './script'

const scriptTag = (attributes: Record<string, string>) => {
	const script = document.createElement('script')
	for (const [name, value] of Object.entries(attributes))
		script.setAttribute(name, value)
	return script
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>(async () => new Response('{}'))
	vi.stubGlobal('fetch', fetchMock)
	delete (window as ScriptWindow).numbers
})

afterEach(() => {
	vi.unstubAllGlobals()
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
