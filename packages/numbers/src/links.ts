import { hasLocation, toWebUrl } from './url'

// Documents, archives and media, not images a browser shows inline (a link
// with `download` still counts, whatever it points at).
const DOWNLOAD_EXTENSIONS = new Set([
	'7z',
	'avi',
	'csv',
	'doc',
	'docx',
	'gz',
	'mov',
	'mp3',
	'mp4',
	'pdf',
	'ppt',
	'pptx',
	'rar',
	'tar',
	'txt',
	'wav',
	'xls',
	'xlsx',
	'xml',
	'zip',
])

/** What a click on a link counts as, ready for `track(event, scope, { params })`. */
export type LinkEvent = {
	event: 'file_download' | 'outbound_click'
	scope: string
	params?: Record<string, string>
}

/** Both on by default, unlike `autoTrack`'s. */
export type ClassifyLinkOptions = {
	outbound?: boolean | undefined
	downloads?: boolean | undefined
}

const fileOf = (url: URL) => {
	const name = url.pathname.split('/').pop() || url.pathname
	const dot = name.lastIndexOf('.')
	return {
		name,
		dot,
		extension: dot < 0 ? '' : name.slice(dot + 1).toLowerCase(),
	}
}

/** Whether the URL is an http(s) page on another site than this one. */
export const isOutbound = (url: string | URL) => {
	const parsed = toWebUrl(url)
	return !!parsed && hasLocation() && parsed.origin !== location.origin
}

/**
 * Whether the URL is an http(s) file to download: a document, archive or
 * media file by its extension, or anything the link marks with `download`.
 */
export const isDownload = (url: string | URL, anchor?: HTMLAnchorElement) => {
	const parsed = toWebUrl(url)
	if (!parsed) return false
	return (
		!!anchor?.hasAttribute('download') ||
		DOWNLOAD_EXTENSIONS.has(fileOf(parsed).extension)
	)
}

/**
 * The `file_download` or `outbound_click` a click on this element (or inside
 * a link) counts as, the way `autoTrack` sends it: scoped to the link's
 * `data-numbers-id`, else the file's name or the destination. `null` for any
 * other click.
 */
export const classifyLink = (
	target: Element,
	{ outbound = true, downloads = true }: ClassifyLinkOptions = {},
): LinkEvent | null => {
	const link = target.closest?.('a[href]') as HTMLAnchorElement | null
	if (!link) return null
	const url = toWebUrl(link.href)
	if (!url) return null
	const id = link.closest('[data-numbers-id]')?.getAttribute('data-numbers-id')

	const event =
		downloads && isDownload(url, link)
			? 'file_download'
			: outbound && isOutbound(url)
				? 'outbound_click'
				: null
	if (!event) return null
	if (id) return { event, scope: id }
	if (event === 'outbound_click')
		return {
			event,
			scope: `${url.origin}${url.pathname}`,
			params: { link_domain: url.hostname },
		}
	const { name, dot, extension } = fileOf(url)
	return {
		event,
		scope: name,
		params: {
			file_name: extension ? name.slice(0, dot) : name,
			...(extension && { file_extension: extension }),
		},
	}
}
