import { expect, test } from 'vitest'

import { generateImproveProvider } from './index'

test('gives each space its own provider', () => {
	const first = generateImproveProvider({
		organizationId: 'org_1',
		environment: 'production',
	})
	const second = generateImproveProvider({
		organizationId: 'org_2',
		environment: 'production',
	})

	// A shared context would hand one space's tests to the other.
	expect(first.ImproveProvider).not.toBe(second.ImproveProvider)
	expect(first.useTestValue).not.toBe(second.useTestValue)
	expect(first.useFlagValue).not.toBe(second.useFlagValue)
})

test('offers the hooks it promises', () => {
	const provider = generateImproveProvider({
		organizationId: 'org_1',
		environment: 'production',
	})

	expect(Object.keys(provider).sort()).toEqual([
		'ImproveProvider',
		'useFlagValue',
		'useImproveStatus',
		'usePostAnalytic',
		'useTestValue',
	])
})
