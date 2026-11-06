import { UID_ATTRIBUTE } from '../editable'
import type { Entry, ShopifyItem } from '../types'
import type { BlockStats, StatsOverlay } from './statsOverlay'

// What every bridge to the visual editor offers, and the pieces both of them
// are built from: the state and its emitter, block selection, the click-rate
// labels. The editor's own bridge is editorBridge.ts, editing on the site is
// siteBridge.ts, and the CMS's old script tag is scriptBridge.ts.

// Messages are only exchanged with the CMS origin, and only with the parent
// window:
// - site → editor: { source: 'obelism-content-bridge', type: 'ready' |
//   'size' | 'select' | 'prompt' | 'undo', uid?, id?, prompt?, height? }
// - editor → site: { source: 'obelism-content-editor', type: 'connect' |
//   'update' | 'select' | 'saved' | 'published' | 'features' |
//   'promptResult' | 'promptState' | 'stats' | 'viewport', … }
export const BRIDGE_SOURCE = 'obelism-content-bridge'
export const EDITOR_SOURCE = 'obelism-content-editor'

// How long a prompt may take before it counts as failed.
export const PROMPT_TIMEOUT_MS = 120_000

export type BridgeEvents = {
	// The entry being edited, shaped exactly like a delivery API entry for a
	// preview token, built from the unsaved draft. Sent while typing.
	update: { entry: Entry; selectedUid: string | null }
	saved: Record<string, never>
	published: Record<string, never>
	// `getState()` changed.
	change: BridgeState
}

export type BridgeEvent = keyof BridgeEvents

export type BridgeListener<E extends BridgeEvent> = (
	payload: BridgeEvents[E],
) => void

export type BridgeState = {
	// What the editor offers this site: 'prompt' (editing by prompt, for
	// people who may edit content), and when editing on the site itself
	// also 'create' (new pages), 'save' and 'publish'. Empty until the editor
	// says.
	features: readonly string[]
	// The block selected on the page or in the editor, null for none.
	selectedUid: string | null
	// A prompt, a new page or applied JSON is running.
	prompting: boolean
	// The editor can undo the last prompt.
	canUndo: boolean
	// Editing on the site: how many steps `undo()` can take back.
	undoSteps?: number | undefined
	// Editing on the site: prompts changed content that isn't saved yet.
	unsaved: boolean
	// Editing on the site: a save or publish is running.
	saving: boolean
	publishing: boolean
	// Editing on the site: clicking a block selects it instead of following
	// it (while the prompt box is open). Always true in the visual editor.
	selecting: boolean
	// The blocks' click rates from Obelism Numbers, by uid, and whether they
	// show: the visual editor's "Show click rates" switch, or on the site
	// while blocks are outlined. The bridge shows them on the page itself; a
	// site can also use them.
	stats: Readonly<Record<string, BlockStats>>
	statsVisible: boolean
}

export const INITIAL_STATE: BridgeState = {
	features: [],
	selectedUid: null,
	prompting: false,
	canUndo: false,
	unsaved: false,
	saving: false,
	publishing: false,
	selecting: false,
	stats: {},
	statsVisible: false,
}

export type PromptResult = { summary: string }

export type CreatePageResult = {
	summary: string
	// The new page's entry and CMS path (`solutions/agencies`)…
	entryId: string
	path: string
	// …and where it is on the site, which the bridge opens.
	url: string
}

// A product (collection) page made from the site (`createProductPage`,
// `createCollectionPage`): the new one, or the one the product (collection)
// had already (`created: false`).
export type CreateProductPageResult = {
	entryId: string
	path: string
	created: boolean
}
export type CreateCollectionPageResult = CreateProductPageResult

export type ApplyJsonResult = {
	// The fields (apiIds) the JSON changed; empty when it changed nothing.
	changed: string[]
	// The JSON again, as the CMS applied it (from CMS versions that send it).
	view?: Record<string, unknown> | undefined
}

export type FormOptions = {
	// The iframe's title, for screen readers. Default: 'Content form'.
	title?: string | undefined
	// The form shows and can be edited.
	onReady?: (() => void) | undefined
	// It couldn't open, or the CMS reports a problem in it.
	onError?: ((message: string) => void) | undefined
	// Escape was pressed in it (from CMS versions that say so).
	onEscape?: (() => void) | undefined
}

export type FormHandle = {
	// Removes the form; its one-time address is spent.
	close(): void
}

// A page of the site, from `pages()`: every page entry of the space
// environment, drafts included.
export type SitePage = {
	entryId: string
	name: string
	contentType: string
	// 'changed': published, with a newer draft.
	status: 'draft' | 'published' | 'changed'
	// The CMS path in the page's locale (`solutions/agencies`, '' for the
	// home page; the default locale's, or any, when it has none there)…
	path: string
	// …and where it is on the site (`pagePath`, or `productPath` for a
	// product page, `collectionPath` for a collection page).
	url: string
	// A product page's product (a page whose type has a unique product
	// field), else null.
	product: ShopifyItem | null
	// A collection page's collection (a unique collection field), else null.
	collection: ShopifyItem | null
}

export type ContentBridge = {
	// True inside the visual editor, and on a site signed in to edit.
	readonly isEditing: boolean
	// Where: inside the visual editor's iframe, or on the site itself after
	// signing in through its `/cms/login` (@obelism/content/site).
	readonly mode: 'editor' | 'site' | null
	// The entry being edited (on the site: the page's, see `editable`).
	readonly entryId: string | null
	// On the site: the session's, once it loaded.
	readonly environment: string | null
	// Editing on the site: the Shopify product the page shows (marked with
	// `editableProduct`), else null.
	readonly product: ShopifyItem | null
	// …and the collection (marked with `editableCollection`), else null.
	readonly collection: ShopifyItem | null
	// Returns a function that removes the listener. While no `update` listener
	// is registered the page reloads after every save, to show the draft.
	on<E extends BridgeEvent>(event: E, listener: BridgeListener<E>): () => void
	// The current state; a new object whenever it changes (see `change`).
	getState(): BridgeState
	// Asks the editor to change the entry — or the block `uid`, the selected
	// one by default — as `prompt` says. The change lands in the editor's
	// unsaved draft, so the page updates through `update` like any edit.
	// Rejects with the editor's reason when it can't.
	prompt(
		prompt: string,
		options?: { uid?: string | null },
	): Promise<PromptResult>
	// Editing on the site: a new page at `path` (`/pricing`, or under an
	// existing page), written from `prompt` like the page it is on, and
	// stored as a draft straight away. Then opens it.
	createPage(path: string, prompt: string): Promise<CreatePageResult>
	// Editing on the site: a product page for `product` (the page's, see
	// `editableProduct`), stored as a draft of the space's product page type
	// with the product's handle as slug, or the one it has already. Then
	// reloads the page, which now finds it.
	createProductPage(product?: ShopifyItem): Promise<CreateProductPageResult>
	// The same for a collection (the page's, see `editableCollection`), as a
	// draft of the space's collection page type.
	createCollectionPage(
		collection?: ShopifyItem,
	): Promise<CreateCollectionPageResult>
	// Editing on the site: the entry — or the block `uid`, the selected one
	// by default — as JSON, the way a language model sees it: one locale,
	// rich text as Markdown, blocks with `_uid` and `_type`. With the changes
	// made here that aren't saved yet. The raw alternative to `openForm`.
	view(options?: {
		uid?: string | null | undefined
	}): Promise<Record<string, unknown>>
	// Editing on the site: applies `changes` (fields by apiId, shaped like
	// `view()`) to the entry or block, like a prompt's answer: checked the
	// same way, into the unsaved changes, undone with `undo()`. The raw
	// alternative to `openForm`.
	applyJson(
		changes: Record<string, unknown>,
		options?: { uid?: string | null | undefined },
	): Promise<ApplyJsonResult>
	// Editing on the site: the CMS's own form for the page's entry — or the
	// entry around the selected block — in an iframe in `container`. Edits in
	// it land in the unsaved changes as they are made (one undo step per
	// burst of edits) and show on the page; prompts, undo and a new selection
	// show in it. One form at a time: opening another closes this one.
	openForm(container: HTMLElement, options?: FormOptions): FormHandle
	// Editing on the site: the space's pages, to go to one with `openPage`.
	pages(): Promise<SitePage[]>
	// Editing on the site: opens a page from `pages()`, after asking when
	// changes aren't saved.
	openPage(page: SitePage): void
	// Undoes the last prompt in the editor.
	undo(): void
	// Editing on the site: stores the changed content as drafts…
	save(): Promise<void>
	// …and publishes the page (and anything else changed here).
	publish(): Promise<void>
	// Editing on the site: signs out and turns draft mode off.
	signOut(): void
	// Editing on the site: whether clicks select blocks. The prompt box turns
	// it on while open.
	setSelecting(selecting: boolean): void
	// Selects a block, or nothing, on the page and in the editor.
	select(uid: string | null): void
	// Removes everything the bridge added to the page.
	destroy(): void
}

const OUTLINE = '#d58a1f'

// Outlines on blocks; `scope` limits them to e.g. `html[data-cms-selecting] `.
export const selectionStyle = (scope = '') =>
	`${scope}[${UID_ATTRIBUTE}]{cursor:pointer;transition:outline-color .15s}` +
	`${scope}[${UID_ATTRIBUTE}]:hover{outline:2px dashed ${OUTLINE};outline-offset:2px}` +
	`${scope}[${UID_ATTRIBUTE}][data-cms-selected]{outline:2px solid ${OUTLINE};outline-offset:2px}`

// The selector of the element marked with a block's uid.
export const blockSelector = (uid: string) =>
	`[${UID_ATTRIBUTE}="${uid.replace(/["\\]/g, '\\$&')}"]`

type Listeners = { [E in BridgeEvent]: Set<BridgeListener<E>> }

export const createEmitter = () => {
	const listeners: Listeners = {
		update: new Set(),
		saved: new Set(),
		published: new Set(),
		change: new Set(),
	}
	return {
		listeners,
		on<E extends BridgeEvent>(event: E, listener: BridgeListener<E>) {
			listeners[event].add(listener)
			return () => {
				listeners[event].delete(listener)
			}
		},
		emit<E extends BridgeEvent>(event: E, payload: BridgeEvents[E]) {
			for (const listener of listeners[event]) {
				try {
					listener(payload)
				} catch (error) {
					console.error('[@obelism/content bridge]', error)
				}
			}
		},
	}
}

// The state both bridges keep, and the emitter that says it changed.
export const createBridgeState = (initial: BridgeState = INITIAL_STATE) => {
	const emitter = createEmitter()
	let state = initial
	return {
		...emitter,
		getState: () => state,
		setState(next: Partial<BridgeState>) {
			state = { ...state, ...next }
			emitter.emit('change', state)
		},
	}
}

// Outlines the block's element on the page, and nothing else, in view when
// `scroll`.
export const showSelection = (
	doc: Document,
	uid: string | null | undefined,
	scroll = false,
) => {
	for (const element of doc.querySelectorAll('[data-cms-selected]')) {
		element.removeAttribute('data-cms-selected')
	}
	const element = uid ? doc.querySelector(blockSelector(uid)) : null
	if (!element) return
	element.setAttribute('data-cms-selected', '')
	if (scroll) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// The click rates on the page: mounted with the first rates, so a page
// without Numbers never gets it, then kept.
export const createStatsView = (mount: () => StatsOverlay) => {
	let overlay: StatsOverlay | null = null
	return {
		update(stats: Readonly<Record<string, BlockStats>>, visible: boolean) {
			if (!overlay && Object.keys(stats).length === 0) return
			overlay ??= mount()
			overlay.update(stats, visible)
		},
		refresh: () => overlay?.refresh(),
		destroy: () => overlay?.destroy(),
	}
}

// The rates the page can show, from the editor's `stats` message: only
// well-formed entries.
const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0

export const readStats = (value: unknown): Record<string, BlockStats> => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
	const stats: Record<string, BlockStats> = {}
	for (const [uid, block] of Object.entries(value)) {
		const { clicks, clickers, viewers, rate } = (block ?? {}) as Record<
			string,
			unknown
		>
		if (
			isCount(clicks) &&
			isCount(clickers) &&
			isCount(viewers) &&
			isCount(rate)
		)
			stats[uid] = { clicks, clickers, viewers, rate }
	}
	return stats
}

const inertPrompt = () =>
	Promise.reject(new Error('Prompts only work inside the visual editor'))

const onlyOnSite = () =>
	Promise.reject(new Error('Save and publish in the visual editor itself'))

const onlyWhileEditingSite = () =>
	Promise.reject(new Error('Only while signed in to edit on the site'))

// What every bridge without a feature does for it.
export const INERT_METHODS = {
	prompt: inertPrompt,
	createPage: () =>
		Promise.reject(new Error('New pages are made on the site itself')),
	createProductPage: () =>
		Promise.reject(new Error('Product pages are made on the site itself')),
	createCollectionPage: () =>
		Promise.reject(new Error('Collection pages are made on the site itself')),
	view: onlyWhileEditingSite,
	applyJson: onlyWhileEditingSite,
	openForm: (_container: HTMLElement, options: FormOptions = {}) => {
		queueMicrotask(() =>
			options.onError?.('Only while signed in to edit on the site'),
		)
		return { close: () => {} }
	},
	pages: onlyWhileEditingSite,
	openPage: () => {},
	undo: () => {},
	save: onlyOnSite,
	publish: onlyOnSite,
	signOut: () => {},
	select: () => {},
	setSelecting: () => {},
} satisfies Partial<ContentBridge>

// A bridge for a page where nothing can be edited.
export const createInertBridge = (): ContentBridge => {
	const emitter = createEmitter()
	return {
		isEditing: false,
		mode: null,
		entryId: null,
		environment: null,
		product: null,
		collection: null,
		on: emitter.on,
		getState: () => INITIAL_STATE,
		...INERT_METHODS,
		destroy: () => {},
	}
}
