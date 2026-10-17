import { Fragment, type ReactNode } from 'react'

import {
	type Asset,
	type Entry,
	type EntryStub,
	headingLevel,
	type RichTextMark,
	type RichTextNode,
	SAFE_HREF,
} from '@obelism/content'

export type RichTextNodeProps = {
	node: RichTextNode
	children?: ReactNode
}

export type RichTextMarkProps = {
	mark: RichTextMark
	children?: ReactNode
}

export type RichTextComponents = {
	// Override how a node type renders (`paragraph`, `heading`, `bulletList`,
	// `codeBlock`, …). Children are already rendered.
	nodes?: Partial<Record<string, (props: RichTextNodeProps) => ReactNode>>
	// Override how a mark renders (`bold`, `italic`, `link`, …).
	marks?: Partial<Record<string, (props: RichTextMarkProps) => ReactNode>>
	// An embedded entry: nothing unless given. `entry` is a stub
	// (`{ id, contentType }`) when it lies past the requested depth.
	embeddedEntry?: (props: {
		entry: Entry | EntryStub
		node: RichTextNode
	}) => ReactNode
	// An embedded asset. Default: an image in a <figure>, or a link.
	embeddedAsset?: (props: { asset: Asset; node: RichTextNode }) => ReactNode
}

export type RichTextProps = RichTextComponents & {
	// A rich text field's value as the delivery API answers it by default
	// (`richText: 'json'`).
	document: RichTextNode | null | undefined
}

const DefaultAsset = ({ asset }: { asset: Asset }) => {
	if (asset.mimeType.startsWith('image/')) {
		return (
			<figure>
				<img
					src={asset.url}
					alt={typeof asset.alt === 'string' ? asset.alt : ''}
					width={asset.width ?? undefined}
					height={asset.height ?? undefined}
				/>
			</figure>
		)
	}
	return (
		<p>
			<a href={asset.url}>{asset.filename}</a>
		</p>
	)
}

const renderMark = (
	mark: RichTextMark,
	children: ReactNode,
	marks: RichTextComponents['marks'],
): ReactNode => {
	const Custom = marks?.[mark.type]
	if (Custom) return <Custom mark={mark}>{children}</Custom>
	switch (mark.type) {
		case 'bold':
			return <strong>{children}</strong>
		case 'italic':
			return <em>{children}</em>
		case 'underline':
			return <u>{children}</u>
		case 'strike':
			return <s>{children}</s>
		case 'code':
			return <code>{children}</code>
		case 'link': {
			const href = String(mark.attrs?.href ?? '')
			if (!SAFE_HREF.test(href)) return children
			const blank = mark.attrs?.target === '_blank'
			return (
				<a
					href={href}
					title={mark.attrs?.title ? String(mark.attrs.title) : undefined}
					target={blank ? '_blank' : undefined}
					rel={blank ? 'noopener noreferrer' : undefined}
				>
					{children}
				</a>
			)
		}
		default:
			return children
	}
}

// Renders a rich text document as React elements: no HTML strings, links
// limited to safe schemes, and every node, mark and embed overridable.
//
//   <RichText
//     document={entry.fields.body}
//     embeddedEntry={({ entry }) => <Card entry={entry} />}
//   />
export const RichText = ({
	document,
	nodes,
	marks,
	embeddedEntry,
	embeddedAsset: EmbeddedAsset = DefaultAsset,
}: RichTextProps) => {
	if (!document) return null

	const render = (node: RichTextNode, key: number | string): ReactNode => {
		if (node.type === 'text') {
			const text = node.text ?? ''
			return (
				<Fragment key={key}>
					{(node.marks ?? []).reduceRight<ReactNode>(
						(inner, mark) => renderMark(mark, inner, marks),
						text,
					)}
				</Fragment>
			)
		}

		const children =
			node.content && node.content.length > 0
				? node.content.map((child, index) => render(child, index))
				: undefined

		const Custom = nodes?.[node.type]
		if (Custom) {
			return (
				<Custom key={key} node={node}>
					{children}
				</Custom>
			)
		}

		switch (node.type) {
			case 'doc':
				return <Fragment key={key}>{children}</Fragment>
			case 'paragraph':
				return <p key={key}>{children}</p>
			case 'heading': {
				const Heading = `h${headingLevel(node)}` as const
				return <Heading key={key}>{children}</Heading>
			}
			case 'blockquote':
				return <blockquote key={key}>{children}</blockquote>
			case 'bulletList':
				return <ul key={key}>{children}</ul>
			case 'orderedList': {
				const start = Number(node.attrs?.start ?? 1)
				return (
					<ol key={key} start={start !== 1 ? start : undefined}>
						{children}
					</ol>
				)
			}
			case 'listItem':
				return <li key={key}>{children}</li>
			case 'codeBlock': {
				const language = node.attrs?.language
				return (
					<pre key={key}>
						<code
							className={language ? `language-${String(language)}` : undefined}
						>
							{children}
						</code>
					</pre>
				)
			}
			case 'hardBreak':
				return <br key={key} />
			case 'horizontalRule':
				return <hr key={key} />
			case 'embeddedEntry': {
				const entry = node.attrs?.entry as Entry | EntryStub | undefined
				if (!entry || !embeddedEntry) return null
				const EmbeddedEntry = embeddedEntry
				return <EmbeddedEntry key={key} entry={entry} node={node} />
			}
			case 'embeddedAsset': {
				const asset = node.attrs?.asset as Asset | undefined
				if (!asset) return null
				return <EmbeddedAsset key={key} asset={asset} node={node} />
			}
			default:
				return null
		}
	}

	return <>{render(document, 'doc')}</>
}
