// Click rates on the page: in the visual editor, a small label on each block
// that numbers has clicks for ("24% clicked"), from the editor's `stats`
// message. The editor's "Show click rates" switch turns it on and off. Plain
// DOM in a shadow root, like the prompt box, in a fixed layer that follows
// the blocks as the page scrolls, resizes and re-renders.
//
// Sites tag a block's clickable element with `data-numbers-id={block._uid}`
// and load Obelism numbers' script; the CMS reads the rates from numbers
// (the CMS's content/docs/guides/visual-editor.mdx, "Click rates").

export type BlockStats = {
	clicks: number
	// Visitors who clicked it at least once…
	clickers: number
	// …of the visitors who viewed a page it was clicked on.
	viewers: number
	// clickers / viewers.
	rate: number
}

export type StatsLabels = {
	// `{rate}` is a whole percentage.
	clicked: string
	// `{clickers}`, `{viewers}`, `{clicks}`.
	title: string
}

export const DEFAULT_STATS_LABELS: StatsLabels = {
	clicked: '{rate}% clicked',
	title:
		'{clickers} of {viewers} visitors of its page clicked it in the last 30 days ({clicks} clicks)',
}

const fill = (template: string, values: Record<string, string | number>) =>
	template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	)

// The same tokens as the prompt box: near-black pill, beige text, the orange
// accent for the rate.
const CSS = `
:host { all: initial; }
.layer {
	position: fixed; inset: 0; pointer-events: none;
	z-index: 2147483646;
	font: 600 12px/1 'InterVariable', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	-webkit-font-smoothing: antialiased;
}
.badge {
	position: absolute; transform: translateX(-100%);
	display: inline-flex; gap: 6px; align-items: center;
	padding: 6px 10px; white-space: nowrap; cursor: pointer;
	pointer-events: auto; border: 0;
	color: rgb(238 236 233); background: rgb(12 12 12 / .88);
	border-radius: 5em; box-shadow: 0 6px 16px -8px rgb(12 12 12 / .5);
	font: inherit;
}
.badge::before {
	content: ''; width: 8px; height: 8px; border-radius: 50%;
	background: rgb(212 130 30);
}
.badge[data-place='beside'] { transform: translateY(-50%); }
.badge[data-place='above'] { transform: translate(-100%, -100%); }
.badge:focus-visible { outline: 2px solid rgb(212 130 30); outline-offset: 2px; }
`

// Inset from a block's top-right corner, or gap beside a small element.
const INSET = 8
// Below this an element is a button or a link, not a section: its label goes
// beside it (or above, without room on the right) so it doesn't cover it.
const SMALL_HEIGHT = 64
// Room a label needs beside an element.
const LABEL_WIDTH = 140

// Where a label goes for an element's box: inside the top-right corner of a
// block, beside a small element, or above one at the right edge.
export const placeLabel = (
	rect: Pick<DOMRect, 'top' | 'right' | 'height'>,
	viewportWidth: number,
) => {
	if (rect.height >= SMALL_HEIGHT)
		return {
			place: 'inside' as const,
			top: Math.max(rect.top, 0) + INSET,
			left: rect.right - INSET,
		}
	if (rect.right + INSET + LABEL_WIDTH <= viewportWidth)
		return {
			place: 'beside' as const,
			top: rect.top + rect.height / 2,
			left: rect.right + INSET,
		}
	return {
		place: 'above' as const,
		top: rect.top - INSET / 2,
		left: rect.right,
	}
}

export type StatsOverlay = {
	// The rates by block uid, and whether to show them.
	update(stats: Readonly<Record<string, BlockStats>>, visible: boolean): void
	// Places the labels again, e.g. after the site re-rendered.
	refresh(): void
	destroy(): void
}

export const mountStatsOverlay = (
	win: Window,
	{
		selector,
		onSelect,
		labels: labelOverrides,
	}: {
		// The element of a block, by its uid.
		selector: (uid: string) => string
		// A label is a way to select its block too.
		onSelect: (uid: string) => void
		labels?: Partial<StatsLabels> | undefined
	},
): StatsOverlay => {
	const doc = win.document
	const labels = { ...DEFAULT_STATS_LABELS, ...labelOverrides }

	const host = doc.createElement('div')
	host.setAttribute('data-obelism-stats', '')
	const shadow = host.attachShadow({ mode: 'open' })
	const style = doc.createElement('style')
	style.textContent = CSS
	const layer = doc.createElement('div')
	layer.className = 'layer'
	shadow.append(style, layer)
	doc.body.appendChild(host)

	let stats: Readonly<Record<string, BlockStats>> = {}
	let visible = false
	let frame: number | null = null

	const render = () => {
		frame = null
		layer.replaceChildren()
		layer.hidden = !visible
		if (!visible) return
		const height = win.innerHeight
		for (const [uid, block] of Object.entries(stats)) {
			const element = doc.querySelector(selector(uid))
			if (!element) continue
			const rect = element.getBoundingClientRect()
			// Not rendered, or off screen.
			if (!rect.width && !rect.height) continue
			if (rect.bottom < 0 || rect.top > height) continue

			const badge = doc.createElement('button')
			badge.type = 'button'
			badge.className = 'badge'
			badge.dataset.uid = uid
			badge.textContent = fill(labels.clicked, {
				rate: Math.round(block.rate * 100),
			})
			badge.title = fill(labels.title, {
				clickers: block.clickers,
				viewers: block.viewers,
				clicks: block.clicks,
			})
			const { place, top, left } = placeLabel(rect, win.innerWidth)
			badge.dataset.place = place
			badge.style.top = `${top}px`
			badge.style.left = `${left}px`
			badge.addEventListener('click', () => onSelect(uid))
			layer.appendChild(badge)
		}
	}

	// At most once a frame, however many scroll and mutation events come in.
	const schedule = () => {
		if (frame !== null || !visible) return
		frame = win.requestAnimationFrame(render)
	}

	win.addEventListener('scroll', schedule, { capture: true, passive: true })
	win.addEventListener('resize', schedule)
	// The site re-renders blocks on every `update`; follow them. Our own
	// layer lives in a shadow root, so its changes don't come back here.
	const Observer = (
		win as Window & { MutationObserver?: typeof MutationObserver }
	).MutationObserver
	const observer =
		typeof Observer === 'function' ? new Observer(schedule) : null
	observer?.observe(doc.body, { childList: true, subtree: true })

	return {
		update(nextStats, nextVisible) {
			stats = nextStats
			visible = nextVisible
			if (frame !== null) {
				win.cancelAnimationFrame?.(frame)
				frame = null
			}
			render()
		},
		refresh: schedule,
		destroy() {
			if (frame !== null) win.cancelAnimationFrame?.(frame)
			win.removeEventListener('scroll', schedule, { capture: true })
			win.removeEventListener('resize', schedule)
			observer?.disconnect()
			host.remove()
		},
	}
}
