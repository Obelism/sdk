import { afterEach, expect, test, vi } from 'vitest'

import { getBackoffDelayMs, parseRetryAfterMs } from './retry'

afterEach(() => vi.restoreAllMocks())

test('parseRetryAfterMs parses delta-seconds', () => {
	expect(parseRetryAfterMs('120')).toBe(120_000)
	expect(parseRetryAfterMs('0')).toBe(0)
})

test('parseRetryAfterMs parses an HTTP date relative to now', () => {
	const now = Date.parse('2026-01-01T00:00:00Z')
	expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:30 GMT', now)).toBe(30_000)
})

test('parseRetryAfterMs never returns a negative delay', () => {
	const now = Date.parse('2026-01-01T00:01:00Z')
	expect(parseRetryAfterMs('Thu, 01 Jan 2026 00:00:00 GMT', now)).toBe(0)
})

test('parseRetryAfterMs returns undefined for missing/invalid values', () => {
	expect(parseRetryAfterMs(null)).toBeUndefined()
	expect(parseRetryAfterMs(undefined)).toBeUndefined()
	expect(parseRetryAfterMs('not-a-date')).toBeUndefined()
})

test('getBackoffDelayMs grows exponentially and caps at maxDelay', () => {
	vi.spyOn(Math, 'random').mockReturnValue(1)
	expect(getBackoffDelayMs(0, 300, 3000)).toBe(300)
	expect(getBackoffDelayMs(1, 300, 3000)).toBe(600)
	expect(getBackoffDelayMs(2, 300, 3000)).toBe(1200)
	// 300 * 2^4 = 4800 -> capped at 3000
	expect(getBackoffDelayMs(4, 300, 3000)).toBe(3000)
})

test('getBackoffDelayMs applies full jitter', () => {
	vi.spyOn(Math, 'random').mockReturnValue(0)
	expect(getBackoffDelayMs(3, 300, 3000)).toBe(0)
})
