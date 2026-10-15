import type { BridgeState, ContentBridge } from './createBridge'

// The prompt box: a small bar at the bottom of the page, inside the visual
// editor or on a site signed in to edit, where an editor types what to
// change ("make the hero shorter, and friendlier"). Plain DOM in a shadow
// root, so it works on any site and the site's CSS can't reach it (nor its
// CSS the site). It shows once prompts are offered (people who may edit
// content), acts on the selected block or the whole entry, and offers undo.
// On the site it also saves, publishes and signs out; in the visual editor
// the editor around the site does that.

export type PromptLabels = {
	open: string
	placeholder: string
	send: string
	undo: string
	close: string
	scopeEntry: string
	scopeBlock: string
	clearBlock: string
	working: string
	save: string
	publish: string
	saving: string
	publishing: string
	saved: string
	published: string
	unsaved: string
	signOut: string
	viewingDrafts: string
	selectHint: string
}

export const DEFAULT_PROMPT_LABELS: PromptLabels = {
	open: 'Edit with a prompt',
	placeholder: 'Describe a change, e.g. “make the heading shorter”',
	send: 'Apply',
	undo: 'Undo',
	close: 'Close',
	scopeEntry: 'Whole page',
	scopeBlock: 'Selected block',
	clearBlock: 'Edit the whole page instead',
	working: 'Working on it…',
	save: 'Save',
	publish: 'Publish',
	saving: 'Saving…',
	publishing: 'Publishing…',
	saved: 'Saved as a draft',
	published: 'Published',
	unsaved: 'Unsaved changes',
	signOut: 'Exit editing',
	viewingDrafts: 'Viewing drafts',
	selectHint: 'Click a block to change only that block',
}

export type PromptBoxOptions = {
	labels?: Partial<PromptLabels> | undefined
}

const ACCENT = '#d58a1f'

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; }
.root {
	--bg: #fff; --fg: #1d1b19; --muted: #6b655e; --line: #e4ded6; --error: #b3261e;
	position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%);
	z-index: 2147483647; width: min(640px, calc(100vw - 32px)); color: var(--fg);
}
@media (prefers-color-scheme: dark) {
	.root { --bg: #23201d; --fg: #f3efe9; --muted: #a9a198; --line: #3b3631; --error: #ff8a80; }
}
.pill, .panel { background: var(--bg); border: 1px solid var(--line); box-shadow: 0 8px 30px rgba(0,0,0,.18); }
.pill {
	display: block; margin: 0 auto; border-radius: 999px; padding: 8px 16px; cursor: pointer;
	color: var(--fg);
}
.pill:hover { border-color: ${ACCENT}; }
.panel { border-radius: 14px; padding: 10px; display: grid; gap: 8px; }
.row { display: flex; align-items: center; gap: 8px; }
.scope { color: var(--muted); font-size: 12px; flex: 1; min-width: 0; }
.scope button { color: inherit; font-size: 12px; text-decoration: underline; background: none; border: 0; padding: 0 0 0 6px; cursor: pointer; }
textarea {
	width: 100%; resize: none; min-height: 44px; max-height: 160px; padding: 8px 10px;
	border-radius: 10px; border: 1px solid var(--line); background: transparent; color: var(--fg);
}
textarea:focus { outline: 2px solid ${ACCENT}; outline-offset: -1px; }
button.action {
	border-radius: 8px; border: 1px solid var(--line); background: transparent; color: var(--fg);
	padding: 6px 12px; cursor: pointer;
}
button.primary { background: ${ACCENT}; border-color: ${ACCENT}; color: #fff; }
button:disabled { opacity: .5; cursor: default; }
.close { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 18px; line-height: 1; padding: 2px 6px; }
.status { font-size: 13px; color: var(--muted); flex: 1; min-width: 0; }
.status.error { color: var(--error); }
.bar { display: flex; justify-content: center; gap: 8px; }
.row > .link { margin-right: auto; }
.link { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 12px; text-decoration: underline; padding: 0; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${ACCENT}; margin-right: 6px; vertical-align: 1px; }
[hidden] { display: none !important; }
`

const element = <K extends keyof HTMLElementTagNameMap>(
	doc: Document,
	tag: K,
	props: Record<string, string | number | boolean> = {},
	...children: (Node | string)[]
): HTMLElementTagNameMap[K] => {
	const node = doc.createElement(tag)
	Object.assign(node, props)
	// appendChild, not append: Workers types redefine Element.append, and a
	// site's server code may well have them loaded.
	for (const child of children) {
		node.appendChild(
			typeof child === 'string' ? doc.createTextNode(child) : child,
		)
	}
	return node
}

// Mounts the box on the page; returns a function that removes it.
export const mountPromptBox = (
	doc: Document,
	bridge: ContentBridge,
	options: PromptBoxOptions = {},
) => {
	const labels = { ...DEFAULT_PROMPT_LABELS, ...options.labels }

	const host = element(doc, 'div')
	host.setAttribute('data-obelism-content-prompt', '')
	const shadow = host.attachShadow({ mode: 'open' })

	const site = bridge.mode === 'site'
	const pill = element(doc, 'button', {
		className: 'pill',
		type: 'button',
		textContent: `✨ ${labels.open}`,
	})
	// Someone signed in who may only read: a note that drafts show, and a
	// way out.
	const viewing = element(
		doc,
		'span',
		{ className: 'pill' },
		`${labels.viewingDrafts} · `,
	)
	const pillSignOut = element(doc, 'button', {
		className: 'link',
		type: 'button',
		textContent: labels.signOut,
	})
	viewing.appendChild(pillSignOut)
	const scopeText = element(doc, 'span')
	const clearBlock = element(doc, 'button', {
		type: 'button',
		textContent: labels.clearBlock,
	})
	const scope = element(
		doc,
		'div',
		{ className: 'scope' },
		'✨ ',
		scopeText,
		clearBlock,
	)
	const close = element(doc, 'button', {
		className: 'close',
		type: 'button',
		textContent: '×',
		title: labels.close,
	})
	close.setAttribute('aria-label', labels.close)
	const input = element(doc, 'textarea', {
		placeholder: labels.placeholder,
		rows: 1,
	})
	input.setAttribute('aria-label', labels.open)
	const status = element(doc, 'div', { className: 'status' })
	status.setAttribute('role', 'status')
	const undo = element(doc, 'button', {
		className: 'action',
		type: 'button',
		textContent: labels.undo,
	})
	const send = element(doc, 'button', {
		className: 'action primary',
		type: 'submit',
		textContent: labels.send,
	})
	const save = element(doc, 'button', {
		className: 'action',
		type: 'button',
		textContent: labels.save,
	})
	const publish = element(doc, 'button', {
		className: 'action',
		type: 'button',
		textContent: labels.publish,
	})
	const signOut = element(doc, 'button', {
		className: 'link',
		type: 'button',
		textContent: labels.signOut,
	})
	const unsaved = element(doc, 'span', { className: 'scope' })
	unsaved.appendChild(element(doc, 'span', { className: 'dot' }))
	unsaved.appendChild(doc.createTextNode(labels.unsaved))
	const panel = element(
		doc,
		'form',
		{ className: 'panel' },
		element(doc, 'div', { className: 'row' }, scope, close),
		input,
		element(doc, 'div', { className: 'row' }, status, undo, send),
		element(doc, 'div', { className: 'row' }, unsaved, signOut, save, publish),
	)
	const root = element(
		doc,
		'div',
		{ className: 'root' },
		element(doc, 'div', { className: 'bar' }, pill, viewing),
		panel,
	)
	shadow.append(element(doc, 'style', { textContent: CSS }), root)

	let open = false
	let message: { text: string; error: boolean } | null = null

	const render = (state: BridgeState) => {
		const available = state.features.includes('prompt')
		const storing = state.saving || state.publishing
		const busy = state.prompting || storing
		root.hidden = !available && !site
		pill.hidden = open || !available
		viewing.hidden = available || !site
		panel.hidden = !open || !available
		scopeText.textContent = state.selectedUid
			? labels.scopeBlock
			: labels.scopeEntry
		clearBlock.hidden = !state.selectedUid
		undo.hidden = !state.canUndo
		undo.disabled = busy
		send.disabled = busy || input.value.trim() === ''
		input.disabled = busy
		save.hidden = !state.features.includes('save')
		save.disabled = busy || !state.unsaved
		save.textContent = state.saving ? labels.saving : labels.save
		publish.hidden = !state.features.includes('publish')
		publish.disabled = busy
		publish.textContent = state.publishing ? labels.publishing : labels.publish
		signOut.hidden = !site
		unsaved.hidden = !state.unsaved
		const text = state.prompting
			? labels.working
			: (message?.text ?? (site && !state.selectedUid ? labels.selectHint : ''))
		status.textContent = text
		status.className = `status${!busy && message?.error ? ' error' : ''}`
	}
	const refresh = () => render(bridge.getState())

	const grow = () => {
		input.style.height = 'auto'
		input.style.height = `${input.scrollHeight}px`
	}

	const submit = async () => {
		const prompt = input.value.trim()
		if (!prompt || bridge.getState().prompting) return
		message = null
		try {
			const { summary } = await bridge.prompt(prompt)
			message = { text: summary, error: false }
			input.value = ''
			grow()
		} catch (error) {
			message = {
				text: error instanceof Error ? error.message : String(error),
				error: true,
			}
		}
		refresh()
		input.focus()
	}

	const setOpen = (next: boolean) => {
		open = next
		if (site) bridge.setSelecting(open)
		refresh()
	}

	const store = async (action: 'save' | 'publish') => {
		message = null
		try {
			await bridge[action]()
			message = {
				text: action === 'save' ? labels.saved : labels.published,
				error: false,
			}
		} catch (error) {
			message = {
				text: error instanceof Error ? error.message : String(error),
				error: true,
			}
		}
		refresh()
	}

	pill.addEventListener('click', () => {
		setOpen(true)
		input.focus()
	})
	close.addEventListener('click', () => setOpen(false))
	save.addEventListener('click', () => void store('save'))
	publish.addEventListener('click', () => void store('publish'))
	signOut.addEventListener('click', () => bridge.signOut())
	pillSignOut.addEventListener('click', () => bridge.signOut())
	clearBlock.addEventListener('click', () => bridge.select(null))
	undo.addEventListener('click', () => {
		message = null
		bridge.undo()
	})
	panel.addEventListener('submit', (event) => {
		event.preventDefault()
		void submit()
	})
	input.addEventListener('input', () => {
		grow()
		refresh()
	})
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault()
			void submit()
		} else if (event.key === 'Escape') {
			setOpen(false)
		}
	})

	const unsubscribe = bridge.on('change', render)
	refresh()
	doc.body.appendChild(host)

	return () => {
		unsubscribe()
		host.remove()
	}
}
