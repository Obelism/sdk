import { cookies } from 'next/headers'

import { AB_TEST_SLUG, Variant } from './improveConfig'

/**
 * Reads the variant the proxy assigned for this visitor.
 *
 * `cookies()` is a dynamic API, so any component that calls this must be
 * rendered inside a <Suspense> boundary when Cache Components is enabled.
 */
export const getVariant = async (): Promise<Variant> => {
	const cookieStore = await cookies()
	return cookieStore.get(AB_TEST_SLUG)?.value === 'variation'
		? 'variation'
		: 'control'
}
