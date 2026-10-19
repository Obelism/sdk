import type { Link } from './types'

// The address of a link field's value, for an `<a href>`. A page's address
// is your site's routing (`/nl/pricing`, `nl.example.com/pricing`, the home
// page at `/`), so pass `url` to turn its path into one; it defaults to
// `/<path>`. The link's query and hash go after it: `&` joins a query the
// address has already, and the link's hash replaces the address's own.
//
//   linkHref(button.link, { url: (path) => `/${locale}/${path}` })

export type LinkHrefOptions = {
	// The address of a page's path (in the locale the entry was fetched in).
	url?: ((path: string) => string) | undefined
}

export const linkHref = (
	link: Link | null | undefined,
	{ url = (path) => `/${path}` }: LinkHrefOptions = {},
): string | null => {
	if (!link) return null
	if (link.type === 'entry' && link.entry.path === null) return null
	const base = link.type === 'url' ? link.url : url(link.entry.path!)
	const hashAt = base.indexOf('#')
	const address = hashAt === -1 ? base : base.slice(0, hashAt)
	const ownHash = hashAt === -1 ? null : base.slice(hashAt + 1)
	const withQuery = link.query
		? `${address}${address.includes('?') ? '&' : '?'}${link.query}`
		: address
	const hash = link.hash ?? ownHash
	return hash ? `${withQuery}#${hash}` : withQuery
}
