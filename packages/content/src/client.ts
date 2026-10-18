import {
	DEFAULT_TIMEOUT,
	DEFAULT_URL,
	DELIVERY_PATH,
	normalizeUrl,
} from './config'
import { ContentApiError } from './errors'
import type {
	Entry,
	EntryList,
	ModelFile,
	Redirect,
	RedirectList,
	RichTextFormat,
} from './types'

export type ContentClientOptions = {
	// A delivery token (`cms_d_…`, published content) or preview token
	// (`cms_p_…`, drafts too). Keep preview tokens server-side.
	token: string
	// The CMS. Default: https://content.obelism.studio
	url?: string | undefined
	// Defaults for every request; each can be overridden per call.
	locale?: string | undefined
	depth?: number | undefined
	richText?: RichTextFormat | undefined
	// Milliseconds before a request is aborted. Default: 10000.
	timeout?: number | undefined
	// Passed to every fetch, e.g. `{ next: { revalidate: 60 } }` in Next.js.
	init?: RequestInit | undefined
	// A fetch implementation, for runtimes or tests that need their own.
	fetch?: typeof fetch | undefined
}

export type RequestOptions = {
	// A locale code, `*` for every locale (localized fields become
	// `{ [locale]: value }`), or the space's default when left out.
	locale?: string | undefined
	// Levels of references to inline, 0–5 (the API's default is 1).
	depth?: number | undefined
	// Rich text as ProseMirror JSON (default) or rendered HTML strings.
	richText?: RichTextFormat | undefined
	// Merged over the client's `init` for this request.
	init?: RequestInit | undefined
}

export type FieldFilterValue = string | number | boolean

export type EntriesQuery = RequestOptions & {
	contentType?: string | undefined
	// Only direct children of the entry at this path; '' for the root.
	parentPath?: string | undefined
	// Filters on `contentType`'s fields, keyed by apiId with an optional
	// operator: `{ category: 'news', 'rating[gte]': 4, tags: ['a', 'b'] }`.
	// A list means one of them (`[in]`). Operators: ne, in, gt, gte, lt, lte,
	// exists (https://content.obelism.studio/docs/api/delivery).
	fields?:
		Record<string, FieldFilterValue | readonly FieldFilterValue[]> | undefined
	// `publishedAt`, `firstPublishedAt`, `updatedAt`, `name`, `path` or
	// `fields.<apiId>`, `-` first for descending. Default: the tree's order.
	order?: string | undefined
	// 1–100, the API's default is 20.
	limit?: number | undefined
	skip?: number | undefined
}

// `fields` as the API's `fields.<apiId>[op]` parameters.
const fieldParams = (fields: EntriesQuery['fields']) =>
	Object.fromEntries(
		Object.entries(fields ?? {}).map(([key, value]) => {
			if (!Array.isArray(value)) return [`fields.${key}`, String(value)]
			const name = key.includes('[') ? key : `${key}[in]`
			return [`fields.${name}`, value.join(',')]
		}),
	)

export type RedirectsQuery = {
	// Only this locale's redirects; every locale's when left out.
	locale?: string | undefined
	// 1–1000, the API's default is 1000.
	limit?: number | undefined
	skip?: number | undefined
	init?: RequestInit | undefined
}

// What is at a path: the page, or where a page that moved from it is now.
export type PageLookup<TEntry extends Entry = Entry> =
	| { entry: TEntry; redirect?: undefined }
	| { entry?: undefined; redirect: { path: string } }

const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, '')

// Reads one space environment's content through the delivery API. The token
// decides the space, the environment and whether drafts are visible.
//
//   const content = new ContentClient({ token: process.env.CONTENT_TOKEN })
//   const page = await content.getPage('blog/hello', { locale: 'nl' })
export class ContentClient {
	readonly url: string
	#token: string
	#defaults: Pick<RequestOptions, 'locale' | 'depth' | 'richText'>
	#timeout: number
	#init: RequestInit | undefined
	#fetch: typeof fetch

	constructor({
		token,
		url,
		locale,
		depth,
		richText,
		timeout,
		init,
		fetch: fetchImpl,
	}: ContentClientOptions) {
		this.url = normalizeUrl(url || DEFAULT_URL)
		this.#token = token
		this.#defaults = { locale, depth, richText }
		this.#timeout = timeout ?? DEFAULT_TIMEOUT
		this.#init = init
		this.#fetch = fetchImpl ?? ((...args) => fetch(...args))
	}

	// The page at a path (`blog/hello`), or null when there is none. A site's
	// catch-all route asks for this. The path is looked up in `locale`'s
	// paths (the default locale's when left out or `*`): pages can have a
	// slug per locale.
	getPage = async <TEntry extends Entry = Entry>(
		path: string,
		options: RequestOptions = {},
	): Promise<TEntry | null> =>
		(await this.findPage<TEntry>(path, options))?.entry ?? null

	// Like getPage, but a path a page moved away from answers where it is
	// now, so the site can send a 301 there instead of a 404.
	//
	//   const found = await content.findPage(path, { locale })
	//   if (found?.redirect) return redirect(`/${locale}/${found.redirect.path}`, 301)
	//   if (!found) return notFound()
	findPage = async <TEntry extends Entry = Entry>(
		path: string,
		options: RequestOptions = {},
	): Promise<PageLookup<TEntry> | null> => {
		const trimmed = trimSlashes(path)
		if (!trimmed) throw new Error('getPage needs a path')
		const result = await this.#request<
			{ entry: TEntry } | { redirect?: { path?: unknown } }
		>('/pages', { path: trimmed }, options, { notFound: 'body' })
		if (result && 'entry' in result) return { entry: result.entry }
		const to = result?.redirect?.path
		return typeof to === 'string' ? { redirect: { path: to } } : null
	}

	// One page of redirects: every path a page moved away from, per locale,
	// with where it is now. For redirect rules built ahead of time.
	getRedirects = ({
		locale,
		limit,
		skip,
		init,
	}: RedirectsQuery = {}): Promise<RedirectList> =>
		this.#request<RedirectList>(
			'/redirects',
			{ limit, skip },
			{ locale, init },
			{ defaults: false },
		) as Promise<RedirectList>

	// Every redirect, fetching pages of `limit` (default 1000) as it goes.
	async *getAllRedirects(
		query: Omit<RedirectsQuery, 'skip'> = {},
	): AsyncGenerator<Redirect, void, undefined> {
		const limit = query.limit ?? 1000
		let skip = 0
		while (true) {
			const page = await this.getRedirects({ ...query, limit, skip })
			yield* page.items
			skip += page.items.length
			if (page.items.length === 0 || skip >= page.total) return
		}
	}

	// An entry by id, or null when there is none (or it isn't published, for a
	// delivery token).
	getEntry = async <TEntry extends Entry = Entry>(
		id: string,
		options: RequestOptions = {},
	): Promise<TEntry | null> => {
		const result = await this.#request<{ entry: TEntry }>(
			`/entries/${encodeURIComponent(id)}`,
			{},
			options,
			{ notFound: true },
		)
		return result?.entry ?? null
	}

	// One page of entries, ordered as in the space's tree.
	getEntries = <TEntry extends Entry = Entry>({
		contentType,
		parentPath,
		fields,
		order,
		limit,
		skip,
		...options
	}: EntriesQuery = {}): Promise<EntryList<TEntry>> =>
		this.#request<EntryList<TEntry>>(
			'/entries',
			{
				contentType,
				parentPath:
					parentPath === undefined ? undefined : trimSlashes(parentPath),
				...fieldParams(fields),
				order,
				limit,
				skip,
			},
			options,
		) as Promise<EntryList<TEntry>>

	// The first entry matching the query, or null: a settings entry, or a
	// navigation by its key, without its id.
	//
	//   await content.getFirstEntry({ contentType: 'navigation', fields: { key: 'main' } })
	getFirstEntry = async <TEntry extends Entry = Entry>(
		query: Omit<EntriesQuery, 'limit' | 'skip'> = {},
	): Promise<TEntry | null> =>
		(await this.getEntries<TEntry>({ ...query, limit: 1 })).items[0] ?? null

	// Every entry matching the query, fetching pages of `limit` (default 100)
	// as it goes.
	//
	//   for await (const post of content.getAllEntries({ contentType: 'post' }))
	async *getAllEntries<TEntry extends Entry = Entry>(
		query: Omit<EntriesQuery, 'skip'> = {},
	): AsyncGenerator<TEntry, void, undefined> {
		const limit = query.limit ?? 100
		let skip = 0
		while (true) {
			const page = await this.getEntries<TEntry>({ ...query, limit, skip })
			yield* page.items
			skip += page.items.length
			if (page.items.length === 0 || skip >= page.total) return
		}
	}

	// The environment's content model, e.g. to generate types in a build.
	getContentModel = (options: Pick<RequestOptions, 'init'> = {}) =>
		this.#request<ModelFile>('/content-model', {}, options, {
			defaults: false,
		}) as Promise<ModelFile>

	// For a 404, null when `notFound` is set, or the body as is for 'body';
	// throws ContentApiError otherwise.
	async #request<T>(
		path: string,
		query: Record<string, string | number | undefined>,
		{ init, ...options }: RequestOptions,
		{
			notFound = false,
			defaults = true,
		}: { notFound?: boolean | 'body'; defaults?: boolean } = {},
	): Promise<T | null> {
		// Checked here rather than in the constructor, so a module creating a
		// client still loads (and a build still runs) without the variable.
		if (!this.#token) throw new Error('ContentClient needs a token')
		const { locale, depth, richText } = {
			...(defaults && this.#defaults),
			...withoutUndefined(options),
		}
		const params = new URLSearchParams()
		const values = { ...query, locale, depth, richtext: richText }
		for (const [key, value] of Object.entries(values)) {
			if (value !== undefined) params.set(key, String(value))
		}
		const search = params.size > 0 ? `?${params}` : ''
		const url = `${this.url}${DELIVERY_PATH}${path}${search}`

		const merged = { ...this.#init, ...init }
		const timeout = AbortSignal.timeout(this.#timeout)
		const response = await this.#fetch(url, {
			...merged,
			headers: {
				...headersToObject(merged.headers),
				Accept: 'application/json',
				// Not `Authorization`: Cloudflare never caches a request that
				// carries it, and this header lets the API answer a delivery
				// token from its edge cache.
				'Obelism-Token': this.#token,
			},
			signal: merged.signal
				? AbortSignal.any([merged.signal, timeout])
				: timeout,
		})

		if (notFound === true && response.status === 404) return null

		const text = await response.text()
		let body: unknown = text
		try {
			body = JSON.parse(text)
		} catch {
			// Not JSON: keep the text for the error.
		}
		if (notFound === 'body' && response.status === 404) {
			return typeof body === 'object' && body !== null ? (body as T) : null
		}
		if (!response.ok) throw new ContentApiError(response.status, url, body)
		return body as T
	}
}

const withoutUndefined = <T extends Record<string, unknown>>(value: T) =>
	Object.fromEntries(
		Object.entries(value).filter(([, entry]) => entry !== undefined),
	) as Partial<T>

const headersToObject = (headers: HeadersInit | undefined) =>
	headers ? Object.fromEntries(new Headers(headers)) : {}
