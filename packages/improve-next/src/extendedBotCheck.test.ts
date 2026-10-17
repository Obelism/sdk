import { expect, test } from 'vitest'

import { extendedBotCheck } from './extendedBotCheck'

test('Basic string value', () => {
	const outcome = extendedBotCheck('chrome user')
	expect(outcome).toBe(false)
})

test('Empty value', () => {
	// @ts-expect-error Testing invalid error
	const outcome = extendedBotCheck()
	expect(outcome).toBe(false)
})

test('Empty value', () => {
	const outcome = extendedBotCheck('')
	expect(outcome).toBe(false)
})

test('Extended bot value', () => {
	const outcome = extendedBotCheck('FullStoryBot')
	expect(outcome).toBe(true)
})

test('Extended bot value, two', () => {
	const outcome = extendedBotCheck('blowra')
	expect(outcome).toBe(true)
})
