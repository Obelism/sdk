import {
	type Component,
	defineComponent,
	h,
	type PropType,
	type VNodeChild,
} from 'vue'

import {
	type Asset,
	type Entry,
	type EntryStub,
	headingLevel,
	type RichTextMark,
	type RichTextNode,
	SAFE_HREF,
} from '@obelism/content'

// Overrides are components. Rendered children arrive in the default slot:
//
//   const Heading: FunctionalComponent<RichTextNodeProps> = (_, { slots }) =>
//     h('h2', { class: 'title' }, slots.default?.())
export type RichTextNodeProps = { node: RichTextNode }
export type RichTextMarkProps = { mark: RichTextMark }
export type RichTextEmbeddedEntryProps = {
	entry: Entry | EntryStub
	node: RichTextNode
}
export type RichTextEmbeddedAssetProps = { asset: Asset; node: RichTextNode }

export type RichTextComponents = {
	// Override how a node type renders (`paragraph`, `heading`, `bulletList`,
	// `codeBlock`, …).
	nodes?: Partial<Record<string, Component<RichTextNodeProps>>> | undefined
	// Override how a mark renders (`bold`, `italic`, `link`, …).
	marks?: Partial<Record<string, Component<RichTextMarkProps>>> | undefined
	// An embedded entry: nothing unless given. `entry` is a stub
	// (`{ id, contentType }`) when it lies past the requested depth.
	embeddedEntry?: Component<RichTextEmbeddedEntryProps> | undefined
	// An embedded asset. Default: an image in a <figure>, or a link.
	embeddedAsset?: Component<RichTextEmbeddedAssetProps> | undefined
}

export type RichTextProps = RichTextComponents & {
	// A rich text field's value as the delivery API answers it by default
	// (`richText: 'json'`).
	document: RichTextNode | null | undefined
}

const defaultAsset = (asset: Asset): VNodeChild => {
	if (asset.mimeType.startsWith('image/')) {
		return h('figure', [
			h('img', {
				src: asset.url,
				alt: typeof asset.alt === 'string' ? asset.alt : '',
				width: asset.width ?? undefined,
				height: asset.height ?? undefined,
			}),
		])
	}
	return h('p', [h('a', { href: asset.url }, asset.filename)])
}

const renderMark = (
	mark: RichTextMark,
	children: VNodeChild,
	marks: RichTextComponents['marks'],
): VNodeChild => {
	const Custom = marks?.[mark.type]
	if (Custom) return h(Custom, { mark }, { default: () => children })
	switch (mark.type) {
		case 'bold':
			return h('strong', [children])
		case 'italic':
			return h('em', [children])
		case 'underline':
			return h('u', [children])
		case 'strike':
			return h('s', [children])
		case 'code':
			return h('code', [children])
		case 'link': {
			const href = String(mark.attrs?.href ?? '')
			if (!SAFE_HREF.test(href)) return children
			const blank = mark.attrs?.target === '_blank'
			return h(
				'a',
				{
					href,
					title: mark.attrs?.title ? String(mark.attrs.title) : undefined,
					target: blank ? '_blank' : undefined,
					rel: blank ? 'noopener noreferrer' : undefined,
				},
				[children],
			)
		}
		default:
			return children
	}
}

// Renders a rich text document as Vue elements: no HTML strings, links
// limited to safe schemes, and every node, mark and embed overridable.
//
//   <RichText
//     :document="entry.fields.body"
//     :embedded-entry="Card"
//     :nodes="{ heading: Heading }"
//   />
export const RichText = defineComponent({
	name: 'RichText',
	props: {
		document: {
			type: Object as PropType<RichTextNode | null | undefined>,
			default: null,
		},
		nodes: {
			type: Object as PropType<RichTextComponents['nodes']>,
			default: undefined,
		},
		marks: {
			type: Object as PropType<RichTextComponents['marks']>,
			default: undefined,
		},
		embeddedEntry: {
			type: [Object, Function] as PropType<RichTextComponents['embeddedEntry']>,
			default: undefined,
		},
		embeddedAsset: {
			type: [Object, Function] as PropType<RichTextComponents['embeddedAsset']>,
			default: undefined,
		},
	},
	setup(props) {
		const render = (node: RichTextNode): VNodeChild => {
			if (node.type === 'text') {
				return (node.marks ?? []).reduceRight<VNodeChild>(
					(inner, mark) => renderMark(mark, inner, props.marks),
					node.text ?? '',
				)
			}

			const children =
				node.content && node.content.length > 0
					? node.content.map(render).filter((child) => child != null)
					: undefined

			const Custom = props.nodes?.[node.type]
			if (Custom) {
				return h(
					Custom,
					{ node },
					children ? { default: () => children } : undefined,
				)
			}

			switch (node.type) {
				case 'doc':
					return children ?? null
				case 'paragraph':
					return h('p', children)
				case 'heading':
					return h(`h${headingLevel(node)}`, children)
				case 'blockquote':
					return h('blockquote', children)
				case 'bulletList':
					return h('ul', children)
				case 'orderedList': {
					const start = Number(node.attrs?.start ?? 1)
					return h('ol', { start: start !== 1 ? start : undefined }, children)
				}
				case 'listItem':
					return h('li', children)
				case 'codeBlock': {
					const language = node.attrs?.language
					return h('pre', [
						h(
							'code',
							{
								class: language ? `language-${String(language)}` : undefined,
							},
							children,
						),
					])
				}
				case 'hardBreak':
					return h('br')
				case 'horizontalRule':
					return h('hr')
				case 'embeddedEntry': {
					const entry = node.attrs?.entry as Entry | EntryStub | undefined
					if (!entry || !props.embeddedEntry) return null
					return h(props.embeddedEntry, { entry, node })
				}
				case 'embeddedAsset': {
					const asset = node.attrs?.asset as Asset | undefined
					if (!asset) return null
					return props.embeddedAsset
						? h(props.embeddedAsset, { asset, node })
						: defaultAsset(asset)
				}
				default:
					return null
			}
		}

		return () => (props.document ? render(props.document) : null)
	},
})
