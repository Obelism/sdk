import { generateImproveProvider } from '@obelism/improve-sdk-react'

import type { Env } from './env'

// The organization and space ids are public, and the deployment's Worker env
// holds them: the root loader passes them here before the provider's effect
// creates the client.
const config = {
	organizationId: '',
	spaceId: undefined as string | undefined,
	environment: 'production' as NonNullable<Env['IMPROVE_ENVIRONMENT']>,
}

export const setImproveConfig = (next: {
	organizationId: string
	spaceId?: string | undefined
	environment: NonNullable<Env['IMPROVE_ENVIRONMENT']>
}) => {
	config.organizationId = next.organizationId
	config.spaceId = next.spaceId
	config.environment = next.environment
}

const improve = generateImproveProvider(config)

export const ImproveProvider = improve.ImproveProvider
export const useFlagValue = improve.useFlagValue
export const useImproveStatus = improve.useImproveStatus
export const usePostAnalytic = improve.usePostAnalytic
export const useTestValue = improve.useTestValue
