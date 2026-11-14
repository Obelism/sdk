import { describe, expect, test } from 'vitest'

import vectors from './bucketVectors.json'
import { bucketOf, inRanges, murmur3_32, pickVariant } from './buckets'

// Also in Obelism/obelism's packages/numbers/src/buckets.test.ts, so the copies can't drift.
const VECTORS_SHA256 =
	'353e3ecef089a9aa668e9244a4812baa15c3253b230c19af52c83375acaa4c1c'

const utf8 = (value: string) => new TextEncoder().encode(value)

const sha256 = async (value: string) =>
	Array.from(
		new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(value))),
		(byte) => byte.toString(16).padStart(2, '0'),
	).join('')

describe('murmur3_32', () => {
	test.each([
		['', 0],
		['hello', 613153351],
		['The quick brown fox jumps over the lazy dog', 0x2e4ff723],
		['héllo wörld', 2549609076],
		['日本語', 2779017879],
		['🙂', 1042440291],
	])('%j', (input, expected) => {
		expect(murmur3_32(utf8(input))).toBe(expected)
	})

	test('reads a view into a larger buffer', () => {
		const bytes = utf8('xxhelloxx').subarray(2, 7)
		expect(murmur3_32(bytes)).toBe(613153351)
	})
})

describe('the shared vectors', () => {
	test('are the ones Obelism/sdk asserts', async () => {
		expect(await sha256(JSON.stringify(vectors))).toBe(VECTORS_SHA256)
	})

	test.each(vectors.buckets)(
		'$salt / $visitorId',
		({ salt, visitorId, hash, bucket, variantBucket }) => {
			expect(murmur3_32(utf8(`${salt}.${visitorId}`))).toBe(hash)
			expect(bucketOf(salt, visitorId)).toBe(bucket)
			expect(murmur3_32(utf8(`${salt}.variant.${visitorId}`)) % 10_000).toBe(
				variantBucket,
			)
		},
	)

	test.each(vectors.variants)(
		'pickVariant $salt / $visitorId',
		({ salt, visitorId, options, expected }) => {
			expect(pickVariant(salt, visitorId, options)).toBe(expected)
		},
	)
})

describe('inRanges', () => {
	test('includes the start and excludes the end', () => {
		const ranges: [number, number][] = [
			[0, 100],
			[5000, 5001],
		]
		expect(inRanges(0, ranges)).toBe(true)
		expect(inRanges(99, ranges)).toBe(true)
		expect(inRanges(100, ranges)).toBe(false)
		expect(inRanges(5000, ranges)).toBe(true)
		expect(inRanges(5001, ranges)).toBe(false)
		expect(inRanges(0, [])).toBe(false)
	})
})

describe('pickVariant', () => {
	test('has nothing to pick without options or weight', () => {
		expect(pickVariant('s', 'v', [])).toBeNull()
		expect(
			pickVariant('s', 'v', [
				{ slug: 'a', split: 0 },
				{ slug: 'b', split: 0 },
			]),
		).toBeNull()
	})

	test('never picks a zero split', () => {
		for (let i = 0; i < 1000; i++) {
			expect(
				pickVariant('s', `v${i}`, [
					{ slug: 'a', split: 0 },
					{ slug: 'b', split: 1 },
				]),
			).toBe('b')
		}
	})
})

describe('distribution', () => {
	const SAMPLES = 100_000
	const visitorIds = Array.from(
		{ length: SAMPLES },
		(_, i) => `${1_700_000_000_000 + i * 7919}-${i.toString(36)}`,
	)

	test('fills ten equal slices evenly', () => {
		const counts = Array.from({ length: 10 }, () => 0)
		for (const id of visitorIds) {
			const slice = Math.floor(bucketOf('checkout', id) / 1000)
			counts[slice] = (counts[slice] ?? 0) + 1
		}
		for (const count of counts) {
			expect(Math.abs(count / SAMPLES - 0.1)).toBeLessThan(0.005)
		}
	})

	test('buckets under two salts are independent', () => {
		let inB = 0
		let inBoth = 0
		for (const id of visitorIds) {
			if (bucketOf('groupB', id) >= 5000) continue
			inB++
			if (bucketOf('groupA', id) < 5000) inBoth++
		}
		expect(Math.abs(inBoth / inB - 0.5)).toBeLessThan(0.01)
	})

	test('splits evenly over equal rounded splits', () => {
		const options = [0, 1, 2].map((i) => ({
			slug: `option_${i}`,
			split: 33.33,
		}))
		const counts = new Map<string, number>()
		for (const id of visitorIds) {
			const slug = pickVariant('test_1', id, options) ?? ''
			counts.set(slug, (counts.get(slug) ?? 0) + 1)
		}
		expect(counts.size).toBe(3)
		for (const count of counts.values()) {
			expect(Math.abs(count / SAMPLES - 1 / 3)).toBeLessThan(0.005)
		}
	})
})
