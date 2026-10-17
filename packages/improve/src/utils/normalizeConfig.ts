import { ImproveConfiguration } from '../types'
import { ImproveFetchError } from './errors'

/**
 * @function normalizeConfig
 * @description Coerce a parsed config response into a well-formed
 * {@link ImproveConfiguration}. The backend returns `200 {}` for an unknown
 * org/environment (and on its own internal error). An empty object is truthy,
 * so it slips past `if (!this.config)` guards and then crashes downstream on
 * `config.tests[slug]` (`Cannot read properties of undefined`). Guaranteeing
 * `tests`/`flags`/`audience` are always objects lets the SDK fail open to
 * default values instead of throwing during render/middleware.
 *
 * Throws {@link ImproveFetchError} `invalid-response` when the body isn't an
 * object at all (e.g. an array, string, or null).
 */
export const normalizeConfig = (body: unknown): ImproveConfiguration => {
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		throw new ImproveFetchError('invalid-response')
	}

	const raw = body as Partial<ImproveConfiguration>

	return {
		name: typeof raw.name === 'string' ? raw.name : '',
		version: typeof raw.version === 'number' ? raw.version : 0,
		tests: raw.tests ?? {},
		flags: raw.flags ?? {},
		audience: raw.audience ?? {},
	}
}
