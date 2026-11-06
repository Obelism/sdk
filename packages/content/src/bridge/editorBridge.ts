import { UID_ATTRIBUTE } from '../editable'
import { PREVIEW_PARAMS } from '../preview'
import type { Entry } from '../types'
import {
	blockSelector,
	BRIDGE_SOURCE,
	type BridgeState,
	type ContentBridge,
	createBridgeState,
	createStatsView,
	EDITOR_SOURCE,
	INITIAL_STATE,
	INERT_METHODS,
	PROMPT_TIMEOUT_MS,
	type PromptResult,
	readStats,
	selectionStyle,
	showSelection,
} from './contract'
import { mountStatsOverlay } from './statsOverlay'
import { createViewportUnits } from './viewportUnits'

// The site's half of the visual editor (the CMS's public/bridge.js, as a
// module). Inside the editor's iframe it outlines blocks, tells the editor
// which one was clicked, hands the editor's live, unsaved entry to listeners
// and sends the editor prompts. Outside the editor it does nothing.
//
// `cmsOrigin` is the only origin messages are accepted from and sent to.
export const createBridge = (win: Window, cmsOrigin: string): ContentBridge => {
	const params = new URLSearchParams(win.location.search)
	const isEditing = win.parent !== win && params.has(PREVIEW_PARAMS.preview)
	const { on, getState, setState, emit, listeners } = createBridgeState({
		...INITIAL_STATE,
		selecting: true,
	})
	const cleanup: (() => void)[] = []

	const bridge: ContentBridge = {
		isEditing,
		mode: isEditing ? 'editor' : null,
		entryId: params.get(PREVIEW_PARAMS.entry),
		environment: params.get(PREVIEW_PARAMS.environment),
		product: null,
		collection: null,
		on,
		getState,
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
		if (getState().selectedUid !== (uid ?? null)) {
			setState({ selectedUid: uid ?? null })
		}
		showSelection(doc, uid, scroll)
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

	// The page's height, which an editor on another origin can't read: the
	// canvas makes its frame as tall as the page. With `ready`, and as `size`
	// whenever it changes.
	const pageHeight = () =>
		Math.ceil(
			Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0),
		)
	let sentHeight = 0
	const ready = () => {
		sentHeight = pageHeight()
		send('ready', { url: win.location.href, height: sentHeight })
	}
	const Observer = (win as Window & typeof globalThis).ResizeObserver
	if (typeof Observer === 'function') {
		const observer = new Observer(() => {
			const height = pageHeight()
			if (height === sentHeight) return
			sentHeight = height
			send('size', { height })
		})
		observer.observe(doc.documentElement)
		if (doc.body) observer.observe(doc.body)
		cleanup.push(() => observer.disconnect())
	}

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
		if (!getState().features.includes('prompt')) {
			return Promise.reject(new Error('The editor does not offer prompts here'))
		}
		const id = `prompt_${++nextId}`
		const uid = options.uid === undefined ? getState().selectedUid : options.uid
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

	const stats = createStatsView(() =>
		mountStatsOverlay(win, {
			selector: blockSelector,
			onSelect: (uid) => bridge.select(uid),
		}),
	)
	cleanup.push(() => stats.destroy())
	cleanup.push(() => {
		for (const id of pending.keys()) {
			settle(id)?.reject(new Error('The bridge was destroyed'))
		}
	})

	const viewportUnits = createViewportUnits(doc)
	cleanup.push(() => viewportUnits.destroy())

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
			height?: unknown
		} | null
		if (!data || data.source !== EDITOR_SOURCE) return

		if (data.type === 'connect') {
			// The editor asks once its listener is up: the first `ready` may
			// have been sent before it was listening.
			ready()
		} else if (data.type === 'update' && data.entry) {
			emit('update', {
				entry: data.entry,
				selectedUid: data.selectedUid ?? null,
			})
			// Re-apply the selection to whatever the site rendered.
			win.requestAnimationFrame(() => highlight(data.selectedUid, false))
			stats.refresh()
		} else if (data.type === 'select') {
			highlight(data.uid, true)
		} else if (data.type === 'saved' || data.type === 'published') {
			emit(data.type, {})
			if (listeners.update.size === 0) win.location.reload()
		} else if (data.type === 'features' && Array.isArray(data.features)) {
			setState({
				features: data.features.filter(
					(feature): feature is string => typeof feature === 'string',
				),
			})
		} else if (data.type === 'stats') {
			// An editor from before the switch sends no `visible`: show them.
			const next: Partial<BridgeState> = {
				stats: readStats(data.stats),
				statsVisible: data.visible !== false,
			}
			setState(next)
			const { stats: rates, statsVisible } = getState()
			stats.update(rates, statsVisible)
		} else if (data.type === 'viewport' && typeof data.height === 'number') {
			// The canvas: the frame is as tall as the page (`size`), so `vh`
			// sizes are fixed at the screen height it stands for.
			viewportUnits.freeze(data.height)
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
