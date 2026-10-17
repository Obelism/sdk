import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'

const app = new Hono()

const improveSdk = new ImproveServerSDK({
	organizationId: 'org_MJFL46Z0WXGQ5OHW1ZXSM3Q88S',
	environment: 'staging',
	token: 'd7yhgB-VDusnE-i2eWml-ThPDPf',
})

const AB_TEST_SLUG = 'startpage-visual'

app.get('/', async (c) => {
	//? Get config from Improve
	await improveSdk.fetchConfig()

	//? Get values from cookie for a consistent browsing experience for users
	const visitorCookieName = improveSdk.getVisitorCookieName()
	const visitorIdCookie = getCookie(c, visitorCookieName)
	const testCookieValue = getCookie(c, AB_TEST_SLUG)

	//? Validate if the cookie values are valid
	const validCookieVisitorId =
		visitorIdCookie && improveSdk.validateVisitorId(visitorIdCookie)
	const validCookieValue =
		testCookieValue &&
		improveSdk.validateTestValue(AB_TEST_SLUG, testCookieValue)

	const visitorId = validCookieVisitorId
		? visitorIdCookie
		: improveSdk.generateVisitorId()

	const testValue = validCookieValue
		? testCookieValue
		: improveSdk.getTestValue(
				AB_TEST_SLUG,
				visitorId,
				c.req.header('User-Agent') || '',
			)

	//? Re-store values in cookies for one week
	setCookie(c, visitorCookieName, visitorId, {
		maxAge: 60 * 60 * 24 * 7,
	})
	setCookie(c, AB_TEST_SLUG, testValue, {
		maxAge: 60 * 60 * 24 * 7,
	})

	return c.text(`AB Test: ${testValue}`)
})

export default app
