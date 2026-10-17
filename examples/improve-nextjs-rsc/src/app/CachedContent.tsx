import { cacheLife } from 'next/cache'

import styles from './page.module.css'

/**
 * Shared, non-personalised content that is the same for every visitor. The
 * `"use cache"` directive lets Next.js prerender and cache it, so it is not
 * re-rendered per request. The timestamp below stays fixed until the cache
 * lifetime elapses — contrast that with the per-visitor <Experiment />, which
 * is dynamic and resolves on every request.
 */
export const CachedContent = async () => {
	'use cache'
	cacheLife('minutes')

	const renderedAt = new Date().toISOString()

	return (
		<p>
			Cached shell rendered at <code className={styles.code}>{renderedAt}</code>
		</p>
	)
}
