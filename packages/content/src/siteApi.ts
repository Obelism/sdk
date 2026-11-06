import type { ShopKind } from './bridge/shop'

// Every call the bridge makes through the site's `/cms/api/…`, and what the
// site's handler (`createSiteEditing`, ./site) lets through: one list, so a
// call the bridge makes can't be one the proxy refuses.
//
// The bridge goes through the site because the CMS token stays in an httpOnly
// cookie on it (the CMS's docs/adr/0010).

const entryPath = (entryId: string, suffix = '') =>
	`entries/${encodeURIComponent(entryId)}${suffix}`

export const siteApi = {
	session: () => 'session',
	pages: () => 'pages',
	stats: () => 'stats',
	form: () => 'form',
	createEntry: () => 'entries',
	shopPages: (kind: ShopKind) => `${kind}-pages`,
	entry: (entryId: string) => entryPath(entryId),
	preview: (entryId: string) => entryPath(entryId, '/preview'),
	prompt: (entryId: string) => entryPath(entryId, '/prompt'),
	view: (entryId: string) => entryPath(entryId, '/view'),
	apply: (entryId: string) => entryPath(entryId, '/apply'),
	save: (entryId: string) => entryPath(entryId, '/save'),
	publish: (entryId: string) => entryPath(entryId, '/publish'),
}

// Each call's route on the CMS's site API, as the site's proxy matches it: an
// entry id is one path segment of word characters or dashes.
const ROUTE: Record<keyof typeof siteApi, string> = {
	session: 'session',
	pages: 'pages',
	stats: 'stats',
	form: 'form',
	createEntry: 'entries',
	shopPages: '(?:product|collection)-pages',
	entry: 'entries/[\\w-]+',
	preview: 'entries/[\\w-]+/preview',
	prompt: 'entries/[\\w-]+/prompt',
	view: 'entries/[\\w-]+/view',
	apply: 'entries/[\\w-]+/apply',
	save: 'entries/[\\w-]+/save',
	publish: 'entries/[\\w-]+/publish',
}

// The method each call is made with. The proxy lets only that one through.
export const SITE_METHOD: Record<keyof typeof siteApi, 'GET' | 'POST'> = {
	session: 'GET',
	pages: 'GET',
	stats: 'POST',
	form: 'POST',
	createEntry: 'POST',
	shopPages: 'POST',
	entry: 'GET',
	preview: 'POST',
	prompt: 'POST',
	view: 'POST',
	apply: 'POST',
	save: 'POST',
	publish: 'POST',
}

// Whether the site's proxy lets this method and route through.
export const siteApiAllows = (method: string, route: string) =>
	(Object.keys(siteApi) as (keyof typeof siteApi)[]).some(
		(name) =>
			SITE_METHOD[name] === method &&
			new RegExp(`^${ROUTE[name]}$`).test(route),
	)
