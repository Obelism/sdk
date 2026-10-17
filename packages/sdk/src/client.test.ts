import { describe, expect, it, vi } from 'vitest'

import { ContentClient } from './client'
import { ContentApiError } from './errors'

const entry = {
	id: 'entry_1',
	contentType: 'page',
	name: 'Hello',
	slug: 'hello',
	path: 'blog/hello',
	publishedAt: null,
	firstPublishedAt: null,
	updatedAt: '2026-10-12T19:35:12.419Z',
	fields: { title: 'Hello' },
}

const respond = (body: unknown, status = 200) =>
	vi.fn<typeof fetch>(
		async () =>
			new Response(typeof body === 'string' ? body : JSON.stringify(body), {
				status,
			}),
	)

const requested = (fetchMock: ReturnType<typeof respond>, call = 0) => {
	const [url, init] = fetchMock.mock.calls[call]!
	return { url: new URL(String(url)), init: init! }
}

describe('ContentClient', () => {
	it('asks for a page by path, with the token and the defaults', async () => {
		const fetchMock = respond({ entry })
		const content = new ContentClient({
			token: 'cms_d_x',
			locale: 'nl',
			depth: 2,
			fetch: fetchMock,
		})

		await expect(content.getPage('/blog/hello/')).resolves.toEqual(entry)

		const { url, init } = requested(fetchMock)
		expect(url.origin).toBe('https://content.obelism.studio')
		expect(url.pathname).toBe('/api/delivery/v1/pages')
		expect(Object.fromEntries(url.searchParams)).toEqual({
			path: 'blog/hello',
			locale: 'nl',
			depth: '2',
		})
		expect((init.headers as Record<string, string>).Authorization).toBe(
			'Bearer cms_d_x',
		)
	})

	it('lets a call override the defaults and add fetch options', async () => {
		const fetchMock = respond({ entry })
		const content = new ContentClient({
			token: 't',
			url: 'https://cms.example.com/some/path/',
			locale: 'nl',
			init: { cache: 'no-store', headers: { 'X-Site': 'a' } },
			fetch: fetchMock,
		})

		await content.getEntry('entry 1', {
			locale: '*',
			richText: 'html',
			init: { headers: { 'X-Extra': 'b' } },
		})

		const { url, init } = requested(fetchMock)
		expect(url.origin + url.pathname).toBe(
			'https://cms.example.com/api/delivery/v1/entries/entry%201',
		)
		expect(Object.fromEntries(url.searchParams)).toEqual({
			locale: '*',
			richtext: 'html',
		})
		expect(init.cache).toBe('no-store')
		expect(init.headers).toMatchObject({ 'x-extra': 'b' })
	})

	it('answers null for a page or entry that is not there', async () => {
		const content = new ContentClient({
			token: 't',
			fetch: respond({ error: 'Entry not found' }, 404),
		})
		await expect(content.getPage('nope')).resolves.toBeNull()
		await expect(content.getEntry('nope')).resolves.toBeNull()
	})

	it('throws the API error for anything else', async () => {
		const content = new ContentClient({
			token: 't',
			fetch: respond({ error: 'Invalid or revoked token' }, 401),
		})
		const error = await content.getPage('home').catch((caught) => caught)
		expect(error).toBeInstanceOf(ContentApiError)
		expect(error).toMatchObject({
			status: 401,
			message: 'Invalid or revoked token',
		})
	})

	it('keeps a non-JSON error body', async () => {
		const content = new ContentClient({
			token: 't',
			fetch: respond('Bad gateway', 502),
		})
		await expect(content.getEntries()).rejects.toMatchObject({
			status: 502,
			body: 'Bad gateway',
		})
	})

	it('lists entries with a query', async () => {
		const fetchMock = respond({ items: [entry], total: 1, limit: 10, skip: 0 })
		const content = new ContentClient({ token: 't', fetch: fetchMock })

		const list = await content.getEntries({
			contentType: 'page',
			parentPath: '/blog/',
			limit: 10,
		})

		expect(list.items).toEqual([entry])
		expect(Object.fromEntries(requested(fetchMock).url.searchParams)).toEqual({
			contentType: 'page',
			parentPath: 'blog',
			limit: '10',
		})
	})

	it('sends field filters and the order', async () => {
		const fetchMock = respond({ items: [], total: 0, limit: 20, skip: 0 })
		await new ContentClient({ token: 't', fetch: fetchMock }).getEntries({
			contentType: 'post',
			fields: {
				category: 'news',
				'rating[gte]': 4,
				featured: true,
				tags: ['a', 'b'],
				'author[ne]': 'entry_1',
			},
			order: '-fields.date',
		})
		expect(
			Object.fromEntries(requested(fetchMock).url.searchParams),
		).toMatchObject({
			contentType: 'post',
			'fields.category': 'news',
			'fields.rating[gte]': '4',
			'fields.featured': 'true',
			'fields.tags[in]': 'a,b',
			'fields.author[ne]': 'entry_1',
			order: '-fields.date',
		})
	})

	it('finds the first entry of a query, or null', async () => {
		const found = respond({ items: [entry], total: 3, limit: 1, skip: 0 })
		await expect(
			new ContentClient({ token: 't', fetch: found }).getFirstEntry({
				contentType: 'navigation',
				fields: { key: 'main' },
			}),
		).resolves.toEqual(entry)
		expect(requested(found).url.searchParams.get('limit')).toBe('1')

		const none = respond({ items: [], total: 0, limit: 1, skip: 0 })
		await expect(
			new ContentClient({ token: 't', fetch: none }).getFirstEntry(),
		).resolves.toBeNull()
	})

	it('asks for the root with an empty parentPath', async () => {
		const fetchMock = respond({ items: [], total: 0, limit: 20, skip: 0 })
		await new ContentClient({ token: 't', fetch: fetchMock }).getEntries({
			parentPath: '',
		})
		expect(requested(fetchMock).url.searchParams.get('parentPath')).toBe('')
	})

	it('pages through every entry', async () => {
		const items = Array.from({ length: 5 }, (_, index) => ({
			...entry,
			id: `entry_${index}`,
		}))
		const fetchMock = vi.fn<typeof fetch>(async (input) => {
			const params = new URL(String(input)).searchParams
			const skip = Number(params.get('skip'))
			const limit = Number(params.get('limit'))
			return Response.json({
				items: items.slice(skip, skip + limit),
				total: items.length,
				limit,
				skip,
			})
		})
		const content = new ContentClient({ token: 't', fetch: fetchMock })

		const ids = []
		for await (const item of content.getAllEntries({ limit: 2 })) {
			ids.push(item.id)
		}

		expect(ids).toEqual(items.map((item) => item.id))
		expect(fetchMock).toHaveBeenCalledTimes(3)
	})

	it('fetches the content model without content defaults', async () => {
		const fetchMock = respond({ version: 1, contentTypes: [] })
		const content = new ContentClient({
			token: 't',
			locale: 'nl',
			fetch: fetchMock,
		})
		await expect(content.getContentModel()).resolves.toEqual({
			version: 1,
			contentTypes: [],
		})
		expect(requested(fetchMock).url.search).toBe('')
	})

	it('aborts a request that takes too long', async () => {
		const fetchMock = vi.fn<typeof fetch>(
			(_, init) =>
				new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () =>
						reject(init.signal!.reason),
					)
				}),
		)
		const content = new ContentClient({
			token: 't',
			timeout: 10,
			fetch: fetchMock,
		})
		await expect(content.getPage('home')).rejects.toMatchObject({
			name: 'TimeoutError',
		})
	})

	it('needs a token and a path', async () => {
		await expect(
			new ContentClient({ token: '', fetch: respond({}) }).getEntries(),
		).rejects.toThrow('needs a token')
		const content = new ContentClient({ token: 't', fetch: respond({}) })
		await expect(content.getPage('/')).rejects.toThrow('needs a path')
	})
})
