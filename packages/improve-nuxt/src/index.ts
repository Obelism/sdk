import type { ImproveServerSDK } from '@obelism/improve-sdk/server'
import {
	defineEventHandler,
	getCookie,
	getQuery,
	getRequestHeader,
	type H3Event,
	setCookie,
} from 'h3'

import { extendedBotCheck } from './extendedBotCheck'

export type CookieOptions = NonNullable<Parameters<typeof setCookie>[3]>
import { matchesRoute } from './matchesRoute'

const DEFAULT_COOKIE_TTL = 60 * 60 * 24 * 7

// The crawlers Next's `userAgent().isBot` knows, which improve-next relies on.
const CRAWLERS =
	/Googlebot|Mediapartners-Google|AdsBot-Google|googleweblight|Storebot-Google|Google-PageRenderer|Google-InspectionTool|Bingbot|BingPreview|Slurp|DuckDuckBot|baiduspider|yandex|sogou|LinkedInBot|bitlybot|tumblr|vkShare|quora link preview|facebookexternalhit|facebookcatalog|Twitterbot|applebot|redditbot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|ia_archiver|GPTBot/i

export type ServerABTestConfig = {
	// Needs to match an A/B test in Improve.
	slug: string
	// The page route to decide it on, as Nuxt names it: `/`, `/products/[id]`,
	// `/blog/[...slug]`.
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

// The variants decided for this request, by test slug.
export type ImproveEventContext = Record<string, string>

declare module 'h3' {
	interface H3EventContext {
		improve?: ImproveEventContext
	}
}

// The variants the middleware decided for this request, by test slug. Empty
// for a bot, a route without a server test, or when the datafile is missing.
export const getImproveContext = (event: H3Event): ImproveEventContext =>
	event.context.improve ?? {}

// A Nitro server middleware (`server/middleware/improve.ts`) that decides the
// visitor's variant before the page renders, keeps it in cookies, and leaves
// it on `event.context.improve` for the page to render. The URL stays the
// same: Nuxt hydrates the route the browser shows, so the page renders the
// variant itself instead of being rewritten to another route.
export const generateImproveNuxtMiddleware = (
	args: GenerateImproveNuxtMiddlewareArgs,
) =>
	defineEventHandler(async (event) => {
		try {
			const ua = getRequestHeader(event, 'user-agent') ?? ''
			if (CRAWLERS.test(ua) || extendedBotCheck(ua)) return

			const tests = args.serverABtests.filter((test) =>
				matchesRoute(test.routeHandler, event.path),
			)
			if (tests.length === 0) return

			await args.improveSdk.fetchConfig()

			const visitorCookieName = args.improveSdk.getVisitorCookieName()
			// The name before it was namespaced: keep an existing visitor.
			const cookieVisitorId =
				getCookie(event, visitorCookieName) ??
				getCookie(event, args.improveSdk.getLegacyVisitorCookieName())
			const visitorId =
				cookieVisitorId && args.improveSdk.validateVisitorId(cookieVisitorId)
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

				// A query parameter (for testing a variant), the cookie, or a new
				// decision.
				const value =
					valid(query[slug]) ??
					valid(getCookie(event, slug)) ??
					args.improveSdk.getTestValue(slug, visitorId, ua, geo)
				if (value == null) continue

				decided[slug] = value
				setCookie(event, slug, value, {
					path: '/',
					maxAge: DEFAULT_COOKIE_TTL,
					...args.options?.testValue,
				})
			}
			if (Object.keys(decided).length === 0) return

			setCookie(event, visitorCookieName, visitorId, {
				path: '/',
				maxAge: DEFAULT_COOKIE_TTL,
				...args.options?.visitorId,
			})
			event.context.improve = { ...event.context.improve, ...decided }
		} catch (e) {
			console.error('[Improve SDK]', e)
		}
	})
