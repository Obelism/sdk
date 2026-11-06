import { expect, test } from 'vitest'

import { getRandomTestValue } from './getRandomTestValue'

const options = (...splits: number[]) =>
	splits.map((split, index) => ({
		name: `Option ${index}`,
		slug: `option_${index}`,
		value: '',
		split,
	}))

const picks = (splits: number[], samples: number) => {
	const counts = new Map<string, number>()
	for (let index = 0; index < samples; index++) {
		const value = getRandomTestValue(options(...splits))
		if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
	}
	return counts
}

test('picks in proportion to the splits', () => {
	const counts = picks([90, 10], 2000)
	// 1800 ± 100 is seven standard deviations: only a wrong split breaks it.
	expect(counts.get('option_0')).toBeGreaterThan(1700)
	expect(counts.get('option_0')).toBeLessThan(1900)
})

test('gives every option an equal share when the splits are equal', () => {
	const counts = picks([25, 25, 25, 25], 4000)
	expect(counts.size).toBe(4)
	for (const count of counts.values()) {
		expect(count).toBeGreaterThan(850)
		expect(count).toBeLessThan(1150)
	}
})

test('picks the only option, whatever its split', () => {
	expect(getRandomTestValue(options(100))).toBe('option_0')
})

test('has nothing to pick without options', () => {
	expect(getRandomTestValue([])).toBeNull()
})
