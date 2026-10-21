import {
	type ContentBridge,
	createBridge,
	wrapScriptBridge,
} from './bridge/createBridge'
import { mountPromptBox, type PromptBoxOptions } from './bridge/promptBox'
import { createSiteBridge, readSiteEditing } from './bridge/siteBridge'
import { DEFAULT_URL, normalizeUrl } from './config'

export type {
	ApplyJsonResult,
	BridgeEvent,
	BridgeEvents,
	BridgeListener,
	BridgeState,
	ContentBridge,
	CreatePageResult,
	CreateCollectionPageResult,
	CreateProductPageResult,
	FormHandle,
	FormOptions,
	PromptResult,
	SitePage,
} from './bridge/createBridge'
export { INITIAL_STATE } from './bridge/createBridge'
export { DEFAULT_PROMPT_LABELS, mountPromptBox } from './bridge/promptBox'
export { DEFAULT_STATS_LABELS, mountStatsOverlay } from './bridge/statsOverlay'
export type {
	BlockStats,
	StatsLabels,
	StatsOverlay,
} from './bridge/statsOverlay'
export type { PromptBoxOptions, PromptLabels } from './bridge/promptBox'

export type BridgeOptions = {
	// The CMS the editor runs on; the only origin the bridge talks to.
	// Default: https://content.obelism.studio
	url?: string | undefined
	// The prompt box editors change the page with (shown only inside the
	// visual editor or on a site signed in to edit, to people who may edit).
	// `false` leaves it out, e.g. to build your own with `bridge.prompt()`.
	// Default: shown.
	prompt?: boolean | PromptBoxOptions | undefined
	// Editing on the site: where a CMS path (`solutions/agencies`) in a
	// locale is on the site, to open a page made with "New page" or picked
	// from the pages (the path is the one in that locale). Default: `/` +
	// path.
	pagePath?: ((path: string, locale: string) => string) | undefined
	// Editing on the site: where a product page is on the site, by its
	// product's handle, in a locale: your product route, which looks its page
	// up by product. Default: the environment's product path in the CMS
	// (Settings → Preview URL), `/products/{handle}` unless changed.
	productPath?: ((handle: string, locale: string) => string) | undefined
	// The same for a collection page: your collection route. Default: the
	// environment's collection path in the CMS, `/collections/{handle}`
	// unless changed.
	collectionPath?: ((handle: string, locale: string) => string) | undefined
}

// Kept on the window, so two copies of this package on one page still share
// one bridge.
const KEY = Symbol.for('@obelism/content/bridge')

type BridgeWindow = Window & {
	[KEY]?: ContentBridge
	ObelismBridge?: Parameters<typeof wrapScriptBridge>[0]
}

const SERVER_BRIDGE: ContentBridge = wrapScriptBridge(
	{ isEditing: false, entryId: null, on: () => {} },
	new URLSearchParams(),
)

// The page's bridge if something already started it, else null. Never
// starts one: for code that has to stay side-effect free, like a React
// store's snapshot.
export const peekContentBridge = (): ContentBridge | null =>
	typeof window === 'undefined' ? null : ((window as BridgeWindow)[KEY] ?? null)

// The page's bridge to the visual editor — or, on a site signed in to edit,
// its stand-in — started on first use. Call it in the browser (on the server
// it returns an inert bridge):
//
//   const bridge = getContentBridge()
//   if (bridge.isEditing) bridge.on('update', ({ entry }) => render(entry))
//
// The first call's options win: there is one bridge per page.
export const getContentBridge = ({
	url,
	prompt = true,
	pagePath,
	productPath,
	collectionPath,
}: BridgeOptions = {}): ContentBridge => {
	if (typeof window === 'undefined') return SERVER_BRIDGE
	const win = window as BridgeWindow
	if (win[KEY]) return win[KEY]

	let bridge: ContentBridge
	if (win.ObelismBridge) {
		bridge = wrapScriptBridge(
			win.ObelismBridge,
			new URLSearchParams(win.location.search),
		)
	} else {
		bridge = createBridge(win, normalizeUrl(url || DEFAULT_URL))
		// Not in the visual editor, but signed in to edit through the site's
		// own `/cms/login` (@obelism/content/site).
		const sitePath =
			bridge.isEditing || win.parent !== win
				? null
				: readSiteEditing(win.document)
		if (sitePath)
			bridge = createSiteBridge(win, sitePath, {
				pagePath,
				productPath,
				collectionPath,
			})
		if (bridge.isEditing && prompt) {
			const doc = win.document
			let unmount = () => {}
			let destroyed = false
			const mount = () => {
				if (destroyed) return
				unmount = mountPromptBox(doc, bridge, prompt === true ? {} : prompt)
			}
			// A script tag in <head> runs before there is a body to mount into.
			if (doc.body) mount()
			else doc.addEventListener('DOMContentLoaded', mount, { once: true })
			const destroy = bridge.destroy
			bridge.destroy = () => {
				destroyed = true
				doc.removeEventListener('DOMContentLoaded', mount)
				unmount()
				destroy()
			}
		}
	}
	win[KEY] = bridge
	return bridge
}
