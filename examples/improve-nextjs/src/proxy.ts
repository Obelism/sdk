import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { generateImproveNextMiddleware } from '@obelism/improve-sdk-next'
import { type NextRequest } from 'next/server'

import { IMPROVE_CONFIG } from './app/improveConfig'

export const config = {
	matcher: '/',
}

const improveSdk = new ImproveServerSDK({
	...IMPROVE_CONFIG,
	token: 'd7yhgB-VDusnE-i2eWml-ThPDPf',
})

const improveMiddlewareHandler = generateImproveNextMiddleware({
	improveSdk,
	serverABtests: [
		{
			slug: 'startpage-visual',
			routeHandler: '/',
			options: [
				{
					value: 'control',
					slug: '/',
				},
				{
					value: 'variation',
					slug: '/variation',
				},
			],
		},
	],
})

export const proxy = async (request: NextRequest) => {
	await improveSdk.fetchConfig()
	return improveMiddlewareHandler(request)
}
