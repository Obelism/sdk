import { expect, test } from 'vitest'

import { SITE_METHOD, siteApi, siteApiAllows } from './siteApi'

// What each call is made with. A new call has to add its own sample, or the
// type of this record stops the build.
const SAMPLE: Record<keyof typeof siteApi, string[]> = {
	session: [],
	pages: [],
	stats: [],
	form: [],
	createEntry: [],
	shopPages: ['product'],
	entry: ['entry_1'],
	preview: ['entry_1'],
	prompt: ['entry_1'],
	view: ['entry_1'],
	apply: ['entry_1'],
	save: ['entry_1'],
	publish: ['entry_1'],
}

const calls = Object.keys(siteApi) as (keyof typeof siteApi)[]

test('every call the bridge makes is one the site forwards', () => {
	for (const name of calls) {
		const build = siteApi[name] as (...args: string[]) => string
		const path = build(...SAMPLE[name])
		expect(siteApiAllows(SITE_METHOD[name], path), `${name}: ${path}`).toBe(
			true,
		)
	}
})

test('and nothing else', () => {
	// Not a route of the site API…
	expect(siteApiAllows('POST', 'entries/entry_1/token')).toBe(false)
	// …nor another method for one that is.
	expect(siteApiAllows('GET', 'stats')).toBe(false)
	expect(siteApiAllows('DELETE', 'entries/entry_1')).toBe(false)
	// An id is one path segment, not a path of its own.
	expect(siteApiAllows('POST', 'entries/../../admin/prompt')).toBe(false)
})
