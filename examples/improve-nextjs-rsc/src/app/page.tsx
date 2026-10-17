import { Suspense } from 'react'

import { CachedContent } from './CachedContent'
import { Experiment, ExperimentFallback } from './Experiment'
import styles from './page.module.css'

export default function Home() {
	return (
		<main className={styles.main}>
			<div className={styles.description}>
				{/* Cached, shared shell — prerendered, same for every visitor. */}
				<CachedContent />

				{/* Dynamic, per-visitor experiment — streamed in behind Suspense. */}
				<Suspense fallback={<ExperimentFallback />}>
					<Experiment />
				</Suspense>
			</div>
		</main>
	)
}
