import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import type { NextURL } from 'next/dist/server/web/next-url'
import type { NextRequest } from 'next/server'
import { NextResponse, userAgent } from 'next/server'

import { extendedBotCheck } from './extendedBotCheck'
import { matchesRoute } from './matchesRoute'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

const DEFAULT_COOKIE_TTL = 60 * 60 * 24 * 7

export type OptionConfig = { value: string; slug: string }

export type ServerABTestConfig = {
	slug: string
	routeHandler: string
	formatSlug?: (url: NextURL, matchingOption: OptionConfig) => NextURL
	options: OptionConfig[]
}

export type GenerateImproveNextMiddlewareArgs = {
	improveSdk: ImproveServerSDK
	serverABtests: ServerABTestConfig[]
	options?: {
		visitorId?: ResponseCookie
		testValue?: ResponseCookie
	}
}

export const generateImproveNextMiddleware = (
	args: GenerateImproveNextMiddlewareArgs,
) => {
	return (request: NextRequest) => {
		try {
			// Early esacape for bots that shouldn't be getting AB tested
			const { ua = '', isBot = false } = userAgent(request)
			if (isBot || extendedBotCheck(ua)) return NextResponse.next()

			// When there is no (valid) server AB config escape
			const serverABTestConfig = args.serverABtests.find((route) =>
				matchesRoute(route.routeHandler, request.nextUrl.pathname),
			)
			if (!serverABTestConfig) return NextResponse.next()

			const basePath = serverABTestConfig.options.at(0)?.value

			if (!basePath) return NextResponse.next()

			const visitorCookieName = args.improveSdk.getVisitorCookieName()
			const cookieVisitorId = request.cookies.get(visitorCookieName)?.value
			const validCookieVisitorId =
				cookieVisitorId && args.improveSdk.validateVisitorId(cookieVisitorId)
			const visitorId = validCookieVisitorId
				? cookieVisitorId
				: args.improveSdk.generateVisitorId()

			const validateValue = (value: string | null | undefined) => {
				return value &&
					args.improveSdk.validateTestValue(serverABTestConfig.slug, value)
					? value
					: null
			}

			// Coarse geo from the edge, so country-targeted audiences resolve
			// server-side (the browser can't determine country). Vercel sets
			// x-vercel-ip-country; Cloudflare sets cf-ipcountry.
			const geo = {
				country:
					request.headers.get('x-vercel-ip-country') ??
					request.headers.get('cf-ipcountry') ??
					undefined,
			}

			// Get AB test value from: searchParam, cookies or get generate a new value
			const testValue =
				validateValue(
					request.nextUrl.searchParams.get(serverABTestConfig.slug),
				) ||
				validateValue(request.cookies.get(serverABTestConfig.slug)?.value) ||
				args.improveSdk.getTestValue(
					serverABTestConfig.slug,
					visitorId,
					ua,
					geo,
				)

			const testMatchOption = serverABTestConfig.options.find(
				(option) => option.value === testValue,
			)

			if (!testMatchOption) return NextResponse.next()

			// Update the response with cookies response
			let response: undefined | NextResponse<unknown>

			if (testMatchOption.value !== basePath) {
				const url = request.nextUrl.clone()

				url.pathname = serverABTestConfig?.formatSlug
					? serverABTestConfig?.formatSlug(url, testMatchOption)?.pathname
					: testMatchOption.slug

				response = NextResponse.rewrite(url)
			} else {
				response = NextResponse.next()
			}

			response.cookies.set(visitorCookieName, visitorId, {
				maxAge: DEFAULT_COOKIE_TTL,
				...args.options?.visitorId,
			})
			response.cookies.set(serverABTestConfig.slug, testValue, {
				maxAge: DEFAULT_COOKIE_TTL,
				...args.options?.testValue,
			})

			return response
		} catch (e) {
			console.error('[Improve SDK]', e)
			return NextResponse.next()
		}
	}
}
