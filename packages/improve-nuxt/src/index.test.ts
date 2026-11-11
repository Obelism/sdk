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

const setup = (improveSdk = sdk()) => {
	const app = createApp()
	app.use(
		generateImproveNuxtMiddleware({
			improveSdk,
			serverABtests: [{ slug: 'startpage-visual', routeHandler: '/' }],
		}),
	)
	// Stands in for the page: shows what the middleware left it.
	app.use(eventHandler((event) => getImproveContext(event)))
	const handle = toWebHandler(app)
	return (path: string, headers: Record<string, string> = {}) =>
		handle(
			new Request(`http://localhost${path}`, {
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
