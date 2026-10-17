import { expect, test } from 'vitest'

import { generateImproveProvider } from './index'

test('No arguments', () => {
	// @ts-expect-error Testing
	const outcome = generateImproveProvider({})
	expect(Boolean(outcome) !== false).toBe(true)
})
