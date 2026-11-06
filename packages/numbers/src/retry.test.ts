import { expect, test } from 'vitest'

import { parseRetryAfterMs } from './retry'

test('parses delta-seconds', () => {
	expect(parseRetryAfterMs('120')).toBe(120_000)
	expect(parseRetryAfterMs('0')).toBe(0)
})

test('parses an HTTP date relative to now', () => {
	const now = Date.parse('2026-01-01T00:00:00Z')
	expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:30 GMT', now)).toBe(30_000)
})

test('never returns a negative delay', () => {
	const now = Date.parse('2026-01-01T00:01:00Z')
	expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
})

test('is undefined for a missing or invalid value', () => {
	expect(parseRetryAfterMs(null)).toBeUndefined()
	expect(parseRetryAfterMs(undefined)).toBeUndefined()
	expect(parseRetryAfterMs('not-a-date')).toBeUndefined()
})
