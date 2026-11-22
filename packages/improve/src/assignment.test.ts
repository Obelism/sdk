import { describe, expect, test } from 'vitest'

import { assign, createVisitor, testSubject } from './assignment'
import type { ImproveConfiguration, ImproveTest } from './types'
import { bucketOf, pickVariant } from './utils/buckets'
import { parseUserAgent } from './utils/parseUserAgent'

const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const NOW = Date.parse('2026-11-14T12:00:00Z')

const ids = Array.from({ length: 2000 }, (_, i) => `visi_${i}`)

const parsedUA = parseUserAgent(UA)!

const visitor = (id: string) => createVisitor(parsedUA, id)

const makeTest = (extra: Partial<ImproveTest>): ImproveTest => ({
	id: 'test_x',
	name: 'X',
	defaultValue: 'control',
	audience: '',
	allocation: 100,
	options: [
		{ name: 'Control', slug: 'control', value: 'a', split: 50 },
		{ name: 'B', slug: 'b', value: 'b', split: 50 },
	],
	events: {
		start: { event: 'page_view', scope: '/' },
		metrics: [],
		conversion: { event: 'sign_up', scope: '/' },
	},
	...extra,
})

const config: ImproveConfiguration = {
	name: 'Org',
	version: 2,
	flags: {},
	audience: {},
	tests: {
		hero: makeTest({
			id: 'test_hero',
			group: 'group_1',
			ranges: [[0, 3000]],
			salt: 'hero',
		}),
		cart: makeTest({
			id: 'test_cart',
			group: 'group_1',
			ranges: [
				[3000, 4000],
				[6000, 7000],
			],
			salt: 'cart',
		}),
		price: makeTest({ id: 'test_price', allocation: 40, salt: 'price' }),
		plain: makeTest({ id: 'test_plain' }),
	},
	groups: { group_1: { salt: 'g1' } },
	holdouts: {},
}

const run = (
	slug: string,
	id: string,
	known?: string | null,
	cfg: ImproveConfiguration = config,
) =>
	assign(
		testSubject(slug, cfg.tests[slug]!, cfg, NOW),
		undefined,
		visitor(id),
		known,
	)

describe('a test in an exclusion group', () => {
	test('lets in exactly the visitors whose bucket is in its ranges', () => {
		for (const id of ids) {
			const bucket = bucketOf('g1', id)
			const { source } = run('cart', id)
			const inside =
				(bucket >= 3000 && bucket < 4000) || (bucket >= 6000 && bucket < 7000)
			expect(source === 'new').toBe(inside)
		}
	})

	test('ignores and clears a cookie of a visitor outside its ranges', () => {
		const id = ids.find((id) => bucketOf('g1', id) >= 3000)!
		expect(run('hero', id, 'b')).toEqual({
			value: 'control',
			source: 'default',
			clear: true,
		})
	})

	test('keeps the variant a cookie gives a visitor inside its ranges', () => {
		const id = ids.find((id) => bucketOf('g1', id) < 3000)!
		const other =
			pickVariant('hero', id, config.tests.hero!.options) === 'b'
				? 'control'
				: 'b'
		expect(run('hero', id, other)).toEqual({ value: other, source: 'cookie' })
	})

	test('puts a visitor in at most one of its tests', () => {
		let inOne = 0
		for (const id of ids) {
			const inTests = ['hero', 'cart'].filter(
				// A cookie for every test can't put them in two.
				(slug) => run(slug, id, 'b').source !== 'default',
			)
			expect(inTests.length).toBeLessThanOrEqual(1)
			if (inTests.length === 1) inOne++
		}
		expect(inOne / ids.length).toBeGreaterThan(0.45)
		expect(inOne / ids.length).toBeLessThan(0.55)
	})

	test('gives a visitor the same variant every time, by its own salt', () => {
		for (const id of ids.slice(0, 200)) {
			const first = run('hero', id)
			if (first.source !== 'new') continue
			expect(first.value).toBe(
				pickVariant('hero', id, config.tests.hero!.options),
			)
			expect(run('hero', id).value).toBe(first.value)
		}
	})

	test('lets nobody in when the datafile lacks its group', () => {
		const cfg = { ...config, groups: {} }
		expect(
			ids.some((id) => run('hero', id, null, cfg).source !== 'default'),
		).toBe(false)
	})

	test('needs a visitor id', () => {
		expect(
			assign(
				testSubject('hero', config.tests.hero!, config, NOW),
				undefined,
				visitor(''),
			),
		).toEqual({ value: 'control', source: 'default' })
	})
})

describe('a test with a salt and no group', () => {
	test('lets in the visitors whose bucket is below its allocation', () => {
		for (const id of ids) {
			const { source } = run('price', id)
			expect(source === 'new').toBe(bucketOf('price', id) < 4000)
			expect(run('price', id).source).toBe(source)
		}
	})
})

describe('a holdout', () => {
	const held = (
		holdout: Partial<NonNullable<ImproveConfiguration['holdouts']>[string]>,
	) => ({
		...config,
		holdouts: {
			hold_1: {
				salt: 'h1',
				share: 1000,
				tests: ['hero', 'price'],
				start: '2026-11-01T00:00:00Z',
				end: null,
				...holdout,
			},
		},
	})

	test('gives its visitors the default and names itself, cookie or not', () => {
		const cfg = held({})
		const members = ids.filter((id) => bucketOf('h1', id) < 1000)
		expect(members.length).toBeGreaterThan(150)
		for (const id of members) {
			expect(run('hero', id, 'b', cfg)).toEqual({
				value: 'control',
				source: 'default',
				holdout: 'hold_1',
				clear: true,
			})
			expect(run('price', id, null, cfg)).toEqual({
				value: 'control',
				source: 'default',
				holdout: 'hold_1',
			})
		}
	})

	test('leaves everyone else to the test’s own buckets', () => {
		const cfg = held({})
		for (const id of ids.filter((id) => bucketOf('h1', id) >= 1000)) {
			expect(run('price', id, null, cfg).source === 'new').toBe(
				bucketOf('price', id) < 4000,
			)
		}
	})

	test('holds no one before its start, after its end or outside its tests', () => {
		const id = ids.find((id) => bucketOf('h1', id) < 1000)!
		for (const cfg of [
			held({ start: '2026-12-01T00:00:00Z' }),
			held({ end: '2026-11-10T00:00:00Z' }),
			held({ tests: ['cart'] }),
		])
			expect(run('price', id, null, cfg).holdout).toBeUndefined()
	})
})

describe('a test without a salt', () => {
	test('keeps a cookie, as before', () => {
		expect(run('plain', 'visi_1', 'b')).toEqual({
			value: 'b',
			source: 'cookie',
		})
	})
})
