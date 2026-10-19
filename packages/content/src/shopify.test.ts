import { describe, expect, it, vi } from 'vitest'

import {
	fetchShopifyCollection,
	fetchShopifyProducts,
	ShopifyStorefrontError,
} from './shopify'

const product = {
	id: 'gid://shopify/Product/1',
	handle: 'corrie-shoe',
	title: 'Corrie shoe',
	availableForSale: true,
	featuredImage: null,
	priceRange: { minVariantPrice: { amount: '198.0', currencyCode: 'USD' } },
}

const answering = (data: unknown) =>
	vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
		Response.json({ data }),
	)

const options = (fetch: typeof globalThis.fetch) => ({
	shop: 'acme.myshopify.com',
	storefrontToken: 'sf_1',
	fetch,
})

const sent = (fetch: ReturnType<typeof answering>) => {
	const [url, init] = fetch.mock.calls[0]!
	return {
		url,
		headers: init!.headers as Record<string, string>,
		body: JSON.parse(init!.body as string),
	}
}

describe('fetchShopifyCollection', () => {
	it('fetches the collection’s products with the Storefront token', async () => {
		const fetch = answering({
			collection: {
				id: 'gid://shopify/Collection/1',
				handle: 'featured',
				title: 'Featured products',
				products: { nodes: [product] },
			},
		})
		const collection = await fetchShopifyCollection(
			{ id: 'gid://shopify/Collection/1', handle: 'featured' },
			{ ...options(fetch), first: 5, country: 'nl' },
		)
		expect(collection).toEqual({
			id: 'gid://shopify/Collection/1',
			handle: 'featured',
			title: 'Featured products',
			products: [product],
		})
		const { url, headers, body } = sent(fetch)
		expect(url).toBe('https://acme.myshopify.com/api/2026-10/graphql.json')
		expect(headers['x-shopify-storefront-access-token']).toBe('sf_1')
		expect(body.variables).toEqual({
			id: 'gid://shopify/Collection/1',
			first: 5,
			country: 'NL',
			language: null,
		})
	})

	it('is null for a collection the store no longer has', async () => {
		expect(
			await fetchShopifyCollection(
				{ id: 'gid://shopify/Collection/2', handle: 'gone' },
				options(answering({ collection: null })),
			),
		).toBeNull()
	})

	it('throws on GraphQL errors and refusals', async () => {
		const errors = vi.fn(async () =>
			Response.json({ errors: [{ message: 'Invalid token' }] }),
		)
		await expect(
			fetchShopifyCollection(
				{ id: 'gid://shopify/Collection/1', handle: 'featured' },
				options(errors),
			),
		).rejects.toThrow('Invalid token')
		await expect(
			fetchShopifyCollection(
				{ id: 'gid://shopify/Collection/1', handle: 'featured' },
				options(vi.fn(async () => new Response('', { status: 401 }))),
			),
		).rejects.toBeInstanceOf(ShopifyStorefrontError)
	})
})

describe('fetchShopifyProducts', () => {
	it('fetches the picked products, leaving out what is gone', async () => {
		const fetch = answering({ nodes: [product, null] })
		expect(
			await fetchShopifyProducts(
				[
					{ id: 'gid://shopify/Product/1', handle: 'corrie-shoe' },
					{ id: 'gid://shopify/Product/2', handle: 'gone' },
				],
				options(fetch),
			),
		).toEqual([product])
		expect(sent(fetch).body.variables.ids).toEqual([
			'gid://shopify/Product/1',
			'gid://shopify/Product/2',
		])
	})

	it('asks nothing for an empty field', async () => {
		const fetch = answering({})
		expect(await fetchShopifyProducts(null, options(fetch))).toEqual([])
		expect(await fetchShopifyProducts([], options(fetch))).toEqual([])
		expect(fetch).not.toHaveBeenCalled()
	})
})
