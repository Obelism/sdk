import { afterEach, expect, test, vi } from 'vitest'

import { getBackoffDelayMs } from './retry'

afterEach(() => vi.restoreAllMocks())

test('grows exponentially and caps at maxDelay', () => {
	vi.spyOn(Math, 'random').mockReturnValue(1)
	expect(getBackoffDelayMs(0, 300, 3000)).toBe(300)
	expect(getBackoffDelayMs(1, 300, 3000)).toBe(600)
	expect(getBackoffDelayMs(2, 300, 3000)).toBe(1200)
	// 300 * 2^4 = 4800 -> capped at 3000
	expect(getBackoffDelayMs(4, 300, 3000)).toBe(3000)
})

test('applies full jitter', () => {
	vi.spyOn(Math, 'random').mockReturnValue(0)
	expect(getBackoffDelayMs(3, 300, 3000)).toBe(0)
})
