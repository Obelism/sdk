import { UID_ATTRIBUTE } from '../editable'

// Click rates on the page: a small label on each block Numbers has clicks
// for ("24% clicked"), and on each element the site tags a little one: a
// cross before its first click, an hourglass until enough visitors saw its
// page for a rate. From the visual editor's `stats` message (its "Show click
// rates" switch turns them on and off), or on the site from the CMS's site
// API while blocks are outlined. Plain DOM in a shadow root, like the prompt
// box, in a fixed layer that follows the blocks as the page scrolls, resizes
// and re-renders.
//
// Sites tag a block's clickable element with `data-numbers-id={block._uid}`
// and load Obelism Numbers' script; the CMS reads the rates from Numbers
// (the CMS's content/docs/guides/canvas.mdx, "Click rates").

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
	// The same on a link's tag.
	clickedShort: string
	// `{clickers}`, `{viewers}`, `{clicks}`.
	title: string
	noClicks: string
	// `{clicks}`, `{viewers}`, and `{needed}`: the visitors a rate takes.
	counting: string
}

export const DEFAULT_STATS_LABELS: StatsLabels = {
	clicked: '{rate}% clicked',
	clickedShort: '{rate}%',
	title:
		'{clickers} of {viewers} visitors of its page clicked it in the last 30 days ({clicks} clicks)',
	noClicks: 'No clicks yet in the last 30 days',
	counting:
		'{clicks} clicks so far: a click rate once {needed} visitors saw its page ({viewers} yet)',
}

// Fewer visitors than this make a rate noise.
export const MIN_VIEWERS = 20

export const TAG_ATTRIBUTE = 'data-numbers-id'

export type StatsStatus = 'none' | 'counting' | 'rate'

export const statsStatus = (block: BlockStats | undefined): StatsStatus =>
	!block || block.clicks === 0
		? 'none'
		: block.viewers < MIN_VIEWERS
			? 'counting'
			: 'rate'

// Lucide's x and hourglass.
const ICONS: Record<Exclude<StatsStatus, 'rate'>, string> = {
	none: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	counting:
		'<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
}

const fill = (template: string, values: Record<string, string | number>) =>
	template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in values ? String(values[key]) : match,
	)

// The same tokens as the prompt box: an ink pill, paper text, the orange
// accent for the rate.
const CSS = `
:host { all: initial; }
.layer {
	position: fixed; inset: 0; pointer-events: none;
	z-index: 2147483646;
	font: 600 12px/1 'Geist', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	-webkit-font-smoothing: antialiased;
}
.badge {
	position: absolute; transform: translateX(-100%);
	display: inline-flex; gap: 6px; align-items: center;
	padding: 6px 10px; white-space: nowrap; cursor: pointer;
	pointer-events: auto; border: 0;
	color: rgb(242 240 236); background: rgb(23 22 20 / .88);
	border-radius: 5em; box-shadow: 0 6px 16px -8px rgb(23 22 20 / .5);
	font: inherit;
}
.badge::before {
	content: ''; width: 8px; height: 8px; border-radius: 50%;
	background: rgb(212 130 30);
}
.badge[data-place='beside'] { transform: translateY(-50%); }
.badge[data-place='above'] { transform: translate(-100%, -100%); }
.badge:focus-visible, .tag:focus-visible { outline: 2px solid rgb(212 130 30); outline-offset: 2px; }
.tag {
	position: absolute; transform: translate(-50%, -50%);
	display: grid; place-items: center; width: 20px; height: 20px; padding: 0;
	cursor: pointer; pointer-events: auto; border: 0; border-radius: 50%;
	color: rgb(242 240 236); background: rgb(23 22 20 / .88);
	box-shadow: 0 4px 10px -6px rgb(23 22 20 / .5);
}
.tag::after { content: ''; position: absolute; inset: -6px; }
.tag[data-status='counting'] { color: rgb(212 130 30); }
.tag[data-status='rate'] {
	width: auto; height: 20px; padding: 0 7px; border-radius: 5em;
	font-size: 11px; transform: translate(-70%, -50%);
}
.tag svg {
	width: 12px; height: 12px; fill: none; stroke: currentColor;
	stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
}
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
	// The rates by block uid, and whether to show them. `checked`: the tagged
	// ids the rates were asked for, when not all of them; the rest get no tag
	// until they are.
	update(
		stats: Readonly<Record<string, BlockStats>>,
		visible: boolean,
		checked?: ReadonlySet<string>,
	): void
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
	let checked: ReadonlySet<string> | undefined
	let frame: number | null = null

	const tagged = (id: string) =>
		doc.querySelector(`[${TAG_ATTRIBUTE}="${id.replace(/["\\]/g, '\\$&')}"]`)

	const render = () => {
		frame = null
		layer.replaceChildren()
		layer.hidden = !visible
		if (!visible) return
		const height = win.innerHeight
		const ids = new Set(Object.keys(stats))
		for (const element of doc.querySelectorAll(`[${TAG_ATTRIBUTE}]`)) {
			const id = element.getAttribute(TAG_ATTRIBUTE)
			if (id && (!checked || checked.has(id))) ids.add(id)
		}
		for (const id of ids) {
			const element = tagged(id) ?? doc.querySelector(selector(id))
			if (!element) continue
			const rect = element.getBoundingClientRect()
			// Not rendered, or off screen.
			if (!rect.width && !rect.height) continue
			if (rect.bottom < 0 || rect.top > height) continue

			const block = stats[id]
			const status = statsStatus(block)
			const label = doc.createElement('button')
			label.type = 'button'
			label.dataset.uid = id
			label.dataset.status = status
			const rate = block ? Math.round(block.rate * 100) : 0
			label.title =
				status === 'rate'
					? fill(labels.title, {
							clickers: block!.clickers,
							viewers: block!.viewers,
							clicks: block!.clicks,
						})
					: status === 'none'
						? labels.noClicks
						: fill(labels.counting, {
								clicks: block!.clicks,
								viewers: block!.viewers,
								needed: MIN_VIEWERS,
							})
			if (status === 'rate' && rect.height >= SMALL_HEIGHT) {
				label.className = 'badge'
				label.textContent = fill(labels.clicked, { rate })
				const { place, top, left } = placeLabel(rect, win.innerWidth)
				label.dataset.place = place
				label.style.top = `${top}px`
				label.style.left = `${left}px`
			} else {
				// A link's: on its top-right corner, like a notification badge.
				label.className = 'tag'
				if (status === 'rate')
					label.textContent = fill(labels.clickedShort, { rate })
				else
					label.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[status]}</svg>`
				label.setAttribute('aria-label', label.title)
				label.style.top = `${Math.max(rect.top, 10)}px`
				label.style.left = `${Math.min(rect.right, win.innerWidth - 10)}px`
			}
			// The block around a tagged element: its id is the block's by
			// convention, but the site may tag an element inside it.
			const uid =
				element.closest(`[${UID_ATTRIBUTE}]`)?.getAttribute(UID_ATTRIBUTE) ?? id
			label.addEventListener('click', () => onSelect(uid))
			layer.appendChild(label)
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
		update(nextStats, nextVisible, nextChecked) {
			stats = nextStats
			visible = nextVisible
			checked = nextChecked
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
