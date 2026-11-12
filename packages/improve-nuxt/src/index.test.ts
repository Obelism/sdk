import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import type { ImproveConfiguration } from '@obelism/improve-sdk/types'
import { createApp, eventHandler, toWebHandler } from 'h3'
import { describe, expect, it, vi } from 'vitest'

import { generateImproveNuxtMiddleware, getImproveContext } from './index'

const CONFIG: ImproveConfiguration = {
	name: 'nuxt-example',
	version: 1,
	flags: {},
	tests: {
		'startpage-visual': {
			id: 'test_1',
			name: 'Startpage Visual',
			defaultValue: 'control',
			allocation: 100,
			audience: '',
			options: [
				{ name: 'Control', slug: 'control', value: 'a', split: 50 },
				{ name: 'Variation', slug: 'variation', value: 'b', split: 50 },
			],
			events: {
				start: { event: 'pageLoad', scope: 'homepage' },
				metrics: [],
				conversion: { event: 'visualClicked', scope: 'homepage' },
			},
		},
	},
	audience: {},
}

const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const setup = (improveSdk = sdk(), routeHandler = '/') => {
	const app = createApp()
	app.use(
		generateImproveNuxtMiddleware({
			improveSdk,
			serverABtests: [{ slug: 'startpage-visual', routeHandler }],
		}),
	)
	// Stands in for the page: shows what the middleware left it.
	app.use(eventHandler((event) => getImproveContext(event)))
	const handle = toWebHandler(app)
	return (path: string, headers: Record<string, string> = {}, method = 'GET') =>
		handle(
			new Request(`http://localhost${path}`, {
				method,
				headers: { 'user-agent': UA, ...headers },
			}),
		)
}

const sdk = () =>
	new ImproveServerSDK({
		organizationId: 'org_1',
		environment: 'production',
		config: CONFIG,
	})

const cookies = (response: Response) =>
	Object.fromEntries(
		response.headers
			.getSetCookie()
			.map((cookie) => cookie.split(';')[0]!.split('=') as [string, string]),
	)

describe('generateImproveNuxtMiddleware', () => {
	it('decides a new visitor and keeps both in cookies', async () => {
		const response = await setup()('/')
		const decided = await response.json()
		const set = cookies(response)

		expect(['control', 'variation']).toContain(decided['startpage-visual'])
		expect(set['startpage-visual']).toBe(decided['startpage-visual'])
		expect(set['obelism_visitor_id']).toMatch(/.+/)
		expect(response.headers.get('set-cookie')).toContain('Path=/')
		expect(response.headers.get('cache-control')).toBe('private')
	})

	it("only keeps a visitor id of the SDK's alphabet", async () => {
		const request = setup()
		const kept = await request('/', {
			cookie: 'obelism_visitor_id=visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		})
		const odd = await request('/', {
			cookie: 'obelism_visitor_id=visi_ABCDEFGHIJKLMNOPQRSTUVW%3BX',
		})
		expect(cookies(kept)['obelism_visitor_id']).toBe(
			'visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		)
		expect(cookies(odd)['obelism_visitor_id']).not.toContain('%')
	})

	it('keeps the variant a cookie names', async () => {
		const request = setup()
		for (const value of ['control', 'variation']) {
			const response = await request('/', {
				cookie: `startpage-visual=${value}`,
			})
			expect(await response.json()).toEqual({ 'startpage-visual': value })
		}
	})

	it('lets a query parameter pick a variant, but only a real one', async () => {
		const request = setup()
		const picked = await request('/?startpage-visual=variation', {
			cookie: 'startpage-visual=control',
		})
		expect(await picked.json()).toEqual({ 'startpage-visual': 'variation' })

		const made = await request('/?startpage-visual=evil', {
			cookie: 'startpage-visual=control',
		})
		expect(await made.json()).toEqual({ 'startpage-visual': 'control' })
	})

	it('leaves bots and other routes alone', async () => {
		const request = setup()
		for (const response of [
			await request('/', { 'user-agent': 'Googlebot/2.1' }),
			await request('/', { 'user-agent': 'AhrefsBot' }),
			await request('/about'),
		]) {
			expect(await response.json()).toEqual({})
			expect(response.headers.getSetCookie()).toEqual([])
			expect(response.headers.get('cache-control')).toBeNull()
		}
	})

	it("decides only for pages, not for Nuxt's own requests", async () => {
		const request = setup(sdk(), '/[...slug]')
		expect(await (await request('/products/shoes')).json()).toHaveProperty(
			'startpage-visual',
		)
		for (const response of [
			await request('/_nuxt/entry.js'),
			await request('/__nuxt_error'),
			await request('/api/cart'),
			await request('/favicon.ico'),
			await request('/products/_payload.json'),
			await request('/products/shoes', {}, 'POST'),
		]) {
			expect(response.headers.getSetCookie()).toEqual([])
		}
	})

	it('shares one datafile fetch between concurrent first requests', async () => {
		const shared = new ImproveServerSDK({
			organizationId: 'org_1',
			environment: 'production',
			token: 'imp_test',
		})
		const fetchConfig = vi.fn(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10))
			shared.loadConfig(CONFIG)
			return CONFIG
		})
		shared.fetchConfig = fetchConfig
		const request = setup(shared)
		const responses = await Promise.all([request('/'), request('/')])
		expect(fetchConfig).toHaveBeenCalledTimes(1)
		for (const response of responses) {
			expect(await response.json()).toHaveProperty('startpage-visual')
		}
	})

	it('serves the page when the datafile fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {})
		const failing = sdk()
		failing.fetchConfig = () => Promise.reject(new Error('offline'))
		const response = await setup(failing)('/')
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({})
	})
})
