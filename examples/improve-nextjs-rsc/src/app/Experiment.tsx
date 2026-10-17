import styles from './page.module.css'
import { getVariant } from './getVariant'
import { TrackPageView } from './TrackPageView'
import { Visual } from './Visual'

/**
 * Dynamic, per-visitor part of the page. It resolves the variant server-side
 * (no client round-trip, no URL rewrite) and renders the matching UI. Because
 * it reads cookies it is dynamic, so the page renders it inside <Suspense>.
 */
export const Experiment = async () => {
	const variant = await getVariant()

	return (
		<>
			<TrackPageView page="homepage" />

			<p>
				Variant: <code className={styles.code}>{variant}</code>{' '}
				<span className={styles.code}>(resolved in a Server Component)</span>
			</p>

			<div className={styles.center}>
				<Visual className={styles.logo} variant={variant} />
			</div>
		</>
	)
}

export const ExperimentFallback = () => (
	<p>
		Variant: <code className={styles.code}>…</code>
	</p>
)
