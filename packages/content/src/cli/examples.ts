import type {
	Asset,
	ContentTypeDefinition,
	FieldDefinition,
	ModelFile,
	RichTextDocument,
} from '../types'

// What `content init` writes to content/examples/: for every content type,
// a made-up example of what the delivery API answers for it, so a site's
// components (and the agents writing them) can be built before there is
// content. Generated from the model, so it covers every field and every
// type, also ones without entries. Pure.
//
// The shape is delivery's with its defaults: one locale (a localized field
// is just its value), rich text as a document, assets inlined and
// references as stubs.

// The tests and flags the improve block can name (GET
// /api/management/v1/improve), while the organization has improve on.
export type ImproveSource = {
	kind: 'test' | 'flag'
	slug: string
	name: string
	options: { slug: string; name: string }[]
}

export type ImproveStatus = { enabled: boolean; sources: ImproveSource[] }

// Blocks inside blocks stop here, so a type that allows itself ends.
const MAX_DEPTH = 3

const EXAMPLE_DATE = '2026-01-01'
const EXAMPLE_DATE_TIME = '2026-01-01T09:00:00.000Z'

// An image unless the field only takes other files; then its first exact
// type, or a PDF.
const exampleAsset = (mimeTypes: string[] | undefined): Asset => {
	const image =
		!mimeTypes || mimeTypes.some((type) => type.startsWith('image/'))
	const exact = mimeTypes?.find((type) => /^[a-z]+\/[^*]+$/.test(type))
	const mimeType = image ? 'image/jpeg' : (exact ?? 'application/pdf')
	const filename = image
		? 'example.jpg'
		: `example.${mimeType.split('/')[1]?.split('+')[0] ?? 'bin'}`
	return {
		id: 'asset_example',
		url: `https://content.obelism.studio/files/asset_example/${filename}`,
		filename,
		mimeType,
		size: 120_000,
		width: image ? 1600 : null,
		height: image ? 900 : null,
		title: null,
		alt: image ? 'An example image' : null,
		focalPoint: null,
	}
}

const exampleRichText = (name: string): RichTextDocument => ({
	type: 'doc',
	content: [
		{
			type: 'paragraph',
			content: [
				{ type: 'text', text: `Example ${name}, with ` },
				{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
				{ type: 'text', text: ' text.' },
			],
		},
	],
})

const truncate = (text: string, maxLength: number | undefined) =>
	maxLength === undefined ? text : text.slice(0, maxLength)

export const buildExamples = (
	model: ModelFile,
	improve: ImproveStatus,
): Record<string, unknown> => {
	const types = model.contentTypes
	const blockTypes = types.filter(({ kind }) => kind === 'block')
	const entryTypes = types.filter(({ kind }) => kind !== 'block')

	// Uids are unique within one example, like within one entry.
	let next = 0
	const uid = () => `example${++next}`

	const allowedBlocks = (allowed: string[] | undefined) =>
		allowed
			? blockTypes.filter(({ apiId }) => allowed.includes(apiId))
			: blockTypes

	const improveBlock = (allowed: string[] | undefined, depth: number) => {
		const source: ImproveSource = improve.sources[0] ?? {
			kind: 'test',
			slug: 'example-test',
			name: 'Example test',
			options: [
				{ slug: 'control', name: 'Control' },
				{ slug: 'variation', name: 'Variation' },
			],
		}
		const first = allowedBlocks(allowed)[0]
		return {
			_uid: uid(),
			_type: '_improve',
			kind: source.kind,
			slug: source.slug,
			variants: Object.fromEntries(
				source.options.map((option) => [
					option.slug,
					first && depth < MAX_DEPTH ? [block(first, depth + 1)] : [],
				]),
			),
		}
	}

	const value = (field: FieldDefinition, depth: number): unknown => {
		const name = field.name.toLowerCase()
		switch (field.type) {
			case 'text':
				return truncate(`Example ${name}`, field.maxLength)
			case 'textarea':
				return truncate(
					`Example ${name}. A sentence or two of plain text.`,
					field.maxLength,
				)
			case 'richtext':
				return exampleRichText(name)
			case 'number':
				return field.min ?? (field.integer ? 1 : 1.5)
			case 'boolean':
				return true
			case 'datetime':
				return field.withTime ? EXAMPLE_DATE_TIME : EXAMPLE_DATE
			case 'select': {
				const first = field.options[0]?.value ?? null
				return field.multiple ? (first ? [first] : []) : first
			}
			case 'asset': {
				const asset = exampleAsset(field.mimeTypes)
				return field.multiple ? [asset] : asset
			}
			case 'reference': {
				const target = field.contentTypes?.[0] ?? entryTypes[0]?.apiId ?? 'page'
				const stub = { id: 'entry_example', contentType: target }
				return field.multiple ? [stub] : stub
			}
			case 'blocks': {
				if (depth >= MAX_DEPTH) return []
				const allowed = allowedBlocks(field.allowedBlocks)
				// At the top, one of every block the field allows (and the
				// improve block); deeper, only the first.
				const blocks =
					depth === 0
						? allowed.map((type) => block(type, depth + 1))
						: allowed.slice(0, 1).map((type) => block(type, depth + 1))
				return depth === 0 && improve.enabled
					? [...blocks, improveBlock(field.allowedBlocks, depth + 1)]
					: blocks
			}
			case 'link':
				return {
					type: 'entry',
					entry: {
						id: 'entry_example',
						title: 'Example page',
						slug: 'example',
						path: 'example',
					},
					query: null,
					hash: null,
				}
			case 'shopify': {
				const item =
					field.resource === 'collection'
						? { id: 'gid://shopify/Collection/1', handle: 'example-collection' }
						: { id: 'gid://shopify/Product/1', handle: 'example-product' }
				return field.multiple ? [item] : item
			}
			case 'json':
				return {}
		}
	}

	const fields = (type: ContentTypeDefinition, depth: number) =>
		Object.fromEntries(
			type.fields.map((field) => [field.apiId, value(field, depth)]),
		)

	const block = (type: ContentTypeDefinition, depth: number) => ({
		_uid: uid(),
		_type: type.apiId,
		...fields(type, depth),
	})

	const examples: Record<string, unknown> = {}
	for (const type of types) {
		next = 0
		if (type.kind === 'block') {
			examples[type.apiId] = block(type, 0)
			continue
		}
		const slug = type.kind === 'page' ? 'example' : null
		examples[type.apiId] = {
			id: 'entry_example',
			contentType: type.apiId,
			name: `Example ${type.name.toLowerCase()}`,
			slug,
			path: slug,
			publishedAt: EXAMPLE_DATE_TIME,
			firstPublishedAt: EXAMPLE_DATE_TIME,
			updatedAt: EXAMPLE_DATE_TIME,
			fields: fields(type, 0),
		}
	}
	if (improve.enabled) {
		next = 0
		examples._improve = improveBlock(undefined, 0)
	}
	return examples
}
