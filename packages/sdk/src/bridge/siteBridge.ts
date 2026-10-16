import { ENTRY_ATTRIBUTE, UID_ATTRIBUTE } from '../editable'
import { SITE_EDITING_COOKIE, SITE_REQUEST_HEADER } from '../site'
import type { Entry } from '../types'
import {
	blockSelector,
	type BridgeState,
	type ContentBridge,
	type CreatePageResult,
	createEmitter,
	INITIAL_STATE,
	type PromptResult,
	selectionStyle,
} from './createBridge'

// The bridge on a site signed in to edit (`/cms/login`, from
// @obelism/content/site), outside the visual editor. It plays the editor's
// part itself: it keeps the changed content in memory, asks the site's
// `/cms/api/…` (which forwards to the CMS with the session's token) to apply
// prompts and to shape the content for rendering, hands that to `update`
// listeners like the editor would, and saves or publishes on request.
//
// What it edits is the page's entry — the outermost element marked with
// `editable(entry)` — or, for a selected block, the entry around that block.

// The base path of the site's handler while signed in to edit, else null.
export const readSiteEditing = (doc: Document): string | null => {
	for (const part of doc.cookie.split(';')) {
		const [name, ...value] = part.trim().split('=')
		if (name !== SITE_EDITING_COOKIE) continue
		try {
			const basePath = decodeURIComponent(value.join('='))
			return basePath.startsWith('/') && !basePath.startsWith('//')
				? basePath
				: null
		} catch {
			return null
		}
	}
	return null
}

type SessionInfo = {
	features: string[]
	space: { defaultLocale: string; locales: { code: string }[] }
}

type Working = {
	// The content as edited here, and as last stored.
	content: unknown
	saved: unknown
	revision: number
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export type SiteBridgeOptions = {
	// Where a CMS path (`solutions/agencies`) is on the site. Default: `/` + path.
	pagePath?: ((path: string) => string) | undefined
}

export const createSiteBridge = (
	win: Window,
	basePath: string,
	{ pagePath = (path) => `/${path}` }: SiteBridgeOptions = {},
): ContentBridge => {
	const doc = win.document
	const emitter = createEmitter()
	const cleanup: (() => void)[] = []
	const working = new Map<string, Working>()
	// Content before each prompt, newest last, for undo.
	const history: { entryId: string; content: unknown }[] = []
	// Entries changed here since the last publish.
	const touched = new Set<string>()
	let session: SessionInfo | null = null

	let state: BridgeState = INITIAL_STATE
	const setState = (next: Partial<BridgeState>) => {
		state = { ...state, ...next }
		emitter.emit('change', state)
	}
	const refreshUnsaved = () =>
		setState({
			unsaved: [...working.values()].some(
				({ content, saved }) => !same(content, saved),
			),
			canUndo: history.length > 0,
		})

	const api = async <T>(path: string, body?: unknown): Promise<T> => {
		const response = await win.fetch(
			`${basePath}/api/${path}`,
			body === undefined
				? { credentials: 'same-origin' }
				: {
						method: 'POST',
						credentials: 'same-origin',
						headers: {
							'Content-Type': 'application/json',
							[SITE_REQUEST_HEADER]: '1',
						},
						body: JSON.stringify(body),
					},
		)
		const data = (await response.json().catch(() => ({}))) as {
			error?: unknown
		}
		if (response.status === 401) {
			setState({ features: [] })
			throw new Error('You were signed out. Sign in again to edit.')
		}
		if (!response.ok) {
			throw new Error(
				typeof data.error === 'string'
					? data.error
					: `Obelism Content answered ${response.status}`,
			)
		}
		return data as T
	}

	const pageEntryId = () =>
		doc.querySelector(`[${ENTRY_ATTRIBUTE}]`)?.getAttribute(ENTRY_ATTRIBUTE) ??
		null

	const entryFor = (uid: string | null) => {
		const block = uid ? doc.querySelector(blockSelector(uid)) : null
		return (
			block?.closest(`[${ENTRY_ATTRIBUTE}]`)?.getAttribute(ENTRY_ATTRIBUTE) ??
			pageEntryId()
		)
	}

	// The page's language when the space has it (or its base language), else
	// the space's default.
	const locale = () => {
		if (!session) return undefined
		const codes = session.space.locales.map(({ code }) => code)
		const lang = doc.documentElement.lang
		if (codes.includes(lang)) return lang
		const base = lang.split('-')[0] ?? ''
		return codes.includes(base) ? base : session.space.defaultLocale
	}

	const load = async (entryId: string) => {
		const loaded = working.get(entryId)
		if (loaded) return loaded
		const entry = await api<{ content: unknown; draftRevision: number }>(
			`entries/${encodeURIComponent(entryId)}`,
		)
		const fresh = {
			content: entry.content,
			saved: entry.content,
			revision: entry.draftRevision,
		}
		working.set(entryId, fresh)
		return fresh
	}

	const highlight = (uid: string | null) => {
		doc.querySelectorAll('[data-cms-selected]').forEach((element) => {
			element.removeAttribute('data-cms-selected')
		})
		if (state.selectedUid !== uid) setState({ selectedUid: uid })
		if (uid)
			doc
				.querySelector(blockSelector(uid))
				?.setAttribute('data-cms-selected', '')
	}

	// Shows the in-memory content through `update`, shaped like the delivery
	// API. A page without `update` listeners shows it once saved (it reloads).
	const render = async (entryId: string) => {
		if (emitter.listeners.update.size === 0) return
		const content = working.get(entryId)?.content
		const { entry } = await api<{ entry: Entry }>(
			`entries/${encodeURIComponent(entryId)}/preview`,
			{ content, locale: locale() },
		)
		emitter.emit('update', { entry, selectedUid: state.selectedUid })
		win.requestAnimationFrame(() => highlight(state.selectedUid))
	}

	const afterStore = (event: 'saved' | 'published') => {
		emitter.emit(event, {})
		if (emitter.listeners.update.size === 0) win.location.reload()
	}

	const saveAll = async () => {
		for (const [entryId, entry] of working) {
			if (same(entry.content, entry.saved)) continue
			const { draftRevision } = await api<{ draftRevision: number }>(
				`entries/${encodeURIComponent(entryId)}/save`,
				{ content: entry.content, baseRevision: entry.revision },
			)
			entry.saved = entry.content
			entry.revision = draftRevision
			touched.add(entryId)
		}
		history.length = 0
		refreshUnsaved()
	}

	const has = (feature: string) => state.features.includes(feature)

	const bridge: ContentBridge = {
		isEditing: true,
		mode: 'site',
		get entryId() {
			return pageEntryId()
		},
		environment: null,
		on: emitter.on,
		getState: () => state,

		async prompt(prompt, options = {}): Promise<PromptResult> {
			const text = prompt.trim()
			if (!text) throw new Error('Say what to change')
			if (!has('prompt')) throw new Error('You may not edit content here')
			const uid = options.uid === undefined ? state.selectedUid : options.uid
			const entryId = entryFor(uid)
			if (!entryId) {
				throw new Error(
					'Nothing on this page is marked as an entry: add editable(entry)',
				)
			}
			setState({ prompting: true })
			try {
				const entry = await load(entryId)
				const result = await api<{ content: unknown; summary: string }>(
					`entries/${encodeURIComponent(entryId)}/prompt`,
					{ prompt: text, content: entry.content, locale: locale(), uid },
				)
				history.push({ entryId, content: entry.content })
				entry.content = result.content
				refreshUnsaved()
				await render(entryId)
				return { summary: result.summary }
			} finally {
				setState({ prompting: false })
			}
		},

		async createPage(path, prompt): Promise<CreatePageResult> {
			const text = prompt.trim()
			if (!text) throw new Error('Say what the page is for')
			if (!path.trim())
				throw new Error('Say where the page goes, like /pricing')
			if (!has('create')) throw new Error('You may not add pages here')
			// Opening the new page would lose them.
			if (state.unsaved) {
				throw new Error('Save or undo your changes before adding a page')
			}
			setState({ prompting: true })
			try {
				const created = await api<{
					entryId: string
					path: string
					summary: string
				}>('entries', {
					path,
					prompt: text,
					locale: locale(),
					from: pageEntryId(),
				})
				const url = pagePath(created.path)
				win.location.assign(url)
				return {
					summary: created.summary,
					entryId: created.entryId,
					path: created.path,
					url,
				}
			} finally {
				setState({ prompting: false })
			}
		},

		undo() {
			const last = history.pop()
			const entry = last && working.get(last.entryId)
			if (!last || !entry) return
			entry.content = last.content
			refreshUnsaved()
			void render(last.entryId).catch((error: unknown) =>
				console.error('[@obelism/content bridge]', error),
			)
		},

		async save() {
			if (!has('save')) throw new Error('You may not edit content here')
			setState({ saving: true })
			try {
				await saveAll()
			} finally {
				setState({ saving: false })
			}
			afterStore('saved')
		},

		async publish() {
			if (!has('publish')) throw new Error('You may not publish here')
			setState({ publishing: true })
			try {
				await saveAll()
				const page = pageEntryId()
				const entries = touched.size > 0 ? [...touched] : page ? [page] : []
				if (entries.length === 0) {
					throw new Error(
						'Nothing on this page is marked as an entry: add editable(entry)',
					)
				}
				for (const entryId of entries) {
					await api(`entries/${encodeURIComponent(entryId)}/publish`, {})
					touched.delete(entryId)
				}
			} finally {
				setState({ publishing: false })
			}
			afterStore('published')
		},

		signOut() {
			if (
				state.unsaved &&
				!win.confirm('Sign out and lose the changes you have not saved?')
			) {
				return
			}
			working.clear()
			refreshUnsaved()
			const returnTo = win.location.pathname + win.location.search
			win.location.href = `${basePath}/logout?return_to=${encodeURIComponent(returnTo)}`
		},

		select(uid) {
			highlight(uid)
		},

		setSelecting(selecting) {
			if (selecting) doc.documentElement.setAttribute('data-cms-selecting', '')
			else doc.documentElement.removeAttribute('data-cms-selecting')
			setState({ selecting })
		},

		destroy() {
			cleanup.splice(0).forEach((undo) => undo())
		},
	}

	const style = doc.createElement('style')
	style.textContent = selectionStyle('html[data-cms-selecting] ')
	doc.head.appendChild(style)
	cleanup.push(() => style.remove())
	cleanup.push(() => doc.documentElement.removeAttribute('data-cms-selecting'))

	// Capture phase, so a block that is also a link selects instead of
	// navigating — only while selecting, so the site stays usable.
	const onClick = (event: MouseEvent) => {
		if (!state.selecting) return
		const target = event.target as Element | null
		const element = target?.closest?.(`[${UID_ATTRIBUTE}]`)
		if (!element) return
		event.preventDefault()
		event.stopPropagation()
		highlight(element.getAttribute(UID_ATTRIBUTE))
	}
	doc.addEventListener('click', onClick, true)
	cleanup.push(() => doc.removeEventListener('click', onClick, true))

	const onBeforeUnload = (event: BeforeUnloadEvent) => {
		if (!state.unsaved) return
		event.preventDefault()
		event.returnValue = ''
	}
	win.addEventListener('beforeunload', onBeforeUnload)
	cleanup.push(() => win.removeEventListener('beforeunload', onBeforeUnload))

	api<SessionInfo>('session')
		.then((info) => {
			session = info
			setState({ features: info.features })
		})
		.catch((error: unknown) =>
			console.error('[@obelism/content bridge]', error),
		)

	return bridge
}
