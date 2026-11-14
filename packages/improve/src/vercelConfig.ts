import type { ImproveConfiguration, ImproveEnvironmentOption } from './types'
import { normalizeConfig } from './utils/normalizeConfig'

// Improve mirrors one datafile per format to Vercel Global Config: `production`
// is format 1, `production_f2` has exclusion groups and holdouts.
export const getVercelConfigKeys = (environment: ImproveEnvironmentOption) =>
	[`${environment}_f2`, environment] as const

/**
 * Reads an environment's datafile from Vercel Global Config, for
 * `loadConfig` or the `config` setup option. Pass the store's `get`, e.g.
 * `@vercel/global-config`'s. Falls back to the format-1 key a store written by
 * an older Improve has; null when neither is there.
 */
export const readVercelConfig = async (
	get: (key: string) => unknown,
	environment: ImproveEnvironmentOption,
): Promise<ImproveConfiguration | null> => {
	for (const key of getVercelConfigKeys(environment)) {
		const value = await get(key)
		if (value && typeof value === 'object') return normalizeConfig(value)
	}
	return null
}
