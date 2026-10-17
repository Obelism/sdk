import { expect, test } from 'vitest'

import { getRandomTestValue } from './getRandomTestValue'
import { diff } from './diff'

type CountObject = {
	[x: string]: number
}

test('Test: 50/50', () => {
	const outcomeCount: CountObject = {}
	const options = [
		{
			name: 'Control',
			slug: 'control',
			value: '',
			split: 50,
		},
		{
			name: 'Variation',
			slug: 'variation',
			value: '',
			split: 50,
		},
	]

	for (let i = 0; i < 100; i++) {
		const outcome = getRandomTestValue(options)
		if (!outcome) continue
		outcomeCount[outcome] = outcomeCount[outcome] + 1 || 1
	}

	const delta = diff(outcomeCount.control, outcomeCount.variation)

	expect(delta).toBeLessThanOrEqual(100)
})

test('Test: 25/25/25/25', () => {
	const outcomeCount: CountObject = {}

	const options = [
		{
			name: 'A',
			slug: 'a',
			value: '',
			split: 25,
		},
		{
			name: 'B',
			slug: 'b',
			value: '',
			split: 25,
		},
		{
			name: 'C',
			slug: 'c',
			value: '',
			split: 25,
		},
		{
			name: 'D',
			slug: 'd',
			value: '',
			split: 25,
		},
	]

	for (let i = 0; i < 4000; i++) {
		const outcome = getRandomTestValue(options)
		if (!outcome) continue
		outcomeCount[outcome] = outcomeCount[outcome] + 1 || 1
	}

	Object.values(outcomeCount).forEach((count) => {
		const delta = diff(count, 1000)
		expect(delta).toBeLessThanOrEqual(100)
	})
})
