import { BRIDGE_SOURCE } from './createBridge'

// The CMS's entry form in an iframe, for editing on the site (the prompt
// box's Form mode). The CMS renders the form at a one-time URL (`/site/form#
// code=…`, from the site's `/cms/api/form`); this keeps it in step with the
// bridge's in-memory content.
//
// Messages are only exchanged with the URL's origin, and only with the
// iframe's window:
// - form → bridge: { source: 'obelism-content-form', type: 'ready' |
//   'loaded' | 'change' | 'error' | 'height', loading?, content?, message?,
//   height? } — `ready` with `loading: true` when the form still loads the
//   entry after it and says `loaded` once it shows (a CMS from before says
//   only `ready`), `change` carries the whole entry content after an edit,
//   `height` the form's own height in px, which the iframe takes (up to 60vh)
// - bridge → form: { source: 'obelism-content-bridge', type: 'content',
//   entryId, content, locale, selectedUid }

export const FORM_SOURCE = 'obelism-content-form'

// How long the form may take to show.
export const FORM_READY_TIMEOUT_MS = 30_000

// What the form shows: an entry's content as edited here, in a locale, with
// the block selected on the page.
export type FormContent = {
	entryId: string
	content: unknown
	locale: string | undefined
	selectedUid: string | null
}

export type FormFrameHandlers = {
	onReady: () => void
	// The whole entry content after an edit in the form. `entryId` when the
	// form says which entry it is of.
	onChange: (
		content: Record<string, unknown>,
		entryId: string | undefined,
	) => void
	onError: (message: string) => void
}

export type FormFrame = {
	// What the form shows from now on, sent once it is ready.
	show(content: FormContent): void
	destroy(): void
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	!!value && typeof value === 'object' && !Array.isArray(value)

// Mounts the form at `url` in `container`. The URL is single use: mount a
// fresh one every time.
export const mountFormFrame = (
	win: Window,
	container: HTMLElement,
	url: string,
	title: string,
	handlers: FormFrameHandlers,
): FormFrame => {
	let parsed: URL | null = null
	try {
		parsed = new URL(url)
	} catch {}
	if (!parsed || !/^https?:$/.test(parsed.protocol)) {
		throw new Error('Obelism Content sent no form to open')
	}
	const origin = parsed.origin

	const iframe = container.ownerDocument.createElement('iframe')
	iframe.title = title
	iframe.src = url

	let ready = false
	let shown = false
	let latest: FormContent | null = null
	const post = () => {
		if (!ready || !latest) return
		iframe.contentWindow?.postMessage(
			{ source: BRIDGE_SOURCE, type: 'content', ...latest },
			origin,
		)
	}

	const timer = setTimeout(() => {
		if (!shown) handlers.onError('The form did not open')
	}, FORM_READY_TIMEOUT_MS)
	const show = () => {
		shown = true
		clearTimeout(timer)
		handlers.onReady()
	}

	const onMessage = (event: MessageEvent) => {
		if (
			event.origin !== origin ||
			!iframe.contentWindow ||
			event.source !== iframe.contentWindow
		) {
			return
		}
		const data = event.data as {
			source?: unknown
			type?: unknown
			content?: unknown
			entryId?: unknown
			message?: unknown
			loading?: unknown
		} | null
		if (!data || data.source !== FORM_SOURCE) return
		if (data.type === 'ready') {
			// Again after the form reloads itself: it gets the content again.
			ready = true
			post()
			// Until the form loaded the entry, the box's own loading state
			// stands in for the form's.
			if (data.loading !== true) show()
		} else if (data.type === 'loaded') {
			if (ready) show()
		} else if (data.type === 'change' && isObject(data.content)) {
			handlers.onChange(
				data.content,
				typeof data.entryId === 'string' ? data.entryId : undefined,
			)
		} else if (data.type === 'height') {
			const height = (data as { height?: unknown }).height
			if (typeof height === 'number' && Number.isFinite(height)) {
				// A short page's form is short; a long one scrolls inside.
				const px = Math.round(Math.min(Math.max(height, 80), 4000))
				iframe.style.height = `min(${px}px, 60vh)`
			}
		} else if (data.type === 'error') {
			handlers.onError(
				typeof data.message === 'string' && data.message
					? data.message
					: 'The form failed',
			)
		}
	}
	win.addEventListener('message', onMessage)
	container.appendChild(iframe)

	return {
		show(content) {
			latest = content
			post()
		},
		destroy() {
			clearTimeout(timer)
			win.removeEventListener('message', onMessage)
			iframe.remove()
		},
	}
}
