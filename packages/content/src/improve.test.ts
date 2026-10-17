import { describe, expect, it } from 'vitest'

import { isImproveBlock, pickImproveVariant } from './improve'
import type { ImproveBlock } from './types'

const block: ImproveBlock = {
	_uid: 'e1',
	_type: '_improve',
	kind: 'test',
	slug: 'homepage-hero',
	variants: {
		control: [{ _uid: 'a', _type: 'hero' }],
		'bolder-copy': [{ _uid: 'b', _type: 'hero' }],
	},
}

describe('pickImproveVariant', () => {
	it("picks the visitor's option", () => {
		expect(pickImproveVariant(block, 'bolder-copy')).toEqual([
			{ _uid: 'b', _type: 'hero' },
		])
	})

	it('falls back to the fallback option, else the first variant', () => {
		expect(pickImproveVariant(block, null, 'bolder-copy')[0]?._uid).toBe('b')
		expect(pickImproveVariant(block, null)[0]?._uid).toBe('a')
		expect(pickImproveVariant(block, 'unknown')[0]?._uid).toBe('a')
		expect(pickImproveVariant({ ...block, variants: {} }, 'control')).toEqual(
			[],
		)
	})

	it('tells the block apart from others', () => {
		expect(isImproveBlock(block)).toBe(true)
		expect(isImproveBlock({ _uid: 'x', _type: 'hero' })).toBe(false)
	})
})
