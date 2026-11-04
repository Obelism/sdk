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

const INSET = 8
// Below this an element is a button or a link, not a section: a tag on its
// corner rather than a label over it.
const SMALL_HEIGHT = 64

// A block's label: inside its top-right corner, in view when it starts above
// the screen.
export const placeLabel = (rect: Pick<DOMRect, 'top' | 'right'>) => ({
	top: Math.max(rect.top, 0) + INSET,
	left: rect.right - INSET,
})

// A tag's: on the element's top-right corner, like a notification badge,
// kept on screen.
export const placeTag = (
	rect: Pick<DOMRect, 'top' | 'right'>,
	viewport: { width: number; height: number },
) => ({
	top: Math.min(Math.max(rect.top, 10), viewport.height - 10),
	left: Math.min(rect.right, viewport.width - 10),
})

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
		checked,
		labels: labelOverrides,
	}: {
		// The element of a block, by its uid.
		selector: (uid: string) => string
		// A label is a way to select its block too.
		onSelect: (uid: string) => void
		// Whether the rates were asked for a tagged id, so no rate means no
		// clicks. Default: the ids of the page's blocks, which the visual
		// editor asks for.
		checked?: ((id: string) => boolean) | undefined
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

	const draw = (id: string, element: Element, blocks: ReadonlySet<string>) => {
		const rect = element.getBoundingClientRect()
		// Not rendered, or off screen.
		if (!rect.width && !rect.height) return
		if (rect.bottom < 0 || rect.top > win.innerHeight) return

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
		const { top, left } =
			status === 'rate' && rect.height >= SMALL_HEIGHT
				? placeLabel(rect)
				: placeTag(rect, { width: win.innerWidth, height: win.innerHeight })
		if (status === 'rate' && rect.height >= SMALL_HEIGHT) {
			label.className = 'badge'
			label.textContent = fill(labels.clicked, { rate })
		} else {
			label.className = 'tag'
			if (status === 'rate')
				label.textContent = fill(labels.clickedShort, { rate })
			else
				label.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[status]}</svg>`
			label.setAttribute('aria-label', label.title)
		}
		label.style.top = `${top}px`
		label.style.left = `${left}px`
		// Its id names a block by convention; else the block around it.
		const uid = blocks.has(id)
			? id
			: element.closest(`[${UID_ATTRIBUTE}]`)?.getAttribute(UID_ATTRIBUTE)
		if (uid) label.addEventListener('click', () => onSelect(uid))
		layer.appendChild(label)
	}

	const render = () => {
		frame = null
		layer.replaceChildren()
		layer.hidden = !visible
		if (!visible) return
		const blocks = new Set<string>()
		for (const element of doc.querySelectorAll(`[${UID_ATTRIBUTE}]`))
			blocks.add(element.getAttribute(UID_ATTRIBUTE) ?? '')
		const isChecked = checked ?? ((id: string) => blocks.has(id))
		const tagged = new Set<string>()
		for (const element of doc.querySelectorAll(`[${TAG_ATTRIBUTE}]`)) {
			const id = element.getAttribute(TAG_ATTRIBUTE)
			if (!id || (!stats[id] && !isChecked(id))) continue
			tagged.add(id)
			draw(id, element, blocks)
		}
		// Rates of blocks the site doesn't tag an element of.
		for (const id of Object.keys(stats)) {
			if (tagged.has(id) || !blocks.has(id)) continue
			const element = doc.querySelector(selector(id))
			if (element) draw(id, element, blocks)
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
