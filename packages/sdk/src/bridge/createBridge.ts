import { UID_ATTRIBUTE } from '../editable'
import { PREVIEW_PARAMS } from '../preview'
import type { Entry } from '../types'

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
//   'promptResult' | 'promptState', … }

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
	// A prompt (or a new page) is running.
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

export type ContentBridge = {
	// True inside the visual editor, and on a site signed in to edit.
	readonly isEditing: boolean
	// Where: inside the visual editor's iframe, or on the site itself after
	// signing in through its `/cms/login` (@obelism/content/site).
	readonly mode: 'editor' | 'site' | null
	// The entry being edited (on the site: the page's, see `editable`).
	readonly entryId: string | null
	readonly environment: string | null
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

// What every bridge without a feature does for it.
export const INERT_METHODS = {
	prompt: inertPrompt,
	createPage: () =>
		Promise.reject(new Error('New pages are made on the site itself')),
	undo: () => {},
	save: onlyOnSite,
	publish: onlyOnSite,
	signOut: () => {},
	select: () => {},
	setSelecting: () => {},
} satisfies Partial<ContentBridge>

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
