// The shapes the Obelism Content delivery API answers with
// (https://content.obelism.studio/docs/api/delivery). Field values are typed
// loosely by default; pass your own field types as generics, e.g.
// `Entry<{ title: string; body: Block[] }>`.

export type Environment = 'develop' | 'staging' | 'production'

export type RichTextFormat = 'json' | 'html'

// An uploaded file, inlined wherever a field (or a rich text embed) points at
// it. `title` and `alt` are localized: a string for one locale, or
// `{ [locale]: string }` when fetched with locale `*`.
export type Asset = {
	id: string
	url: string
	filename: string
	mimeType: string
	size: number
	width: number | null
	height: number | null
	title: string | Record<string, string> | null
	alt: string | Record<string, string> | null
}

// A page or data entry. Every field of its content type is present in
// `fields`; empty ones are `null`.
export type Entry<
	TFields extends Record<string, unknown> = Record<string, unknown>,
	TContentType extends string = string,
> = {
	id: string
	contentType: TContentType
	name: string
	// Only page entries have a slug and path.
	slug: string | null
	path: string | null
	publishedAt: string | null
	firstPublishedAt: string | null
	updatedAt: string
	fields: TFields
}

// A reference past the requested `depth`: only enough to fetch it later.
export type EntryStub<TContentType extends string = string> = {
	id: string
	contentType: TContentType
}

// One item of a blocks field. `_uid` is stable and unique within the entry:
// put it on the block's element (see `editable`) so the visual editor can
// select it.
export type Block<
	TFields extends Record<string, unknown> = Record<string, unknown>,
	TType extends string = string,
> = {
	_uid: string
	_type: TType
} & TFields

// The built-in A/B test or feature flag block, which any blocks field can
// hold: one list of blocks per option of an improve test or flag, by slug.
// Ask improve's SDK for the visitor's option (getTestValue(slug) for a test,
// getFlagValue(slug) for a flag) and render that variant; pickImproveVariant
// does the lookup.
export type ImproveBlock<TBlock extends Block = Block> = Block<
	{
		kind: 'test' | 'flag'
		slug: string
		variants: Record<string, TBlock[]>
	},
	'_improve'
>

export type RichTextMark = {
	type: 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link' | string
	attrs?: Record<string, unknown>
}

// A ProseMirror-style rich text document (TipTap's node and mark names).
// Embedded entries and assets carry the resolved `attrs.entry` / `attrs.asset`.
export type RichTextNode = {
	type: string
	attrs?: Record<string, unknown>
	content?: RichTextNode[]
	text?: string
	marks?: RichTextMark[]
}

export type RichTextDocument = RichTextNode & { type: 'doc' }

export type EntryList<TEntry extends Entry = Entry> = {
	items: TEntry[]
	total: number
	limit: number
	skip: number
}

// The content model, as `GET /api/delivery/v1/content-model` answers it and
// as `content model pull` writes it.

export type ContentTypeKind = 'page' | 'data' | 'block'

type BaseField = {
	apiId: string
	name: string
	description?: string
	required?: boolean
	localized?: boolean
}

export type FieldDefinition = BaseField &
	(
		| { type: 'text'; minLength?: number; maxLength?: number; pattern?: string }
		| { type: 'textarea'; minLength?: number; maxLength?: number }
		| { type: 'richtext' }
		| { type: 'number'; integer?: boolean; min?: number; max?: number }
		| { type: 'boolean' }
		| { type: 'datetime'; withTime?: boolean }
		| {
				type: 'select'
				multiple?: boolean
				options: { value: string; label: string }[]
		  }
		| { type: 'asset'; multiple?: boolean; mimeTypes?: string[] }
		| { type: 'reference'; multiple?: boolean; contentTypes?: string[] }
		| {
				type: 'blocks'
				allowedBlocks?: string[]
				min?: number
				max?: number
		  }
		| { type: 'json' }
	)

export type FieldType = FieldDefinition['type']

export type ContentTypeDefinition = {
	apiId: string
	name: string
	kind: ContentTypeKind
	description?: string | null
	fields: FieldDefinition[]
}

export type ModelFile = {
	$schema?: string
	version: 1
	contentTypes: ContentTypeDefinition[]
}
