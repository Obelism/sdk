import { expect, test } from 'vitest'

import { SHOP_KINDS } from './shopKinds'
import { siteApi, siteApiAllows } from './siteApi'

// What each call is made with, and the verb the site's API takes for it: a
// new call has to add its own, or the type of this record stops the build.
const SAMPLE: Record<
	keyof typeof siteApi,
	{ path: string[]; method: 'GET' | 'POST' }
> = {
	session: { path: [], method: 'GET' },
	pages: { path: [], method: 'GET' },
	stats: { path: [], method: 'POST' },
	form: { path: [], method: 'POST' },
	createEntry: { path: [], method: 'POST' },
	shopPages: { path: ['product'], method: 'POST' },
	entry: { path: ['entry_1'], method: 'GET' },
	preview: { path: ['entry_1'], method: 'POST' },
	prompt: { path: ['entry_1'], method: 'POST' },
	view: { path: ['entry_1'], method: 'POST' },
	apply: { path: ['entry_1'], method: 'POST' },
	save: { path: ['entry_1'], method: 'POST' },
	publish: { path: ['entry_1'], method: 'POST' },
}

const calls = Object.keys(siteApi) as (keyof typeof siteApi)[]

test('every call the bridge makes is one the site forwards', () => {
	for (const name of calls) {
		const build = siteApi[name] as (...args: string[]) => string
		const { path, method } = SAMPLE[name]
		const route = build(...path)
		expect(siteApiAllows(method, route), `${name}: ${route}`).toBe(true)
	}
})

test('every kind of shop page has a route', () => {
	for (const kind of SHOP_KINDS) {
		expect(siteApiAllows('POST', siteApi.shopPages(kind))).toBe(true)
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
