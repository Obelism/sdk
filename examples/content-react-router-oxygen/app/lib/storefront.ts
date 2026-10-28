import {
	type CacheInstance,
	createShopifyRequestContext,
	createStorefrontClient,
	type ShopifyRequestContext,
} from '@shopify/hydrogen'
import { createContext } from 'react-router'

import type { Env } from '~/lib/env'
import {
	getBuyerIp,
	getMockShopDomain,
	getPrivateStorefrontToken,
	getPublicStorefrontToken,
	getStoreDomain,
	storefrontConfig,
	shouldUseMockShop,
} from '~/lib/shop'

// Real store: private token + trusted buyer IP, or a public token when the
// storefront has no private one. mock.shop: tokenless public access (it is
// auth-free and rejects any private token, even a placeholder).
export type RequestStorefrontClient = ReturnType<
	typeof createRequestStorefrontClient
>

export function createRequestStorefrontClient(
	request: Request,
	env: Env,
	cache: CacheInstance,
	waitUntil: ExecutionContext['waitUntil'],
) {
	const { i18n } = storefrontConfig

	if (shouldUseMockShop(env)) {
		return createStorefrontClient({
			type: 'public',
			requestContext: createShopifyRequestContext({ request, i18n }),
			config: {
				storeDomain: getMockShopDomain(env),
				cache,
				waitUntil,
			},
		})
	}

	// A public token can read the published catalogue from server code too, so a
	// storefront without a private token still shows the store's products.
	if (!env.PRIVATE_STOREFRONT_API_TOKEN) {
		return createStorefrontClient({
			type: 'public',
			requestContext: createShopifyRequestContext({ request, i18n }),
			config: {
				storeDomain: getStoreDomain(env),
				publicStorefrontToken: getPublicStorefrontToken(env),
				storefrontId: env.PUBLIC_STOREFRONT_ID,
				cache,
				waitUntil,
			},
		})
	}

	return createStorefrontClient({
		type: 'private',
		requestContext: createShopifyRequestContext({
			request,
			i18n,
			buyerIp: getBuyerIp(request.headers),
		}),
		config: {
			storeDomain: getStoreDomain(env),
			privateStorefrontToken: getPrivateStorefrontToken(env),
			storefrontId: env.PUBLIC_STOREFRONT_ID,
			cache,
			waitUntil,
		},
	})
}

export const storefrontClientContext = createContext<RequestStorefrontClient>()
export const storefrontRequestContext = createContext<ShopifyRequestContext>()
