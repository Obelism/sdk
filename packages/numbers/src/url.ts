export const hasLocation = () => typeof location !== 'undefined'

// Only http(s): a data: URL's path is its whole payload, and mailto:/tel:
// aren't destinations or pages.
export const toWebUrl = (url: string | URL) => {
	try {
		const parsed = new URL(url, hasLocation() ? location.href : undefined)
		return /^https?:$/.test(parsed.protocol) ? parsed : null
	} catch {
		return null
	}
}
