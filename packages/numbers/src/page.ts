import { MAX_FIELD_LENGTH, MAX_URL_LENGTH } from './constants'
import type { PageContext } from './types'

const utm = (params: URLSearchParams, name: string) =>
	params.get(name)?.slice(0, MAX_FIELD_LENGTH) || undefined

// Events come in bursts on one page, so the context is worked out once per
// path and query string and shared until the URL changes.
let contextKey: string | undefined
let pageContext: PageContext | undefined

// The page now: its path (without the query string, which numbers drops too)
// and the UTM tags.
export const getPageContext = (): PageContext => {
	const { pathname, search } = location
	const key = `${pathname}${search}`
	if (key === contextKey) return pageContext!
	const context: PageContext = { path: pathname.slice(0, MAX_URL_LENGTH) }
	if (search) {
		const params = new URLSearchParams(search)
		const utmSource = utm(params, 'utm_source')
		const utmMedium = utm(params, 'utm_medium')
		const utmCampaign = utm(params, 'utm_campaign')
		if (utmSource) context.utmSource = utmSource
		if (utmMedium) context.utmMedium = utmMedium
		if (utmCampaign) context.utmCampaign = utmCampaign
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
