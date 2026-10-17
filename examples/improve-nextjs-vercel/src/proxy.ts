import { type NextRequest } from 'next/server'
import { get as getFromEdgeConfig } from '@vercel/edge-config'
import { type ImproveConfiguration } from '@obelism/improve-sdk/types'
import { ImproveServerSDK } from '@obelism/improve-sdk/server'
import { generateImproveNextMiddleware } from '@obelism/improve-sdk-next'

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

const getImproveConfig = async () => {
	if (!!improveSdk.config) return

	// Only the active state is saved in edge config
	if (IMPROVE_CONFIG.state !== 'active') {
		return await improveSdk.fetchConfig()
	}

	const config = await getFromEdgeConfig(IMPROVE_CONFIG.environment)
	improveSdk.loadConfig(config as ImproveConfiguration)
}

export const proxy = async (request: NextRequest) => {
	await getImproveConfig()
	return improveMiddlewareHandler(request)
}
