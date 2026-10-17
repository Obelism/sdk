import { expect, test } from 'vitest'

import { diff } from './diff'

test('Positive', () => {
	const outcome = diff(5, 7)
	expect(outcome).toBe(2)
})

test('Positive reverse', () => {
	const outcome = diff(7, 5)
	expect(outcome).toBe(2)
})

test('Negative', () => {
	const outcome = diff(-10, -5)
	expect(outcome).toBe(5)
})

test('Negative reverse', () => {
	const outcome = diff(-10, -20)
	expect(outcome).toBe(10)
})
