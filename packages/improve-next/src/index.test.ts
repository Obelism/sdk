import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import type { ImproveConfiguration } from '@obelism/improve-sdk/types'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { generateImproveNextMiddleware } from './index'

const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

const VISITOR_ID = 'visi_ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const test = (
	defaultValue: string | null,
): ImproveConfiguration['tests'][string] => ({
	id: 'test_1',
	name: 'Startpage Visual',
	defaultValue: defaultValue as string,
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
	// Outside the group's ranges: nobody is in.
	group: 'group_1',
	ranges: [],
	salt: 'visual',
})

const middleware = (defaultValue: string | null) =>
	generateImproveNextMiddleware({
		improveSdk: new ImproveServerSDK({
			organizationId: 'org_1',
			environment: 'production',
			config: {
				name: 'next-example',
				version: 2,
				flags: {},
				audience: {},
				tests: { 'startpage-visual': test(defaultValue) },
				groups: { group_1: { salt: 'g1' } },
			},
		}),
		serverABtests: [
			{
				slug: 'startpage-visual',
				routeHandler: '/',
				options: [
					{ slug: '/', value: 'control' },
					{ slug: '/b', value: 'variation' },
				],
			},
		],
		options: {
			testValue: {
				name: 'startpage-visual',
				value: '',
				domain: 'example.com',
				path: '/shop',
				maxAge: 60,
			},
		},
	})

const request = () =>
	new NextRequest('https://example.com/', {
		headers: {
			'user-agent': UA,
			cookie: `obelism_visitor_id=${VISITOR_ID}; startpage-visual=variation`,
		},
	})

const testCookie = (response: Response) =>
	response.headers
		.getSetCookie()
		.find((cookie) => cookie.startsWith('startpage-visual='))

describe('generateImproveNextMiddleware', () => {
	it('removes the stale cookie of a visitor outside a group’s ranges, with the configured options', () => {
		const cookie = testCookie(middleware('control')(request()))
		expect(cookie).toMatch(/^startpage-visual=;/)
		expect(cookie).toContain('Domain=example.com')
		expect(cookie).toContain('Path=/shop')
		expect(cookie).toContain('Max-Age=0')
	})

	it('removes it when the test has no default to serve', () => {
		const cookie = testCookie(middleware(null)(request()))
		expect(cookie).toMatch(/^startpage-visual=;/)
		expect(cookie).toContain('Max-Age=0')
	})
})
