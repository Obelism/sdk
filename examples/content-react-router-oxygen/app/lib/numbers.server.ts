import { detectDevice } from '@obelism/numbers-sdk'

import type { Env } from './env'
import { readCookie } from './cookies'

const NUMBERS_URL = 'https://numbers.obelism.studio/api/log'

type Order = { id: string; total: number; currency: string }

// A server event has no Origin header, so numbers authenticates it with the
// environment's token. A Worker's subrequest carries no cf-connecting-ip, so
// these events share one rate-limit bucket and carry no country.
export const sendPurchase = async (
	request: Request,
	env: Env,
	order: Order,
) => {
	const visitorId = readCookie(request.headers.get('cookie'), 'visitorId')
	if (!visitorId || !env.NUMBERS_ORGANIZATION_ID || !env.NUMBERS_API_TOKEN) {
		return { sent: false, reason: 'not_configured' } as const
	}

	const response = await fetch(NUMBERS_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			token: env.NUMBERS_API_TOKEN,
		},
		body: JSON.stringify({
			type: 'event',
			event: 'purchase',
			scope: 'checkout',
			organizationId: env.NUMBERS_ORGANIZATION_ID,
			spaceId: env.NUMBERS_SPACE_ID,
			environment: env.NUMBERS_ENVIRONMENT ?? 'production',
			visitorId,
			...detectDevice(request.headers.get('user-agent') ?? ''),
			screen: '',
			visitor: 'recurring',
			value: order.total,
			currency: order.currency,
			params: { order_id: order.id },
			path: '/checkout',
		}),
	})

	return { sent: response.ok, status: response.status } as const
}
