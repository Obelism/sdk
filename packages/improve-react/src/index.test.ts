import { expect, test } from 'vitest'

import { generateImproveProvider } from './index'

test('gives each call its own provider and hooks', () => {
	const first = generateImproveProvider({
		organizationId: 'org_1',
		environment: 'production',
	})
	const second = generateImproveProvider({
		organizationId: 'org_2',
		environment: 'production',
	})

	// One provider per call: a page with two spaces gets two, never a reused one.
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
