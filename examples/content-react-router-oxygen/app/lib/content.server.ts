import {
	ContentApiError,
	ContentClient,
	readPreviewParams,
} from '@obelism/content'
import { readSiteToken } from '@obelism/content/site'
import {
	Cache,
	type CacheInstance,
	createFetchWithCache,
} from '@shopify/hydrogen'

import type { Entry } from '@obelism/content'

import type { Env } from './env'

export const isContentConfigured = (
	env: Pick<Env, 'CONTENT_DELIVERY_TOKEN' | 'CONTENT_SPACE_ID'>,
): boolean => Boolean(env.CONTENT_DELIVERY_TOKEN && env.CONTENT_SPACE_ID)

// Naming the space and environment makes a token someone made for another
// space read nothing here.
const client = (
	token: string,
	env: Env,
	options: Pick<ContentClientOptions, 'init' | 'fetch'> = {},
) =>
	new ContentClient({
		token,
		space: env.CONTENT_SPACE_ID,
		environment: env.CONTENT_ENVIRONMENT,
		...options,
	})

type ContentClientOptions = ConstructorParameters<typeof ContentClient>[0]

const drafts = (token: string, env: Env) =>
	client(token, env, { init: { cache: 'no-store' } })

// The published client with Hydrogen's cache in front of it. Content purges its
// own edge cache on publish, so the TTL is the only staleness and Oxygen's cache
// needs no tags to expire.
const cachedDelivery = (
	env: Env,
	cache: CacheInstance,
	waitUntil: ExecutionContext['waitUntil'],
) => {
	const fetchWithCache = createFetchWithCache({ cache, waitUntil })
	const key = (input: Parameters<typeof fetch>[0]) =>
		`${env.CONTENT_SPACE_ID}:${env.CONTENT_ENVIRONMENT}:${
			input instanceof Request ? input.url : String(input)
		}`

	return client(env.CONTENT_DELIVERY_TOKEN!, env, {
		fetch: (input, init) =>
			init?.cache === 'no-store'
				? fetch(input, init)
				: fetchWithCache(input, init, {
						key: key(input),
						strategy: Cache({ maxAge: 60, staleWhileRevalidate: 600 }),
					}),
	})
}

export const createContentFor = (
	request: Request,
	env: Env,
	cache?: CacheInstance,
	waitUntil?: ExecutionContext['waitUntil'],
) => {
	if (!isContentConfigured(env)) return null

	// `cms_preview` alone proves nothing: anyone can add it to a URL.
	const preview = readPreviewParams(new URL(request.url))
	if (preview?.token) return drafts(preview.token, env)
	const siteToken = readSiteToken(request.headers.get('cookie'))
	if (siteToken) return drafts(siteToken, env)
	return cache && waitUntil
		? cachedDelivery(env, cache, waitUntil)
		: client(env.CONTENT_DELIVERY_TOKEN!, env)
}

// A page read, with the published page when a draft read is refused: an expired
// site token, a cms_token minted for another space, or a token for another
// environment.
export const readContentPage = async <T extends Entry>(
	env: Env,
	request: Request,
	path: string,
	cache: CacheInstance,
	waitUntil: ExecutionContext['waitUntil'],
): Promise<T | null> => {
	const content = createContentFor(request, env, cache, waitUntil)
	if (!content) return null

	const read = (from: ContentClient) => from.getPage<T>(path, { depth: 2 })
	try {
		return await read(content)
	} catch (error) {
		if (error instanceof ContentApiError && error.status === 401) {
			return isContentConfigured(env)
				? read(client(env.CONTENT_DELIVERY_TOKEN!, env))
				: null
		}
		console.error(`[content] Could not read "${path}"`, error)
		return null
	}
}
