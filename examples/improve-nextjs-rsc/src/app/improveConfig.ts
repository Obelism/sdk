import { ImproveSetupArgs } from '@obelism/improve-sdk/types'

export const IMPROVE_CONFIG: ImproveSetupArgs = {
	organizationId: 'org_MJFL46Z0WXGQ5OHW1ZXSM3Q88S',
	environment: 'staging',
} as const

export const AB_TEST_SLUG = 'startpage-visual'

export type Variant = 'control' | 'variation'
