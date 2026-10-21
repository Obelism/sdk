import { UID_ATTRIBUTE } from '../editable'
import { PREVIEW_PARAMS } from '../preview'
import type { Entry, ShopifyItem } from '../types'
import {
	type BlockStats,
	mountStatsOverlay,
	type StatsOverlay,
} from './statsOverlay'

// The site's half of the visual editor (the CMS's public/bridge.js, as a
// module). Inside the editor's iframe it outlines blocks, tells the editor
// which one was clicked, hands the editor's live, unsaved entry to listeners
// and sends the editor prompts. Outside the editor it does nothing.
//
// Messages are only exchanged with the CMS origin, and only with the parent
// window:
// - site → editor: { source: 'obelism-content-bridge', type: 'ready' |
//   'select' | 'prompt' | 'undo', uid?, id?, prompt? }
// - editor → site: { source: 'obelism-content-editor', type: 'connect' |
//   'update' | 'select' | 'saved' | 'published' | 'features' |
//   'promptResult' | 'promptState' | 'stats', … }

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
	// Editing on the site: prompts changed content that isn't saved yet.
	unsaved: boolean
	// Editing on the site: a save or publish is running.
	saving: boolean
	publishing: boolean
	// Editing on the site: clicking a block selects it instead of following
	// it (while the prompt box is open). Always true in the visual editor.
	selecting: boolean
	// In the visual editor: the blocks' click rates from Obelism numbers, by
	// uid, and whether the editor's "Show click rates" switch is on. The
	// bridge shows them on the page itself; a site can also use them.
	stats: Readonly<Record<string, BlockStats>>
	statsVisible: boolean
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

const isCount = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value) && value >= 0

// The editor's `stats`, keeping only well-formed entries.
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

// The selector of the element marked with a block's uid.
export const blockSelector = (uid: string) =>
	`[${UID_ATTRIBUTE}="${uid.replace(/["\\]/g, '\\$&')}"]`

// `cmsOrigin` is the only origin messages are accepted from and sent to.
export const createBridge = (win: Window, cmsOrigin: string): ContentBridge => {
	const params = new URLSearchParams(win.location.search)
	const isEditing = win.parent !== win && params.has(PREVIEW_PARAMS.preview)
	const emitter = createEmitter()
	const cleanup: (() => void)[] = []

	let state: BridgeState = { ...INITIAL_STATE, selecting: true }
	const setState = (next: Partial<BridgeState>) => {
		state = { ...state, ...next }
		emitter.emit('change', state)
	}

	const bridge: ContentBridge = {
		isEditing,
		mode: isEditing ? 'editor' : null,
		entryId: params.get(PREVIEW_PARAMS.entry),
		environment: params.get(PREVIEW_PARAMS.environment),
		product: null,
		collection: null,
		on: emitter.on,
		getState: () => state,
		...INERT_METHODS,
		destroy: () => {
			cleanup.splice(0).forEach((undo) => undo())
		},
	}
	if (!isEditing) return bridge

	const doc = win.document

	const send = (type: string, data: Record<string, unknown> = {}) => {
		win.parent.postMessage({ source: BRIDGE_SOURCE, type, ...data }, cmsOrigin)
	}

	const style = doc.createElement('style')
	style.textContent = selectionStyle()
	doc.head.appendChild(style)
	cleanup.push(() => style.remove())

	const highlight = (uid: string | null | undefined, scroll: boolean) => {
		doc.querySelectorAll('[data-cms-selected]').forEach((element) => {
			element.removeAttribute('data-cms-selected')
		})
		if (state.selectedUid !== (uid ?? null)) {
			setState({ selectedUid: uid ?? null })
		}
		if (!uid) return
		const element = doc.querySelector(blockSelector(uid))
		if (!element) return
		element.setAttribute('data-cms-selected', '')
		if (scroll) element.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}

	// Capture phase, so a block that is also a link selects instead of
	// navigating away.
	const onClick = (event: MouseEvent) => {
		const target = event.target as Element | null
		const element = target?.closest?.(`[${UID_ATTRIBUTE}]`)
		if (!element) return
		event.preventDefault()
		event.stopPropagation()
		const uid = element.getAttribute(UID_ATTRIBUTE)
		highlight(uid, false)
		send('select', { uid })
	}
	doc.addEventListener('click', onClick, true)
	cleanup.push(() => doc.removeEventListener('click', onClick, true))

	const ready = () => send('ready', { url: win.location.href })

	// Prompts waiting for the editor's answer, by id.
	const pending = new Map<
		string,
		{
			resolve: (result: PromptResult) => void
			reject: (error: Error) => void
			timer: ReturnType<typeof setTimeout>
		}
	>()
	let nextId = 0
	const settle = (id: string) => {
		const waiting = pending.get(id)
		if (!waiting) return null
		clearTimeout(waiting.timer)
		pending.delete(id)
		if (pending.size === 0) setState({ prompting: false })
		return waiting
	}

	bridge.prompt = (prompt, options = {}) => {
		const text = prompt.trim()
		if (!text) return Promise.reject(new Error('Say what to change'))
		if (!state.features.includes('prompt')) {
			return Promise.reject(new Error('The editor does not offer prompts here'))
		}
		const id = `prompt_${++nextId}`
		const uid = options.uid === undefined ? state.selectedUid : options.uid
		return new Promise<PromptResult>((resolve, reject) => {
			const timer = setTimeout(() => {
				settle(id)?.reject(new Error('The editor did not answer in time'))
			}, PROMPT_TIMEOUT_MS)
			pending.set(id, { resolve, reject, timer })
			setState({ prompting: true })
			send('prompt', { id, prompt: text, uid })
		})
	}
	bridge.undo = () => send('undo')
	bridge.select = (uid) => {
		highlight(uid, false)
		send('select', { uid })
	}

	// Mounted with the first rates, so pages without numbers never get it.
	let overlay: StatsOverlay | null = null
	const showStats = () => {
		if (!overlay && !Object.keys(state.stats).length) return
		overlay ??= mountStatsOverlay(win, {
			selector: blockSelector,
			onSelect: (uid) => bridge.select(uid),
		})
		overlay.update(state.stats, state.statsVisible)
	}
	cleanup.push(() => overlay?.destroy())
	cleanup.push(() => {
		for (const id of pending.keys()) {
			settle(id)?.reject(new Error('The bridge was destroyed'))
		}
	})

	const onMessage = (event: MessageEvent) => {
		if (event.origin !== cmsOrigin || event.source !== win.parent) return
		const data = event.data as {
			source?: unknown
			type?: unknown
			entry?: Entry
			uid?: string | null
			selectedUid?: string | null
			features?: unknown
			id?: unknown
			ok?: unknown
			summary?: unknown
			error?: unknown
			canUndo?: unknown
			stats?: unknown
			visible?: unknown
		} | null
		if (!data || data.source !== EDITOR_SOURCE) return

		if (data.type === 'connect') {
			// The editor asks once its listener is up: the first `ready` may
			// have been sent before it was listening.
			ready()
		} else if (data.type === 'update' && data.entry) {
			emitter.emit('update', {
				entry: data.entry,
				selectedUid: data.selectedUid ?? null,
			})
			// Re-apply the selection to whatever the site rendered.
			win.requestAnimationFrame(() => highlight(data.selectedUid, false))
			overlay?.refresh()
		} else if (data.type === 'select') {
			highlight(data.uid, true)
		} else if (data.type === 'saved' || data.type === 'published') {
			emitter.emit(data.type, {})
			if (emitter.listeners.update.size === 0) win.location.reload()
		} else if (data.type === 'features' && Array.isArray(data.features)) {
			setState({
				features: data.features.filter(
					(feature): feature is string => typeof feature === 'string',
				),
			})
		} else if (data.type === 'stats') {
			// An editor from before the switch sends no `visible`: show them.
			setState({
				stats: readStats(data.stats),
				statsVisible: data.visible !== false,
			})
			showStats()
		} else if (data.type === 'promptState') {
			setState({ canUndo: data.canUndo === true })
		} else if (data.type === 'promptResult' && typeof data.id === 'string') {
			const waiting = settle(data.id)
			if (!waiting) return
			if (data.ok === true) {
				waiting.resolve({
					summary: typeof data.summary === 'string' ? data.summary : '',
				})
			} else {
				waiting.reject(
					new Error(
						typeof data.error === 'string' ? data.error : 'The prompt failed',
					),
				)
			}
		}
	}
	win.addEventListener('message', onMessage)
	cleanup.push(() => win.removeEventListener('message', onMessage))

	if (doc.readyState === 'loading') {
		doc.addEventListener('DOMContentLoaded', ready, { once: true })
		cleanup.push(() => doc.removeEventListener('DOMContentLoaded', ready))
	} else {
		ready()
	}

	return bridge
}

// The bridge from the CMS's <script src=".../bridge.js"> tag, if a page has
// both: one bridge per page, so this wraps it instead of starting a second.
// That script predates prompts, so this bridge offers none.
type ScriptBridge = {
	isEditing: boolean
	entryId: string | null
	on: (event: string, listener: (payload: unknown) => void) => void
}

export const wrapScriptBridge = (
	script: ScriptBridge,
	params: URLSearchParams,
): ContentBridge => {
	const emitter = createEmitter()
	script.on('saved', () => emitter.emit('saved', {}))
	script.on('published', () => emitter.emit('published', {}))
	// Only once something listens: bridge.js reloads after a save while it has
	// no `update` listener, and has no way to remove one.
	let forwardingUpdates = false
	return {
		isEditing: script.isEditing,
		mode: script.isEditing ? 'editor' : null,
		entryId: script.entryId,
		environment: params.get(PREVIEW_PARAMS.environment),
		product: null,
		collection: null,
		on: (event, listener) => {
			if (event === 'update' && !forwardingUpdates) {
				forwardingUpdates = true
				script.on('update', (payload) => {
					const entry = (payload as { entry?: Entry } | null)?.entry
					if (entry) emitter.emit('update', { entry, selectedUid: null })
				})
			}
			return emitter.on(event, listener)
		},
		getState: () => INITIAL_STATE,
		...INERT_METHODS,
		destroy: () => {},
	}
}
