import { data } from 'react-router'

import { envContext } from '~/lib/env'
import { sendPurchase } from '~/lib/numbers.server'

import type { Route } from './+types/api.purchase'

// The test order's purchase event: a server request with the environment's
// numbers token, the visitor's cookie and no Origin header.
export async function action({ request, context }: Route.ActionArgs) {
	if (request.method !== 'POST')
		return data({ error: 'Method not allowed' }, { status: 405 })

	const env = context.get(envContext)
	const order = {
		id: `test_${crypto.randomUUID()}`,
		total: 949.95,
		currency: 'USD',
	}
	const result = await sendPurchase(request, env, order)

	return data({ order, ...result }, { status: result.sent ? 200 : 503 })
}

export const loader = () =>
	data({ error: 'Method not allowed' }, { status: 405 })
