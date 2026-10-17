// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { ImproveClientSDK } from './client'
import { ImproveConfiguration } from './types'

const IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const VISITOR_ID = 'visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const config: ImproveConfiguration = {
	name: 'Org',
	version: 1,
	flags: {},
	audience: {},
	tests: {
		hero: {
			id: 'test_1',
			name: 'Hero',
			defaultValue: 'control',
			audience: 'everyone',
			allocation: 100,
			options: [{ name: 'B', slug: 'b', value: 'b', split: 100 }],
			events: {
				start: { event: 'page_view', scope: '/' },
				metrics: [],
				conversion: { event: 'sign_up', scope: 'hero' },
			},
		},
	},
}

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>

const sent = () =>
	fetchMock.mock.calls.map(([url, init]) => ({
		url,
		body: JSON.parse(String(init!.body)),
	}))

const createSdk = (
	args: Partial<ConstructorParameters<typeof ImproveClientSDK>[0]> = {},
) => {
	const sdk = new ImproveClientSDK({
		organizationId: 'org_1',
		environment: 'production',
		config,
		disableWarnings: true,
		...args,
	})
	sdk.setupVisitor(IPHONE)
	return sdk
}

beforeEach(() => {
	fetchMock = vi.fn<typeof fetch>(async () => new Response('{}'))
	vi.stubGlobal('fetch', fetchMock)
	document.cookie = `visitorId=${VISITOR_ID};path=/`
	document.cookie = `hero=;path=/;expires=${new Date(0).toUTCString()}`
	window.dataLayer = []
	history.replaceState(null, '', '/pricing?utm_source=news')
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('ImproveClientSDK through the numbers SDK', () => {
	test('sends exposures and events to numbers, as the cookie’s visitor with the audience categories', () => {
		const sdk = createSdk()
		expect(sdk.getTestValue('hero')).toBe('b')
		sdk.postAnalytic('sign_up', 'hero', { value: 10, currency: 'EUR' })

		expect(sent()).toMatchObject([
			{
				url: 'https://numbers.obelism.studio/api/log',
				body: {
					type: 'exposure',
					organizationId: 'org_1',
					environment: 'production',
					visitorId: VISITOR_ID,
					visitor: 'recurring',
					device: 'mobile',
					pointer: 'coarse',
					browser: 'safari',
					os: 'ios',
					subjectKind: 'test',
					subjectId: 'test_1',
					variant: 'b',
				},
			},
			{
				url: 'https://numbers.obelism.studio/api/log',
				body: {
					type: 'event',
					visitorId: VISITOR_ID,
					event: 'sign_up',
					scope: 'hero',
					path: '/pricing',
					utmSource: 'news',
					value: 10,
					currency: 'EUR',
				},
			},
		])
	})

	test('sends an event once per name, or once per dedupeKey', () => {
		const sdk = createSdk()
		sdk.postAnalytic('page_view', '/')
		expect(sdk.postAnalytic('page_view', '/')).toBeNull()
		sdk.postAnalytic('view_item', 'list', { dedupeKey: 'sku_1' })
		sdk.postAnalytic('view_item', 'list', { dedupeKey: 'sku_2' })
		expect(
			sdk.postAnalytic('view_item', 'list', { dedupeKey: 'sku_1' }),
		).toBeNull()
		expect(sent().map(({ body }) => body.event)).toEqual([
			'page_view',
			'view_item',
			'view_item',
		])
	})

	test('mirrors a sent event onto the dataLayer, unless turned off', () => {
		createSdk().postAnalytic('purchase', 'checkout', {
			value: 5,
			params: { ecommerce: { items: [] } },
		})
		expect(window.dataLayer).toEqual([
			{ ecommerce: null },
			{
				event: 'purchase',
				scope: 'checkout',
				improve: { visitorId: VISITOR_ID },
				value: 5,
				ecommerce: { items: [] },
				_improve: true,
			},
		])

		window.dataLayer = []
		createSdk({ dataLayer: false }).postAnalytic('purchase', 'checkout')
		expect(window.dataLayer).toEqual([])
	})

	test('keeps a custom baseUrl’s /api/log, and follows setAnalyticsUrls', () => {
		const sdk = createSdk({ baseUrl: 'http://localhost:8788' })
		sdk.postAnalytic('one', 'x')
		sdk.setAnalyticsUrls('https://example.com/proxy')
		sdk.postAnalytic('two', 'x')
		expect(sent().map(({ url }) => url)).toEqual([
			'http://localhost:8788/api/log',
			'https://example.com/proxy',
		])
	})

	test('doesn’t count an event as sent while paused after a 429', async () => {
		fetchMock.mockResolvedValueOnce(
			new Response('', { status: 429, headers: { 'Retry-After': '0.05' } }),
		)
		const sdk = createSdk()
		await sdk.postAnalytic('one', 'x')
		expect(sdk.postAnalytic('two', 'x')).toBeNull()
		await new Promise((resolve) => setTimeout(resolve, 60))
		expect(sdk.postAnalytic('two', 'x')).not.toBeNull()
	})

	test('sends nothing for GTM’s own events or without a config', () => {
		const sdk = createSdk()
		expect(sdk.postAnalytic('gtm.click', 'x')).toBeNull()
		expect(createSdk({ config: undefined }).postAnalytic('one', 'x')).toBeNull()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
