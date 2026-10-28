import { ImproveServerSDK } from '@obelism/improve-sdk/server'

import { readCookie } from './cookies'

import type { Env } from './env'

let sdk: ImproveServerSDK | undefined

// One server SDK per isolate: a Worker isolate serves one deployment of one
// storefront, so it keeps the datafile in memory between requests.
export const getImprove = (env: Env) => {
	if (!env.IMPROVE_ORGANIZATION_ID || !env.IMPROVE_API_TOKEN) return null
	return (sdk ??= new ImproveServerSDK({
		organizationId: env.IMPROVE_ORGANIZATION_ID,
		spaceId: env.IMPROVE_SPACE_ID,
		environment: env.IMPROVE_ENVIRONMENT ?? 'production',
		token: env.IMPROVE_API_TOKEN,
	}))
}

const cookie = (name: string, value: string) =>
	`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`

// Oxygen sets `oxygen-buyer-country`; other hosts use their own header.
export const countryOf = (request: Request) =>
	request.headers.get('oxygen-buyer-country') ??
	request.headers.get('cf-ipcountry') ??
	request.headers.get('x-vercel-ip-country') ??
	undefined

export type Variant = { value: string; cookies: string[] }

export async function variant(
	request: Request,
	env: Env,
	testSlug: string,
): Promise<Variant> {
	const improve = getImprove(env)
	const visitorCookie = improve?.getVisitorCookieName() ?? 'visitorId'
	const storedVisitor = readCookie(request.headers.get('cookie'), visitorCookie)
	const visitorId =
		storedVisitor && improve?.validateVisitorId(storedVisitor)
			? storedVisitor
			: (improve?.generateVisitorId() ?? `visi_${crypto.randomUUID()}`)

	let value = 'control'
	let testDefault = 'control'

	if (!improve) {
		return {
			value,
			cookies: [cookie(visitorCookie, visitorId), cookie(testSlug, value)],
		}
	}

	try {
		await improve.fetchConfig()
		const test = improve.getTestConfig(testSlug)
		testDefault = test?.defaultValue ?? 'control'

		const stored = readCookie(request.headers.get('cookie'), testSlug)
		const known =
			stored && test?.options.some((option) => option.slug === stored)
				? stored
				: null

		value =
			known ??
			improve.getTestValue(
				testSlug,
				visitorId,
				request.headers.get('user-agent') ?? '',
				{ country: countryOf(request) },
			) ??
			testDefault
	} catch {
		// A datafile outage keeps the page rendering with the control.
		value = testDefault
	}

	return {
		value,
		cookies: [cookie(visitorCookie, visitorId), cookie(testSlug, value)],
	}
}
