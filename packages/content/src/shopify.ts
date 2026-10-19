import type { ShopifyItem } from './types'

// What a `shopify` field points at, live from the store: the Storefront API
// with the space's Storefront token (Settings → Copy as .env:
// SHOPIFY_STORE_DOMAIN and SHOPIFY_STOREFRONT_TOKEN, safe in the browser).
// Content stores only `{ id, handle }`, so prices and stock are never stale.
// A Hydrogen or Liquid site can query by the id itself instead.

// The Storefront API version the queries are written for.
export const SHOPIFY_STOREFRONT_API_VERSION = '2026-10'

export type ShopifyStorefrontOptions = {
	// The store's myshopify domain, e.g. `acme.myshopify.com`.
	shop: string
	// A Storefront API access token.
	storefrontToken: string
	// Prices and translations for a market: ISO country and language codes
	// (`NL`, `NL`). The store's defaults when left out.
	country?: string | undefined
	language?: string | undefined
	// Passed to every fetch, e.g. `{ next: { revalidate: 60 } }` in Next.js.
	init?: RequestInit | undefined
	// A fetch implementation, for runtimes or tests that need their own.
	fetch?: typeof fetch | undefined
}

export type ShopifyMoney = { amount: string; currencyCode: string }

export type ShopifyImage = {
	url: string
	altText: string | null
	width: number | null
	height: number | null
}

export type ShopifyProduct = {
	id: string
	handle: string
	title: string
	availableForSale: boolean
	featuredImage: ShopifyImage | null
	priceRange: { minVariantPrice: ShopifyMoney }
}

export type ShopifyCollection = {
	id: string
	handle: string
	title: string
	products: ShopifyProduct[]
}

export class ShopifyStorefrontError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message)
		this.name = 'ShopifyStorefrontError'
	}
}

const PRODUCT_FIELDS =
	'id handle title availableForSale featuredImage { url altText width height } priceRange { minVariantPrice { amount currencyCode } }'

const CONTEXT_VARIABLES = '$country: CountryCode, $language: LanguageCode'
const IN_CONTEXT = '@inContext(country: $country, language: $language)'

const storefront = async <T>(
	options: ShopifyStorefrontOptions,
	query: string,
	variables: Record<string, unknown>,
): Promise<T> => {
	const fetchImpl = options.fetch ?? fetch
	const response = await fetchImpl(
		`https://${options.shop}/api/${SHOPIFY_STOREFRONT_API_VERSION}/graphql.json`,
		{
			...options.init,
			method: 'POST',
			headers: {
				...(options.init?.headers as Record<string, string> | undefined),
				'content-type': 'application/json',
				'x-shopify-storefront-access-token': options.storefrontToken,
			},
			body: JSON.stringify({
				query,
				variables: {
					...variables,
					country: options.country?.toUpperCase() ?? null,
					language: options.language?.toUpperCase() ?? null,
				},
			}),
		},
	)
	if (!response.ok)
		throw new ShopifyStorefrontError(
			response.status,
			`Shopify's Storefront API answered ${response.status}`,
		)
	const body = (await response.json()) as {
		data?: T
		errors?: { message: string }[]
	}
	if (body.errors?.length || !body.data)
		throw new ShopifyStorefrontError(
			response.status,
			body.errors?.map((error) => error.message).join('; ') ||
				'No data from the Storefront API',
		)
	return body.data
}

// A collection field's collection with its first `first` products (default
// 12, at most 250), in the collection's order; null when the store no
// longer has it or it isn't published to the token's sales channel.
export const fetchShopifyCollection = async (
	item: ShopifyItem,
	options: ShopifyStorefrontOptions & { first?: number | undefined },
): Promise<ShopifyCollection | null> => {
	const first = Math.min(Math.max(Math.trunc(options.first ?? 12), 1), 250)
	const data = await storefront<{
		collection:
			| (Omit<ShopifyCollection, 'products'> & {
					products: { nodes: ShopifyProduct[] }
			  })
			| null
	}>(
		options,
		`query Collection($id: ID!, $first: Int!, ${CONTEXT_VARIABLES}) ${IN_CONTEXT} { collection(id: $id) { id handle title products(first: $first) { nodes { ${PRODUCT_FIELDS} } } } }`,
		{ id: item.id, first },
	)
	if (!data.collection) return null
	const { products, ...collection } = data.collection
	return { ...collection, products: products.nodes }
}

// A product field's products, in the field's order; one the store no
// longer has (or doesn't sell through this channel) is left out.
export const fetchShopifyProducts = async (
	items: ShopifyItem | ShopifyItem[] | null | undefined,
	options: ShopifyStorefrontOptions,
): Promise<ShopifyProduct[]> => {
	const ids = (Array.isArray(items) ? items : items ? [items] : [])
		.map(({ id }) => id)
		.slice(0, 250)
	if (ids.length === 0) return []
	const data = await storefront<{
		nodes: (ShopifyProduct | Record<string, never> | null)[]
	}>(
		options,
		`query Products($ids: [ID!]!, ${CONTEXT_VARIABLES}) ${IN_CONTEXT} { nodes(ids: $ids) { ... on Product { ${PRODUCT_FIELDS} } } }`,
		{ ids },
	)
	return data.nodes.filter((node): node is ShopifyProduct =>
		Boolean(node && 'id' in node),
	)
}
