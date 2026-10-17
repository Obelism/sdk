import { expect, test } from 'vitest'

import { getRandomString } from './getRandomString'

test('No arguments', () => {
	const outcome = getRandomString()
	expect(typeof outcome).toBe('string')
	expect(outcome.length).toBe(5)
})

test('1 char size', () => {
	const outcome = getRandomString(1)
	expect(typeof outcome).toBe('string')
	expect(outcome.length).toBe(1)
})

test('20 char size', () => {
	const outcome = getRandomString(20)
	expect(typeof outcome).toBe('string')
	expect(outcome.length).toBe(20)
})

test('Null', () => {
	const outcome = getRandomString(null)
	expect(typeof outcome).toBe('string')
	expect(outcome.length).toBe(0)
})

test('Undefined', () => {
	const outcome = getRandomString(undefined)
	expect(typeof outcome).toBe('string')
	expect(outcome.length).toBe(5)
})
