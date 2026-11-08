import { expect, test, vi } from 'vitest'

import { ImproveServerSDK } from './server'
import { parseUserAgent } from './utils/parseUserAgent'
import { ImproveConfiguration } from './types'

type CountObject = {
	[x: string]: number
}

const TEST_CONFIG: ImproveConfiguration = {
	name: 'nextjs-example',
	version: 1,
	flags: {},
	tests: {
		'startpage-visual': {
			id: 'test_QF5TJM2OYC3UQGHBFJ1543C8E1',
			name: 'Startpage Visual',
			defaultValue: 'control',
			allocation: 100,
			audience: '',
			options: [
				{
					name: 'Control',
					slug: 'control',
					value: 'a',
					split: 50,
				},
				{
					name: 'Variation',
					slug: 'variation',
					value: 'b',
					split: 50,
				},
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
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2'

test('1000 times getTestValue with new visitor ids', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})

	const iterations = 1000
	const outcomeCount: CountObject = {}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1
	}

	const [first = 0, second = 0] = Object.values(outcomeCount)
	const delta = Math.abs(first - second)

	// getTestValue assigns each variant with Math.random, so a 50/50 split is
	// binomially distributed: the delta between the two buckets has a standard
	// deviation of ~sqrt(iterations). Allow ~5 standard deviations so the test
	// effectively never flakes while still catching a grossly skewed split.
	const maxDelta = Math.ceil(Math.sqrt(iterations) * 5)

	expect(delta).toBeLessThanOrEqual(maxDelta)
})

test('200 runs with 100 different visitor IDS', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})

	const iterations = 100
	const outcomeCount: CountObject = {}
	const secondRunCount: CountObject = {}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1
	}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		secondRunCount[outcome] = (secondRunCount[outcome] || 0) + 1
	}

	expect(outcomeCount).toStrictEqual(secondRunCount)
})

const FLAG_CONFIG: ImproveConfiguration = {
	...TEST_CONFIG,
	flags: {
		'new-checkout': {
			id: 'flag_1',
			name: 'New checkout',
			audience: '',
			options: [
				{ name: 'Off', slug: 'off', value: 'off', split: 0 },
				{ name: 'On', slug: 'on', value: 'on', split: 100 },
			],
		},
		'no-options': { id: 'flag_2', name: 'Empty', audience: '', options: [] },
	},
}

test('getFlagValue without a user agent returns the first option, like getTestValue', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	expect(sdk.getFlagValue('new-checkout', 'visi_1', '')).toBe('off')
	expect(sdk.getTestValue('startpage-visual', 'visi_1', '')).toBe('control')
})

test('getFlagValue assigns, keeps the assignment and returns null for a flag without options', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	expect(sdk.getFlagValue('new-checkout', 'visi_1', UA)).toBe('on')
	expect(sdk.getFlagValue('new-checkout', 'visi_1', UA)).toBe('on')
	expect(sdk.getFlagValue('no-options', 'visi_1', UA)).toBeNull()
})

test('a __proto__ user agent does not touch other visitors', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})

	improveSDK.getTestValue('startpage-visual', 'visi_attacker', '__proto__', {
		country: 'XX',
	})
	expect(Object.hasOwn(Object.prototype, 'startpage-visual')).toBe(false)
	expect(Object.hasOwn(Object.prototype, 'country')).toBe(false)

	const outcomes = new Set<string | null>()
	for (let i = 0; i < 200; i++) {
		outcomes.add(improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA))
	}
	expect(outcomes).toEqual(new Set(['control', 'variation']))
})

test('keeps a bounded number of user agents per visitor', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})
	const random = vi.spyOn(Math, 'random')

	random.mockReturnValue(0)
	expect(improveSDK.getTestValue('startpage-visual', 'visi_1', `${UA} 0`)).toBe(
		'control',
	)
	for (let i = 1; i <= 100; i++) {
		improveSDK.getTestValue('startpage-visual', 'visi_1', `${UA} ${i}`)
	}
	// Evicted, so the first user agent is assigned again.
	random.mockReturnValue(0.99)
	expect(improveSDK.getTestValue('startpage-visual', 'visi_1', `${UA} 0`)).toBe(
		'variation',
	)
	random.mockRestore()
})

const seedNames = ({
	cookies,
}: ReturnType<ImproveServerSDK['seedTestCookies']>) =>
	cookies.map(({ name }) => name)

test('seedTestCookies seeds the visitor and a cookie per test and flag', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	const seed = sdk.seedTestCookies({ userAgent: UA, maxAgeDays: 7 })

	expect(seedNames(seed).sort()).toEqual(
		['new-checkout', 'obelism_visitor_id', 'startpage-visual'].sort(),
	)
	expect(
		seed.cookies.every(({ header }) =>
			header.endsWith('; Path=/; Max-Age=604800; SameSite=Lax; Secure'),
		),
	).toBe(true)

	const test = seed.assignments.find(({ slug }) => slug === 'startpage-visual')
	expect(test).toMatchObject({ kind: 'test', included: true })
	expect(['control', 'variation']).toContain(test?.value)
	expect(
		seed.assignments.find(({ slug }) => slug === 'new-checkout'),
	).toMatchObject({ kind: 'flag', value: 'on', included: true })
	expect(seed.assignments).toHaveLength(2)
})

test('seedTestCookies keeps the cookies a visitor already has', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	const visitorId = sdk.generateVisitorId()
	const seed = sdk.seedTestCookies({
		userAgent: UA,
		cookieHeader: `obelism_visitor_id=${visitorId}; startpage-visual=variation; new-checkout=off`,
	})

	expect(seed.visitorId).toBe(visitorId)
	expect(seed.cookies).toEqual([])
	expect(seed.assignments).toContainEqual({
		slug: 'startpage-visual',
		kind: 'test',
		value: 'variation',
		included: true,
	})
	expect(seed.assignments).toContainEqual({
		slug: 'new-checkout',
		kind: 'flag',
		value: 'off',
		included: true,
	})
})

test('seedTestCookies migrates the legacy visitor cookie', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	const visitorId = sdk.generateVisitorId()
	const seed = sdk.seedTestCookies({
		userAgent: UA,
		cookieHeader: `visitorId=${visitorId}`,
	})

	expect(seed.visitorId).toBe(visitorId)
	expect(seed.cookies).toContainEqual(
		expect.objectContaining({ name: 'obelism_visitor_id', value: visitorId }),
	)
})

test('seedTestCookies leaves a visitor out of a test, with the default option', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: {
			...TEST_CONFIG,
			tests: {
				'startpage-visual': {
					...TEST_CONFIG.tests['startpage-visual']!,
					allocation: 0,
				},
			},
		},
	})
	const random = vi.spyOn(Math, 'random')
	random.mockReturnValue(0.99)

	const first = sdk.seedTestCookies({ userAgent: UA })
	expect(seedNames(first)).toEqual(['obelism_visitor_id'])
	expect(first.assignments).toContainEqual({
		slug: 'startpage-visual',
		kind: 'test',
		value: 'control',
		included: false,
	})

	// Remembered as out, so a second request doesn't roll for them.
	const second = sdk.seedTestCookies({
		userAgent: UA,
		cookieHeader: `obelism_visitor_id=${first.visitorId}`,
	})
	expect(seedNames(second)).toEqual([])
	expect(second.assignments).toContainEqual({
		slug: 'startpage-visual',
		kind: 'test',
		value: 'control',
		included: false,
	})
	random.mockRestore()
})

test('seedTestCookies replaces a cookie naming an option the block no longer has', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: FLAG_CONFIG,
	})
	const visitorId = sdk.generateVisitorId()
	const seed = sdk.seedTestCookies({
		userAgent: UA,
		cookieHeader: `obelism_visitor_id=${visitorId}; startpage-visual=gone`,
	})

	const cookie = seed.cookies.find(({ name }) => name === 'startpage-visual')
	expect(cookie?.value).not.toBe('gone')
	expect(
		seed.assignments.find(({ slug }) => slug === 'startpage-visual'),
	).toMatchObject({ included: true })
})

test('seedTestCookies seeds nothing for a visitor without a user agent', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: TEST_CONFIG,
	})
	const seed = sdk.seedTestCookies({ userAgent: '' })

	expect(seedNames(seed)).toEqual(['obelism_visitor_id'])
	expect(seed.assignments).toEqual([
		{
			slug: 'startpage-visual',
			kind: 'test',
			value: 'control',
			included: false,
		},
	])
})

test('seedTestCookies needs a config', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		token: 'imp_test',
	})
	expect(() => sdk.seedTestCookies({ userAgent: UA })).toThrow(
		'Config is required before seeding',
	)
})

test('seedTestCookies follows the audience, and the country it is given', () => {
	const params = parseUserAgent(UA)!
	const config: ImproveConfiguration = {
		...TEST_CONFIG,
		audience: {
			matching: {
				pointer: params.pointer,
				device: params.device,
				browser: params.browser,
				os: params.os,
				country: 'NL',
			},
		},
		tests: {
			'startpage-visual': {
				...TEST_CONFIG.tests['startpage-visual']!,
				audience: 'matching',
			},
		},
	}
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config,
	})

	const outside = sdk.seedTestCookies({
		userAgent: UA,
		geo: { country: 'US' },
	})
	expect(seedNames(outside)).toEqual(['obelism_visitor_id'])
	expect(outside.assignments).toContainEqual({
		slug: 'startpage-visual',
		kind: 'test',
		value: 'control',
		included: false,
	})

	const inside = sdk.seedTestCookies({
		userAgent: UA,
		geo: { country: 'NL' },
		cookieHeader: `obelism_visitor_id=${outside.visitorId}`,
	})
	expect(seedNames(inside)).toContain('startpage-visual')
	expect(inside.assignments).toContainEqual(
		expect.objectContaining({ slug: 'startpage-visual', included: true }),
	)
})

test('seedTestCookies does not echo a visitor id it would not mint', () => {
	const sdk = new ImproveServerSDK({
		organizationId: '',
		environment: 'develop',
		config: TEST_CONFIG,
	})
	// 26 characters, so it passes the id check, but not the alphabet.
	const crafted = `visi_${'A'.repeat(24)};;`
	const seed = sdk.seedTestCookies({
		userAgent: UA,
		cookieHeader: `obelism_visitor_id=${crafted}`,
	})

	expect(seed.visitorId).not.toBe(crafted)
	expect(sdk.validateVisitorId(seed.visitorId)).toBe(true)
	expect(seed.cookies[0]).toMatchObject({
		name: 'obelism_visitor_id',
		kind: 'visitor',
	})
})
