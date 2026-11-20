import { MAX_FIELD_LENGTH, MAX_URL_LENGTH } from './constants'
import { toWebUrl } from './url'
import type { PageContext } from './types'

const UTM_TAGS = {
	utmSource: 'utm_source',
	utmMedium: 'utm_medium',
	utmCampaign: 'utm_campaign',
} as const

// Events come in bursts on one page, so the context is worked out once per
// path and query string and shared until the URL changes. Callers copy it
// into a beacon; none of them mutate it.
let contextKey: string | undefined
let pageContext: PageContext | undefined

// The page now, or at `url` when it parses as http(s): its path (without the
// query string, which numbers drops too) and the UTM tags. A path numbers
// refuses would lose the whole batch, so anything else is the page now.
export const pageOf = (url?: string | URL) =>
	(url && toWebUrl(url)) || location

export const getPageContext = (url?: string | URL): PageContext => {
	const { pathname, search } = pageOf(url)
	const key = `${pathname}${search}`
	if (key === contextKey) return pageContext!
	const context: PageContext = { path: pathname.slice(0, MAX_URL_LENGTH) }
	if (search) {
		const params = new URLSearchParams(search)
		for (const [field, name] of Object.entries(UTM_TAGS)) {
			// numbers refuses a NUL or a lone surrogate, and the whole batch with
			// it. Decoding never makes the latter; the cut can, from an emoji.
			const value = params
				.get(name)
				?.slice(0, MAX_FIELD_LENGTH)
				.replace(/[\uD800-\uDBFF]$/, '')
			if (value && !value.includes('\0'))
				context[field as keyof typeof UTM_TAGS] = value
		}
	}
	contextKey = key
	pageContext = context
	return context
}

// Where the visit came from: another site's origin and path, never this
// site's own pages or a query string.
export const getExternalReferrer = () => {
	if (!document.referrer) return undefined
	try {
		const referrer = new URL(document.referrer)
		if (referrer.host === location.host) return undefined
		return `${referrer.origin}${referrer.pathname}`.slice(0, MAX_URL_LENGTH)
	} catch {
		return undefined
	}
}
