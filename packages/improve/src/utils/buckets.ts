// Improve's deterministic buckets (improve's docs/adr/0014). A copy lives in
// Obelism/obelism's packages/numbers/src/buckets.ts; bucketVectors.json pins both.

export const BUCKETS = 10_000

const C1 = 0xcc9e2d51
const C2 = 0x1b873593

const rotl = (x: number, r: number) => (x << r) | (x >>> (32 - r))

const scramble = (k: number) => Math.imul(rotl(Math.imul(k, C1), 15), C2)

// MurmurHash3 x86_32, unsigned.
export const murmur3_32 = (bytes: Uint8Array, seed = 0): number => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
	const length = bytes.byteLength
	const blocks = length & ~3
	let h = seed | 0

	for (let i = 0; i < blocks; i += 4) {
		h ^= scramble(view.getUint32(i, true))
		h = (Math.imul(rotl(h, 13), 5) + 0xe6546b64) | 0
	}

	let k = 0
	for (let i = length - 1; i >= blocks; i--) k = (k << 8) | view.getUint8(i)
	if (length & 3) h ^= scramble(k)

	h ^= length
	h ^= h >>> 16
	h = Math.imul(h, 0x85ebca6b)
	h ^= h >>> 13
	h = Math.imul(h, 0xc2b2ae35)
	h ^= h >>> 16
	return h >>> 0
}

const encoder = new TextEncoder()

const hashToBucket = (key: string) => murmur3_32(encoder.encode(key)) % BUCKETS

export const bucketOf = (salt: string, visitorId: string): number =>
	hashToBucket(`${salt}.${visitorId}`)

export const inRanges = (
	bucket: number,
	ranges: readonly (readonly [start: number, end: number])[],
): boolean => ranges.some(([start, end]) => bucket >= start && bucket < end)

// Splits are weights normalised by their sum, as getRandomTestValue reads them.
export const pickVariant = (
	salt: string,
	visitorId: string,
	options: readonly { slug: string; split: number }[],
): string | null => {
	const sum = options.reduce((acc, { split }) => acc + split, 0)
	if (!(sum > 0)) return null

	const point = (hashToBucket(`${salt}.variant.${visitorId}`) / BUCKETS) * sum
	let cumulative = 0
	for (const option of options) {
		cumulative += option.split
		if (cumulative > point) return option.slug
	}
	return options[options.length - 1]?.slug ?? null
}
