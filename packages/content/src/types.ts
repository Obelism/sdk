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
	// Where crops should keep the image, fractions from the top left; null
	// when not set. imageUrl passes it on for `cover` and `crop`.
	focalPoint: { x: number; y: number } | null
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
	// Only pages have a slug and path. `slug` is the default locale's;
	// `path` is the path in the requested locale (the default's for `*`).
	slug: string | null
	path: string | null
	// The path in every locale of the space, `{ [locale]: path }`: for
	// hreflang links, language switchers and sitemaps. Empty for data
	// entries. The locale itself is never part of a path; where it goes in
	// your URLs is up to your site.
	paths: Record<string, string>
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

// The page a link field goes to: enough to link to it, never its fields.
// `title` is its `title` field (its name when it has none) and `path` its
// path, both in the requested locale; `title` is `{ [locale]: string }` for
// a localized title fetched with locale `*`.
export type LinkTarget = {
	id: string
	title: string | Record<string, string>
	slug: string | null
	path: string | null
}

// A link field's value: a page of the space, any address (another site,
// `/search`, `#faq`, `mailto:`), or a product of the space's Shopify store
// with its product page (a page whose type has a unique product field) when
// it has one. `query` (`a=1&b=2`) and `hash` (`pricing`) come without their
// `?` and `#`, null when not set. A link to a page the token can't see (not
// published, for a delivery token) is null itself; a link to a product never
// is. There is no ready address: `linkHref` builds one with your site's
// routing.
export type Link =
	| {
			type: 'entry'
			entry: LinkTarget
			query: string | null
			hash: string | null
	  }
	| {
			type: 'url'
			url: string
			query: string | null
			hash: string | null
	  }
	| {
			type: 'product'
			product: ShopifyItem
			entry: LinkTarget | null
			query: string | null
			hash: string | null
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

// A path a page moved away from in a locale, and where it is in that locale
// now.
export type Redirect = {
	locale: string
	from: string
	to: string
}

export type RedirectList = {
	items: Redirect[]
	total: number
	limit: number
	skip: number
}

// The content model, as `GET /api/delivery/v1/content-model` answers it and
// as `content model pull` writes it.

// A collection or product of the space's Shopify store, as a `shopify` field
// holds it: its GID (`gid://shopify/Collection/123`), the same in every
// environment, and the handle it had when picked. Fetch what changes (price,
// stock, images) from Shopify by the id: fetchShopifyCollection and
// fetchShopifyProducts. Link with the handle.
export type ShopifyItem = {
	id: string
	handle: string
}

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
		| {
				type: 'text'
				minLength?: number
				maxLength?: number
				pattern?: string
				// Checked on save; the value stays a string.
				format?: 'url' | 'email' | 'color' | 'slug'
				// No two published entries of the type share a value.
				unique?: boolean
				defaultValue?: string
		  }
		| {
				type: 'textarea'
				minLength?: number
				maxLength?: number
				pattern?: string
				defaultValue?: string
		  }
		| { type: 'richtext' }
		| {
				type: 'number'
				integer?: boolean
				min?: number
				max?: number
				unique?: boolean
				defaultValue?: number
		  }
		| { type: 'boolean'; defaultValue?: boolean }
		| { type: 'datetime'; withTime?: boolean }
		| {
				type: 'select'
				multiple?: boolean
				options: { value: string; label: string }[]
				defaultValue?: string | string[]
		  }
		| {
				type: 'asset'
				multiple?: boolean
				mimeTypes?: string[]
				// How many a `multiple` field holds.
				min?: number
				max?: number
		  }
		| {
				type: 'reference'
				multiple?: boolean
				contentTypes?: string[]
				min?: number
				max?: number
		  }
		| {
				type: 'link'
				// The page types it may go to; any page type when left out.
				contentTypes?: string[]
				// It may also go to a product of the space's Shopify store.
				products?: boolean
		  }
		| {
				type: 'blocks'
				allowedBlocks?: string[]
				min?: number
				max?: number
		  }
		| {
				type: 'shopify'
				resource: 'collection' | 'product'
				multiple?: boolean
				// One product on a page type: makes it a product page type, one
				// published page per product.
				unique?: boolean
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
	// What the type is for. Required in the CMS; null (or missing) from a
	// CMS from before that.
	description: string | null
	fields: FieldDefinition[]
}

export type ModelFile = {
	$schema?: string
	version: 1
	contentTypes: ContentTypeDefinition[]
}
