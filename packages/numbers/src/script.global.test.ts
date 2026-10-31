// @vitest-environment jsdom
import { rollup } from 'rollup'
import {
	beforeAll,
	beforeEach,
	afterEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest'

import scriptConfig from '../rollup.script.config.mjs'
import type { ScriptWindow } from './script'

// The script as numbers serves it: the minified IIFE from
// rollup.script.config.mjs. Testing the built file catches what the source
// tests can't: a minifier that turns the endpoint into a URL object, or moves
// a variable into the wrong scope.
let code: string
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

beforeAll(async () => {
	const output = Array.isArray(scriptConfig.output)
		? scriptConfig.output[0]!
		: scriptConfig.output!
	const bundle = await rollup({ ...scriptConfig })
	const built = await bundle.generate(output)
	await bundle.close()
	code = (built.output[0] as { code: string }).code
})

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>(async () => new Response('{}'))
	vi.stubGlobal('fetch', fetchMock)
	delete (window as ScriptWindow).numbers
	history.replaceState(null, '', '/')
})

afterEach(() => {
	vi.unstubAllGlobals()
	Reflect.deleteProperty(document, 'currentScript')
})

const run = (attributes: Record<string, string>) => {
	const script = document.createElement('script')
	for (const [name, value] of Object.entries(attributes))
		script.setAttribute(name, value)
	Object.defineProperty(document, 'currentScript', {
		configurable: true,
		get: () => script,
	})
	new Function(code)()
	return (window as ScriptWindow).numbers
}

const bodies = () =>
	fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init!.body)))

describe('dist/script.global.js', () => {
	it('sends a page view to /api/log on the host it is served from', () => {
		expect(
			run({
				src: 'https://numbers.obelism.studio/script.js',
				'data-organization': 'org_1',
			}),
		).toBeDefined()
		const [url] = fetchMock.mock.calls[0]!
		expect(url).toBe('https://numbers.obelism.studio/api/log')
		expect(bodies()[0]).toMatchObject({
			organizationId: 'org_1',
			event: 'page_view',
			path: '/',
		})
	})

	it('sends to the origin that served it locally', () => {
		run({
			src: 'http://localhost:8790/script.js',
			'data-organization': 'org_1',
		})
		expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:8790/api/log')
	})

	it('takes data-endpoint, and production by default', () => {
		run({
			src: 'https://numbers.obelism.studio/script.js',
			'data-organization': 'org_1',
			'data-endpoint': 'https://example.com/e',
		})
		expect(fetchMock.mock.calls[0]![0]).toBe('https://example.com/e')
		expect(bodies()[0].environment).toBe('production')
	})

	it('does nothing without a currentScript (a module, or a copied file)', () => {
		new Function(code)()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('does nothing without data-organization', () => {
		expect(
			run({ src: 'https://numbers.obelism.studio/script.js' }),
		).toBeUndefined()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
