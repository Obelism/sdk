import type { AutoTrackOptions, Events } from './types'

// Both attributes tag a click target: ours, and numbers' from before this
// package (Content's click-rate labels read block uids from it).
const CLICK_TARGET = '[data-events-id],[data-numbers-id]'

export const startAutoTrack = (
	emit: Events['emit'],
	{ pageViews = true, clicks = true }: AutoTrackOptions = {},
) => {
	const stops: (() => void)[] = []

	if (pageViews) {
		// One page view per path: replaceState for a query or hash change
		// isn't a new page.
		let lastPath: string | null = null
		const onNavigate = () => {
			if (location.pathname === lastPath) return
			lastPath = location.pathname
			emit('page_view')
		}
		const wrap = (name: 'pushState' | 'replaceState') => {
			const original = history[name]
			const wrapped: typeof original = function (this: History, ...args) {
				const result = original.apply(this, args)
				onNavigate()
				return result
			}
			history[name] = wrapped
			stops.push(() => {
				// Leave a wrapper someone added after ours in place.
				if (history[name] === wrapped) history[name] = original
			})
		}
		wrap('pushState')
		wrap('replaceState')
		window.addEventListener('popstate', onNavigate)
		stops.push(() => window.removeEventListener('popstate', onNavigate))
		onNavigate()
	}

	if (clicks) {
		// Captured, so a handler that stops the click still counts it.
		const onClick = (event: MouseEvent) => {
			const target = (event.target as Element | null)?.closest?.(CLICK_TARGET)
			const id =
				target?.getAttribute('data-events-id') ??
				target?.getAttribute('data-numbers-id')
			if (id) emit('click', { scope: id })
		}
		document.addEventListener('click', onClick, true)
		stops.push(() => document.removeEventListener('click', onClick, true))
	}

	return () => {
		for (const stop of stops) stop()
	}
}
