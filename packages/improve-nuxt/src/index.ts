import type { ImproveServerSDK } from '@obelism/improve-sdk/server'
import {
	defineEventHandler,
	getCookie,
	getQuery,
	getRequestHeader,
	type H3Event,
	setCookie,
	setResponseHeader,
} from 'h3'

import { extendedBotCheck } from './extendedBotCheck'
import { matchesRoute } from './matchesRoute'

const DEFAULT_COOKIE_TTL = 60 * 60 * 24 * 7
// The cookie is echoed back, so only an id of the alphabet the SDK mints, as
// in the server SDK's seedTestCookies.
const SAFE_ID = /^[A-Za-z0-9_-]+$/

// The crawlers Next's `userAgent().isBot` knows, which improve-next relies on.
const CRAWLERS =
	/Googlebot|Mediapartners-Google|AdsBot-Google|googleweblight|Storebot-Google|Google-PageRenderer|Google-InspectionTool|Bingbot|BingPreview|Slurp|DuckDuckBot|baiduspider|yandex|sogou|LinkedInBot|bitlybot|tumblr|vkShare|quora link preview|facebookexternalhit|facebookcatalog|Twitterbot|applebot|redditbot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|ia_archiver|GPTBot/i

export type CookieOptions = NonNullable<Parameters<typeof setCookie>[3]>

export type ServerABTestConfig = {
	// Needs to match an A/B test in Improve.
	slug: string
	// The page route to decide it on: `/`, `/products/[id]`, `/blog/[...slug]`.
	routeHandler: string
}

export type GenerateImproveNuxtMiddlewareArgs = {
	improveSdk: ImproveServerSDK
	serverABtests: ServerABTestConfig[]
	options?:
		| {
				visitorId?: CookieOptions | undefined
				testValue?: CookieOptions | undefined
		  }
		| undefined
}

// By test slug.
export type ImproveEventContext = Record<string, string>

declare module 'h3' {
	interface H3EventContext {
		improve?: ImproveEventContext
	}
}

// The variants the middleware decided for this request. Empty for a bot, a
// route without a server test, or when the datafile is missing.
export const getImproveContext = (event: H3Event): ImproveEventContext =>
	event.context.improve ?? {}

// Nuxt's own requests (`/_nuxt/`, `/__nuxt_error`, payloads), server routes
// and files reach server middleware too; only pages get a decision.
const isPage = (event: H3Event) => {
	if (event.method !== 'GET' && event.method !== 'HEAD') return false
	const path = event.path.split('?')[0] ?? ''
	if (path.startsWith('/_') || path.startsWith('/api/')) return false
	return !path.slice(path.lastIndexOf('/')).includes('.')
}

// A Nitro server middleware. Nuxt hydrates the route the browser shows, so
// instead of rewriting to another route it leaves the variants on
// `event.context.improve` for the page to render.
export const generateImproveNuxtMiddleware = (
	args: GenerateImproveNuxtMiddlewareArgs,
) => {
	// Concurrent first requests share one fetch.
	let loading: ReturnType<ImproveServerSDK['fetchConfig']> | null = null
	const ready = () =>
		(loading ??= args.improveSdk.fetchConfig().finally(() => {
			loading = null
		}))

	const cookie = (override: CookieOptions | undefined): CookieOptions => ({
		path: '/',
		maxAge: DEFAULT_COOKIE_TTL,
		...override,
	})

	return defineEventHandler(async (event) => {
		try {
			if (!isPage(event)) return

			const ua = getRequestHeader(event, 'user-agent') ?? ''
			if (CRAWLERS.test(ua) || extendedBotCheck(ua)) return

			const tests = args.serverABtests.filter((test) =>
				matchesRoute(test.routeHandler, event.path),
			)
			if (tests.length === 0) return

			await ready()

			const visitorCookieName = args.improveSdk.getVisitorCookieName()
			// The name before it was namespaced: keep an existing visitor.
			const cookieVisitorId =
				getCookie(event, visitorCookieName) ??
				getCookie(event, args.improveSdk.getLegacyVisitorCookieName())
			const visitorId =
				cookieVisitorId &&
				args.improveSdk.validateVisitorId(cookieVisitorId) &&
				SAFE_ID.test(cookieVisitorId)
					? cookieVisitorId
					: args.improveSdk.generateVisitorId()

			// Coarse geo from the edge, so country audiences resolve: the browser
			// can't determine country.
			const geo = {
				country:
					getRequestHeader(event, 'x-vercel-ip-country') ??
					getRequestHeader(event, 'cf-ipcountry') ??
					undefined,
			}
			const query = getQuery(event)

			const decided: ImproveEventContext = {}
			for (const { slug } of tests) {
				const valid = (value: unknown) =>
					typeof value === 'string' &&
					args.improveSdk.validateTestValue(slug, value)
						? value
						: null

				const value =
					valid(query[slug]) ??
					valid(getCookie(event, slug)) ??
					args.improveSdk.getTestValue(slug, visitorId, ua, geo)
				if (value == null) continue

				decided[slug] = value
				setCookie(event, slug, value, cookie(args.options?.testValue))
			}
			if (Object.keys(decided).length === 0) return

			setCookie(
				event,
				visitorCookieName,
				visitorId,
				cookie(args.options?.visitorId),
			)
			// The page differs per visitor: a shared cache must not keep it.
			setResponseHeader(event, 'cache-control', 'private')
			event.context.improve = { ...event.context.improve, ...decided }
		} catch (e) {
			console.error('[Improve SDK]', e)
		}
	})
}
