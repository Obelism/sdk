import { expect, test } from 'vitest'

import { truncate } from './truncate'

test('leaves short strings unchanged', () => {
	expect(truncate('hello', 256)).toBe('hello')
})

test('caps strings longer than maxLength', () => {
	const long = 'x'.repeat(500)
	expect(truncate(long, 256)).toHaveLength(256)
})

test('keeps exactly maxLength characters', () => {
	expect(truncate('abcdef', 3)).toBe('abc')
})
