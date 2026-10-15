import type { Asset, Entry, EntryStub, RichTextNode } from './types'

// Links are only rendered for these; anything else (`javascript:` …) keeps its
// text without the link. The same rule the CMS validates with.
export const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|#|\/(?!\/))/i

export const escapeHtml = (value: string) =>
	value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')

const MARK_TAGS: Record<string, string> = {
	bold: 'strong',
	italic: 'em',
	underline: 'u',
	strike: 's',
	code: 'code',
}

export type RichTextHtmlOptions = {
	// HTML for an embedded entry. Default: nothing.
	renderEntry?: (entry: Entry | EntryStub, node: RichTextNode) => string
	// HTML for an embedded asset. Default: an image in a <figure>, or a link.
	renderAsset?: (asset: Asset, node: RichTextNode) => string
}

const defaultRenderAsset = (asset: Asset) => {
	const url = escapeHtml(asset.url)
	if (asset.mimeType.startsWith('image/')) {
		const alt = typeof asset.alt === 'string' ? asset.alt : ''
		const size =
			asset.width && asset.height
				? ` width="${asset.width}" height="${asset.height}"`
				: ''
		return `<figure><img src="${url}" alt="${escapeHtml(alt)}"${size}></figure>`
	}
	return `<p><a href="${url}">${escapeHtml(asset.filename)}</a></p>`
}

// Rich text JSON (what the delivery API answers by default) to plain, safe
// HTML — the same HTML the API renders with `richText: 'html'`, except that
// embeds are up to you.
export const richTextToHtml = (
	doc: RichTextNode | null | undefined,
	{ renderEntry, renderAsset = defaultRenderAsset }: RichTextHtmlOptions = {},
): string => {
	if (!doc) return ''

	const marks = (node: RichTextNode, html: string) =>
		(node.marks ?? []).reduceRight((inner, mark) => {
			if (mark.type === 'link') {
				const href = String(mark.attrs?.href ?? '')
				if (!SAFE_HREF.test(href)) return inner
				const target =
					mark.attrs?.target === '_blank'
						? ' target="_blank" rel="noopener noreferrer"'
						: ''
				const title = mark.attrs?.title
					? ` title="${escapeHtml(String(mark.attrs.title))}"`
					: ''
				return `<a href="${escapeHtml(href)}"${target}${title}>${inner}</a>`
			}
			const tag = MARK_TAGS[mark.type]
			return tag ? `<${tag}>${inner}</${tag}>` : inner
		}, html)

	const render = (node: RichTextNode): string => {
		const children = () => (node.content ?? []).map(render).join('')
		switch (node.type) {
			case 'doc':
				return children()
			case 'text':
				return marks(node, escapeHtml(node.text ?? ''))
			case 'hardBreak':
				return '<br>'
			case 'paragraph':
				return `<p>${children()}</p>`
			case 'heading': {
				const tag = `h${headingLevel(node)}`
				return `<${tag}>${children()}</${tag}>`
			}
			case 'blockquote':
				return `<blockquote>${children()}</blockquote>`
			case 'bulletList':
				return `<ul>${children()}</ul>`
			case 'orderedList': {
				const start = Number(node.attrs?.start ?? 1)
				return `<ol${start !== 1 ? ` start="${start}"` : ''}>${children()}</ol>`
			}
			case 'listItem':
				return `<li>${children()}</li>`
			case 'codeBlock': {
				const language = node.attrs?.language
				const className = language
					? ` class="language-${escapeHtml(String(language))}"`
					: ''
				return `<pre><code${className}>${children()}</code></pre>`
			}
			case 'horizontalRule':
				return '<hr>'
			case 'embeddedEntry': {
				const entry = node.attrs?.entry as Entry | EntryStub | undefined
				return entry && renderEntry ? renderEntry(entry, node) : ''
			}
			case 'embeddedAsset': {
				const asset = node.attrs?.asset as Asset | undefined
				return asset ? renderAsset(asset, node) : ''
			}
			default:
				return ''
		}
	}

	return render(doc)
}

export const headingLevel = (node: RichTextNode) => {
	const level = Number(node.attrs?.level)
	return (level >= 1 && level <= 6 ? level : 2) as 1 | 2 | 3 | 4 | 5 | 6
}

// The text of a document without any markup, e.g. for a meta description.
export const richTextToPlainText = (
	doc: RichTextNode | null | undefined,
): string => {
	if (!doc) return ''
	const BLOCKS = new Set([
		'paragraph',
		'heading',
		'blockquote',
		'listItem',
		'codeBlock',
	])
	const parts: string[] = []
	const walk = (node: RichTextNode) => {
		if (node.type === 'text') parts.push(node.text ?? '')
		else if (node.type === 'hardBreak') parts.push('\n')
		node.content?.forEach(walk)
		if (BLOCKS.has(node.type)) parts.push('\n')
	}
	walk(doc)
	return parts.join('').replace(/\n+/g, '\n').trim()
}
