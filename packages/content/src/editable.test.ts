import { describe, expect, it } from 'vitest'

import { editable } from './editable'

describe('editable', () => {
	it('marks a block with its uid', () => {
		expect(editable({ _uid: 'b_1' })).toEqual({ 'data-cms-uid': 'b_1' })
		expect(editable(null)).toEqual({})
	})
})
