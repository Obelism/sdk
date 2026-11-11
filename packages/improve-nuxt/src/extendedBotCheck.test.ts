import { expect, test } from 'vitest'

import { extendedBotCheck } from './extendedBotCheck'

test('lets a browser through', () => {
	expect(extendedBotCheck('chrome user')).toBe(false)
})

test('is false with no user agent at all', () => {
	// @ts-expect-error a caller may have none to pass
	expect(extendedBotCheck()).toBe(false)
	expect(extendedBotCheck('')).toBe(false)
})

test('catches the bots a user-agent parser misses', () => {
	expect(extendedBotCheck('FullStoryBot')).toBe(true)
	expect(extendedBotCheck('blowra')).toBe(true)
})
