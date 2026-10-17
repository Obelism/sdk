import { expect, test } from 'vitest'

import { ImproveServerSDK } from './server'
import { diff } from './utils/diff'
import { ImproveConfiguration } from './types'

type CountObject = {
	[x: string]: number
}

const TEST_CONFIG: ImproveConfiguration = {
	name: 'nextjs-example',
	version: 1,
	flags: {},
	tests: {
		'startpage-visual': {
			id: 'test_QF5TJM2OYC3UQGHBFJ1543C8E1',
			name: 'Startpage Visual',
			defaultValue: 'control',
			allocation: 100,
			audience: '',
			options: [
				{
					name: 'Control',
					slug: 'control',
					value: 'a',
					split: 50,
				},
				{
					name: 'Variation',
					slug: 'variation',
					value: 'b',
					split: 50,
				},
			],
			events: {
				start: { event: 'pageLoad', scope: 'homepage' },
				metrics: [],
				conversion: { event: 'visualClicked', scope: 'homepage' },
			},
		},
	},
	audience: {},
}

const UA =
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2'

test('1000 times getTestValue with new visitor ids', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})

	const iterations = 1000
	const outcomeCount: CountObject = {}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1
	}

	const delta = diff(...(Object.values(outcomeCount) as [number, number]))

	// getTestValue assigns each variant with Math.random, so a 50/50 split is
	// binomially distributed: the delta between the two buckets has a standard
	// deviation of ~sqrt(iterations). Allow ~5 standard deviations so the test
	// effectively never flakes while still catching a grossly skewed split.
	const maxDelta = Math.ceil(Math.sqrt(iterations) * 5)

	expect(delta).toBeLessThanOrEqual(maxDelta)
})

test('200 runs with 100 different visitor IDS', () => {
	const improveSDK = new ImproveServerSDK({
		organizationId: 'test',
		environment: 'staging',
		config: TEST_CONFIG,
	})

	const iterations = 100
	const outcomeCount: CountObject = {}
	const secondRunCount: CountObject = {}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1
	}

	for (let i = 0; i < iterations; i++) {
		const outcome = improveSDK.getTestValue('startpage-visual', `visi_${i}`, UA)
		if (!outcome) continue
		secondRunCount[outcome] = (secondRunCount[outcome] || 0) + 1
	}

	expect(outcomeCount).toStrictEqual(secondRunCount)
})
