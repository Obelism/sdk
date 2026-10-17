import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { NextResponse, userAgent, type NextRequest } from 'next/server'

import { AB_TEST_SLUG, IMPROVE_CONFIG } from './app/improveConfig'

export const config = {
	matcher: '/',
}

const COOKIE_TTL = 60 * 60 * 24 * 7 // one week

const improveSdk = new ImproveServerSDK({
	...IMPROVE_CONFIG,
	token: 'd7yhgB-VDusnE-i2eWml-ThPDPf',
})

/**
 * Unlike the URL-rewriting `nextjs` example, this proxy never changes the
 * route. It only assigns the visitor to a variant and persists it in cookies.
 * The Server Component then reads that cookie and renders the variant inline,
 * keeping a single URL for both variants.
 */
export const proxy = async (request: NextRequest) => {
	await improveSdk.fetchConfig()

	const { ua = '' } = userAgent(request)

	// Reuse a valid visitor id from the cookie, otherwise generate a new one.
	const visitorCookieName = improveSdk.getVisitorCookieName()
	const existingVisitorId = request.cookies.get(visitorCookieName)?.value
	const visitorId =
		existingVisitorId && improveSdk.validateVisitorId(existingVisitorId)
			? existingVisitorId
			: improveSdk.generateVisitorId()

	// Reuse a valid assignment from the cookie, otherwise assign a fresh one.
	const existingValue = request.cookies.get(AB_TEST_SLUG)?.value
	const testValue =
		(existingValue &&
			improveSdk.validateTestValue(AB_TEST_SLUG, existingValue) &&
			existingValue) ||
		improveSdk.getTestValue(AB_TEST_SLUG, visitorId, ua) ||
		'control'

	// Forward the values on the request so the Server Component can read them
	// during this same render, and set them on the response for the browser.
	request.cookies.set(visitorCookieName, visitorId)
	request.cookies.set(AB_TEST_SLUG, testValue)

	const response = NextResponse.next({ request })

	response.cookies.set(visitorCookieName, visitorId, { maxAge: COOKIE_TTL })
	response.cookies.set(AB_TEST_SLUG, testValue, { maxAge: COOKIE_TTL })

	return response
}
