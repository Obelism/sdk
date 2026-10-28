import {
	COLLECTION_ATTRIBUTE,
	COLLECTION_HANDLE_ATTRIBUTE,
	ENTRY_ATTRIBUTE,
	PRODUCT_ATTRIBUTE,
	PRODUCT_HANDLE_ATTRIBUTE,
	UID_ATTRIBUTE,
} from '../editable'
import { SITE_EDITING_COOKIE, SITE_REQUEST_HEADER } from '../site'
import type { Entry, ShopifyItem } from '../types'
import {
	type ApplyJsonResult,
	blockSelector,
	type BridgeState,
	type ContentBridge,
	type CreatePageResult,
	type CreateCollectionPageResult,
	type CreateProductPageResult,
	createEmitter,
	type FormHandle,
	INITIAL_STATE,
	type PromptResult,
	selectionStyle,
	type SitePage,
} from './createBridge'
import { type FormContent, type FormFrame, mountFormFrame } from './formFrame'

// The bridge on a site signed in to edit (`/cms/login`, from
// @obelism/content/site), outside the visual editor. It plays the editor's
// part itself: it keeps the changed content in memory, asks the site's
// `/cms/api/…` (which forwards to the CMS with the session's token) to apply
// prompts and to shape the content for rendering, hands that to `update`
// listeners like the editor would, and saves or publishes on request.
//
// What it edits is the page's entry — the outermost element marked with
// `editable(entry)` — or, for a selected block, the entry around that block.
// Besides prompts it shows the CMS's own entry form (`openForm`, an iframe
// kept in step with the content here, see formFrame.ts), edits JSON (`view`,
// then `applyJson`: the raw alternative), and lists the space's pages to go
// to one.

// Plain path segments only: the URL parser drops tabs and newlines and reads
// \ as /, so anything looser can resolve to another origin.
const BASE_PATH = /^(?:\/[\w.~-]+)+$/

// Page addresses come from the CMS's session and pages: never a javascript:
// or data: URL.
const webUrl = (url: string) => {
	const { protocol } = new URL(url, 'https://site.invalid')
	if (protocol !== 'https:' && protocol !== 'http:') {
		throw new Error(`Not a page address: ${url}`)
	}
	return url
}

// The base path of the site's handler while signed in to edit, else null.
export const readSiteEditing = (doc: Document): string | null => {
	for (const part of doc.cookie.split(';')) {
		const [name, ...value] = part.trim().split('=')
		if (name !== SITE_EDITING_COOKIE) continue
		try {
			const basePath = decodeURIComponent(value.join('='))
			return BASE_PATH.test(basePath) ? basePath : null
		} catch {
			return null
		}
	}
	return null
}

type SessionInfo = {
	features: string[]
	environment?: string
	// Where product pages are on the site, with {handle}: the environment's
	// setting in the CMS (from 2026-10-20).
	productPath?: string
	// …and collection pages (from 2026-10-21).
	collectionPath?: string
	space: { defaultLocale: string; locales: { code: string }[] }
}

type PagesAnswer = {
	pages: {
		entryId: string
		name: string
		contentType: string
		status: SitePage['status']
		// The CMS path by locale code.
		paths: Record<string, string>
		// A product page's product (CMS versions from 2026-10-20).
		product?: ShopifyItem | null
		// A collection page's collection (from 2026-10-21).
		collection?: ShopifyItem | null
	}[]
}

type Working = {
	// The content as edited here, and as last stored.
	content: unknown
	saved: unknown
	revision: number
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

// Edits in the form further apart than this are separate undo steps.
export const FORM_BURST_MS = 1000
// How long the page waits for the form's edits to settle before it shows
// them.
export const FORM_RENDER_MS = 300

export type SiteBridgeOptions = {
	// Where a CMS path (`solutions/agencies`) is on the site, in a locale.
	// Default: `/` + path.
	pagePath?: ((path: string, locale: string) => string) | undefined
	// Where a product page is on the site, by its product's handle: your
	// product route. Default: the environment's product path in the CMS
	// (Settings), else `/products/` + handle.
	productPath?: ((handle: string, locale: string) => string) | undefined
	// The same for a collection page. Default: the environment's collection
	// path in the CMS, else `/collections/` + handle.
	collectionPath?: ((handle: string, locale: string) => string) | undefined
}

export const createSiteBridge = (
	win: Window,
	basePath: string,
	{
		pagePath = (path) => `/${path.replace(/^\/+/, '')}`,
		productPath: ownProductPath,
		collectionPath: ownCollectionPath,
	}: SiteBridgeOptions = {},
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
	const productPath = (handle: string, locale: string) =>
		ownProductPath
			? ownProductPath(handle, locale)
			: (session?.productPath ?? '/products/{handle}').replaceAll(
					'{handle}',
					encodeURIComponent(handle),
				)
	const collectionPath = (handle: string, locale: string) =>
		ownCollectionPath
			? ownCollectionPath(handle, locale)
			: (session?.collectionPath ?? '/collections/{handle}').replaceAll(
					'{handle}',
					encodeURIComponent(handle),
				)
	// The open form's, if any; and when the form last changed content, for
	// undo steps (-Infinity: the next edit starts a new step).
	let closeForm: (() => void) | null = null
	let lastFormEdit = -Infinity
	const renderTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
			undoSteps: history.length,
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

	// The product the page shows (editableProduct), if it marks one.
	const pageProduct = (): ShopifyItem | null => {
		const element = doc.querySelector(`[${PRODUCT_ATTRIBUTE}]`)
		const id = element?.getAttribute(PRODUCT_ATTRIBUTE)
		const handle = element?.getAttribute(PRODUCT_HANDLE_ATTRIBUTE)
		return id && handle ? { id, handle } : null
	}

	// The collection the page shows (editableCollection), if it marks one.
	const pageCollection = (): ShopifyItem | null => {
		const element = doc.querySelector(`[${COLLECTION_ATTRIBUTE}]`)
		const id = element?.getAttribute(COLLECTION_ATTRIBUTE)
		const handle = element?.getAttribute(COLLECTION_HANDLE_ATTRIBUTE)
		return id && handle ? { id, handle } : null
	}

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

	// One request per entry at a time: a second would overwrite edits made
	// while the first was out.
	const loading = new Map<string, Promise<Working>>()
	const load = async (entryId: string) => {
		const loaded = working.get(entryId)
		if (loaded) return loaded
		let pending = loading.get(entryId)
		if (!pending) {
			pending = api<{ content: unknown; draftRevision: number }>(
				`entries/${encodeURIComponent(entryId)}`,
			)
				.then((entry) => {
					const fresh = working.get(entryId) ?? {
						content: entry.content,
						saved: entry.content,
						revision: entry.draftRevision,
					}
					working.set(entryId, fresh)
					return fresh
				})
				.finally(() => loading.delete(entryId))
			loading.set(entryId, pending)
		}
		return pending
	}

	// The entry a prompt or JSON acts on, for the block `uid` (the selected
	// one when left out).
	const target = (option: string | null | undefined) => {
		const uid = option === undefined ? state.selectedUid : option
		const entryId = entryFor(uid)
		if (!entryId) {
			throw new Error(
				'Nothing on this page is marked as an entry: add editable(entry)',
			)
		}
		return { uid, entryId }
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

	const logError = (error: unknown) =>
		console.error('[@obelism/content bridge]', error)

	// Renders once the form's edits settle.
	const renderSoon = (entryId: string) => {
		clearTimeout(renderTimers.get(entryId))
		renderTimers.set(
			entryId,
			setTimeout(() => {
				renderTimers.delete(entryId)
				void render(entryId).catch(logError)
			}, FORM_RENDER_MS),
		)
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
		lastFormEdit = -Infinity
		refreshUnsaved()
	}

	const has = (feature: string) => state.features.includes(feature)

	const bridge: ContentBridge = {
		isEditing: true,
		mode: 'site',
		get entryId() {
			return pageEntryId()
		},
		get product() {
			return pageProduct()
		},
		get collection() {
			return pageCollection()
		},
		get environment() {
			return session?.environment ?? null
		},
		on: emitter.on,
		getState: () => state,

		async prompt(prompt, options = {}): Promise<PromptResult> {
			const text = prompt.trim()
			if (!text) throw new Error('Say what to change')
			if (!has('prompt')) throw new Error('You may not edit content here')
			const { uid, entryId } = target(options.uid)
			setState({ prompting: true })
			try {
				const entry = await load(entryId)
				const result = await api<{ content: unknown; summary: string }>(
					`entries/${encodeURIComponent(entryId)}/prompt`,
					{ prompt: text, content: entry.content, locale: locale(), uid },
				)
				history.push({ entryId, content: entry.content })
				lastFormEdit = -Infinity
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
				const url = pagePath(created.path, locale() ?? '')
				win.location.assign(webUrl(url))
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

		async createProductPage(
			product = pageProduct() ?? undefined,
		): Promise<CreateProductPageResult> {
			if (!product) {
				throw new Error(
					'Nothing on this page is marked as a product: add editableProduct(product)',
				)
			}
			if (!has('create')) throw new Error('You may not add pages here')
			if (state.unsaved) {
				throw new Error('Save or undo your changes before adding a page')
			}
			setState({ prompting: true })
			try {
				const made = await api<CreateProductPageResult>('product-pages', {
					product: { id: product.id, handle: product.handle },
				})
				// The site's product route finds its page now (drafts, while
				// editing): show it.
				win.location.reload()
				return made
			} finally {
				setState({ prompting: false })
			}
		},

		async createCollectionPage(
			collection = pageCollection() ?? undefined,
		): Promise<CreateCollectionPageResult> {
			if (!collection) {
				throw new Error(
					'Nothing on this page is marked as a collection: add editableCollection(collection)',
				)
			}
			if (!has('create')) throw new Error('You may not add pages here')
			if (state.unsaved) {
				throw new Error('Save or undo your changes before adding a page')
			}
			setState({ prompting: true })
			try {
				const made = await api<CreateCollectionPageResult>('collection-pages', {
					collection: { id: collection.id, handle: collection.handle },
				})
				// The site's collection route finds its page now (drafts, while
				// editing): show it.
				win.location.reload()
				return made
			} finally {
				setState({ prompting: false })
			}
		},

		async view(options = {}) {
			const { uid, entryId } = target(options.uid)
			const entry = await load(entryId)
			const { view } = await api<{ view: Record<string, unknown> }>(
				`entries/${encodeURIComponent(entryId)}/view`,
				{ content: entry.content, locale: locale(), uid },
			)
			return view
		},

		async applyJson(changes, options = {}): Promise<ApplyJsonResult> {
			if (!has('prompt')) throw new Error('You may not edit content here')
			if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
				throw new Error('Send the fields to change as an object')
			}
			const { uid, entryId } = target(options.uid)
			setState({ prompting: true })
			try {
				const entry = await load(entryId)
				const result = await api<{
					content: unknown
					changed?: string[]
					view?: Record<string, unknown> | null
				}>(`entries/${encodeURIComponent(entryId)}/apply`, {
					changes,
					content: entry.content,
					locale: locale(),
					uid,
				})
				// Nothing to undo when nothing changed.
				if (!same(result.content, entry.content)) {
					history.push({ entryId, content: entry.content })
					lastFormEdit = -Infinity
					entry.content = result.content
					refreshUnsaved()
					await render(entryId)
				}
				return {
					changed: result.changed ?? [],
					...(result.view && { view: result.view }),
				}
			} finally {
				setState({ prompting: false })
			}
		},

		openForm(container, options = {}): FormHandle {
			const { title = 'Content form', onReady, onError, onEscape } = options
			closeForm?.()
			let closed = false
			let frame: FormFrame | null = null
			// What the form was last sent, or sent back itself.
			let shown: FormContent | null = null
			let unsubscribe = () => {}
			const fail = (error: unknown) => {
				if (!closed)
					onError?.(error instanceof Error ? error.message : String(error))
			}
			const close = () => {
				if (closed) return
				closed = true
				unsubscribe()
				frame?.destroy()
				if (closeForm === close) closeForm = null
			}
			closeForm = close

			// Sends the form the entry for the selection, when anything of it
			// changed: prompts, undo, a reload after saving, the selection.
			const show = () => {
				if (closed || !frame) return
				const entryId = entryFor(state.selectedUid)
				if (!entryId) return
				const entry = working.get(entryId)
				if (!entry) {
					load(entryId).then(show, fail)
					return
				}
				const next: FormContent = {
					entryId,
					content: entry.content,
					locale: locale(),
					selectedUid: state.selectedUid,
				}
				if (
					shown &&
					shown.entryId === next.entryId &&
					shown.content === next.content &&
					shown.locale === next.locale &&
					shown.selectedUid === next.selectedUid
				) {
					return
				}
				shown = next
				frame.show(next)
			}

			const change = (content: Record<string, unknown>, from?: string) => {
				const entryId = from ?? shown?.entryId
				const entry = entryId === undefined ? undefined : working.get(entryId)
				if (
					closed ||
					entryId === undefined ||
					!entry ||
					same(content, entry.content)
				) {
					return
				}
				const now = Date.now()
				if (now - lastFormEdit >= FORM_BURST_MS) {
					history.push({ entryId, content: entry.content })
				}
				lastFormEdit = now
				entry.content = content
				// Not sent back: the form has it.
				if (shown?.entryId === entryId) shown = { ...shown, content }
				refreshUnsaved()
				renderSoon(entryId)
			}

			const start = async () => {
				if (!has('form')) throw new Error('You may not edit content here')
				await load(target(undefined).entryId)
				// A fresh one every time: the address works once, for a minute.
				const { url } = await api<{ url?: unknown }>('form', {})
				if (closed) return
				const address = typeof url === 'string' ? url : ''
				frame = mountFormFrame(win, container, address, title, {
					onReady: () => onReady?.(),
					onChange: change,
					onError: (message) => onError?.(message),
					onEscape: () => onEscape?.(),
				})
				unsubscribe = emitter.on('change', show)
				show()
			}
			start().catch(fail)
			return { close }
		},

		async pages() {
			const { pages } = await api<PagesAnswer>('pages')
			const preferred = [locale(), session?.space.defaultLocale]
			return pages.flatMap((page): SitePage[] => {
				// The page's path in this locale, else the default's, else any.
				const code =
					preferred.find(
						(code) => code !== undefined && page.paths[code] !== undefined,
					) ?? Object.keys(page.paths)[0]
				const path = code === undefined ? undefined : page.paths[code]
				if (code === undefined || path === undefined) return []
				return [
					{
						entryId: page.entryId,
						name: page.name,
						contentType: page.contentType,
						status: page.status,
						path,
						url: page.product
							? productPath(page.product.handle, code)
							: page.collection
								? collectionPath(page.collection.handle, code)
								: pagePath(path, code),
						product: page.product ?? null,
						collection: page.collection ?? null,
					},
				]
			})
		},

		openPage(page) {
			if (
				state.unsaved &&
				!win.confirm('Leave this page and lose the changes you have not saved?')
			) {
				return
			}
			// Asked already: no second question from `beforeunload`.
			working.clear()
			history.length = 0
			refreshUnsaved()
			win.location.assign(webUrl(page.url))
		},

		undo() {
			const last = history.pop()
			const entry = last && working.get(last.entryId)
			if (!last || !entry) return
			lastFormEdit = -Infinity
			entry.content = last.content
			refreshUnsaved()
			void render(last.entryId).catch(logError)
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
			closeForm?.()
			renderTimers.forEach((timer) => clearTimeout(timer))
			renderTimers.clear()
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
