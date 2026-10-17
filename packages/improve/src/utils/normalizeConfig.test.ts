import { expect, test } from 'vitest'

import { ImproveFetchError } from './errors'
import { normalizeConfig } from './normalizeConfig'

test('fills missing collections on an empty {} response', () => {
	const config = normalizeConfig({})
	expect(config.tests).toEqual({})
	expect(config.flags).toEqual({})
	expect(config.audience).toEqual({})
	expect(config.name).toBe('')
	expect(config.version).toBe(0)
})

test('preserves a well-formed config', () => {
	const input = {
		name: 'my-config',
		version: 3,
		tests: { a: {} },
		flags: { b: {} },
		audience: { c: {} },
	}
	expect(normalizeConfig(input)).toEqual(input)
})

test('backfills only the missing collections', () => {
	const config = normalizeConfig({ name: 'partial', tests: { a: {} } })
	expect(config.tests).toEqual({ a: {} })
	expect(config.flags).toEqual({})
	expect(config.audience).toEqual({})
})

test('throws invalid-response for non-object bodies', () => {
	expect(() => normalizeConfig(null)).toThrow(ImproveFetchError)
	expect(() => normalizeConfig('nope')).toThrow(ImproveFetchError)
	expect(() => normalizeConfig([])).toThrow(ImproveFetchError)
})
