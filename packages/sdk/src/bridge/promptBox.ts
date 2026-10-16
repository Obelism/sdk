import type { BridgeState, ContentBridge } from './createBridge'

// The prompt box: a small bar at the bottom of the page, inside the visual
// editor or on a site signed in to edit, where an editor types what to
// change ("make the hero shorter, and friendlier"). Plain DOM in a shadow
// root, so it works on any site and the site's CSS can't reach it (nor its
// CSS the site). It shows once prompts are offered (people who may edit
// content), acts on the selected block or the whole entry, and offers undo.
// On the site it also saves, publishes and signs out, and can add a page
// ("New page": a path and what the page is for); in the visual editor the
// editor around the site does that.

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
	newPage: string
	newPageCancel: string
	newPagePlaceholder: string
	path: string
	pathPlaceholder: string
	creating: string
	created: string
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
	newPage: 'New page',
	newPageCancel: 'Edit this page instead',
	newPagePlaceholder:
		'Describe the new page, e.g. “a pricing page for agencies”',
	path: 'Path',
	pathPlaceholder: '/pricing',
	creating: 'Writing the page…',
	created: 'Opening the new page…',
}

export type PromptBoxOptions = {
	labels?: Partial<PromptLabels> | undefined
}

// Icons (Lucide), drawn in the text colour.
const ICONS = {
	page: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
	newPage:
		'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
	block:
		'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	send: '<path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z"/><path d="M6 12h16"/>',
}

// Obelism's design tokens (obelism.studio/design.md), under their own names:
// beige and near-black, one orange accent, Inter, pill buttons.
const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font: inherit; color: inherit; margin: 0; }
.root {
	--color-white-rgb: 248 248 248; --color-beige-rgb: 238 236 233; --color-beige-off-rgb: 228 225 217;
	--color-grey-light-rgb: 132 132 132; --color-grey-rgb: 108 108 108; --color-grey-mid-rgb: 100 100 100; --color-grey-dark-rgb: 40 40 40;
	--color-black-off-rgb: 20 20 20; --color-black-rgb: 12 12 12;
	--color-orange-rgb: 212 130 30; --color-red-rgb: 240 93 93;
	--theme-foreground-rgb: var(--color-black-rgb);
	--theme-background-alt-rgb: var(--color-white-rgb);
	--theme-background-actions-rgb: var(--color-beige-off-rgb);
	--theme-border-rgb: var(--color-grey-light-rgb);
	--theme-accent-rgb: var(--color-orange-rgb);
	--theme-foreground-muted-rgb: var(--color-grey-mid-rgb);
	--theme-error: #b3261e;
	--border-radius-medium: 20px; --border-radius-pill: 5em;
	--ease-roll: cubic-bezier(0.65, 0, 0.35, 1);
	--shadow: 0 18px 40px -16px rgb(var(--color-black-rgb) / .3), 0 2px 6px rgb(var(--color-black-rgb) / .05);
	--font-inter: 'InterVariable', 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
		Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;
	position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%);
	z-index: 2147483647; width: min(640px, calc(100vw - 32px)); color-scheme: light dark;
	font: 400 14px/1.4 var(--font-inter); color: rgb(var(--theme-foreground-rgb));
	-webkit-font-smoothing: antialiased;
}
@media (prefers-color-scheme: dark) {
	.root {
		--theme-foreground-rgb: var(--color-white-rgb);
		--theme-background-alt-rgb: var(--color-black-off-rgb);
		--theme-background-actions-rgb: var(--color-grey-dark-rgb);
		--theme-border-rgb: var(--color-grey-rgb);
		--theme-foreground-muted-rgb: var(--color-grey-light-rgb);
		--theme-error: rgb(var(--color-red-rgb));
		--shadow: 0 18px 40px -14px rgb(0 0 0 / .7), 0 2px 6px rgb(0 0 0 / .3);
	}
}
.icon { display: inline-flex; flex: none; }
.icon svg {
	width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.75;
	stroke-linecap: round; stroke-linejoin: round;
}
.visually-hidden {
	position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}
button { cursor: pointer; background: none; border: 0; padding: 0; }
button:disabled { cursor: not-allowed; }
button:focus-visible { outline: 2px solid rgb(var(--theme-accent-rgb)); outline-offset: 2px; }

/* Closed: one floating pill that reads like an empty field, with the mark. */
.bar { display: flex; justify-content: center; }
.pill {
	display: flex; align-items: center; gap: 12px; width: min(560px, 100%); height: 56px;
	padding: 0 22px 0 26px; border-radius: var(--border-radius-pill);
	background: rgb(var(--theme-background-alt-rgb));
	border: 1px solid rgb(var(--theme-border-rgb) / .25); box-shadow: var(--shadow);
	color: rgb(var(--theme-foreground-muted-rgb)); font-size: 16px; text-align: left;
	transition: transform .25s var(--ease-roll), color .25s var(--ease-roll);
}
button.pill:hover { color: rgb(var(--theme-foreground-rgb)); transform: translateY(-2px); }
.pill > span:first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mark { color: rgb(var(--theme-accent-rgb)); font-size: 22px; line-height: 1; }
.pill.compact { width: auto; height: 40px; padding: 0 18px; font-size: 14px; gap: 4px; }

/* Open: a floating card, the text on top and a row of pill buttons below. */
.panel {
	display: grid; background: rgb(var(--theme-background-alt-rgb));
	border: 1px solid rgb(var(--theme-border-rgb) / .25); border-radius: var(--border-radius-medium);
	box-shadow: var(--shadow); overflow: hidden;
	transition: border-color .25s var(--ease-roll), box-shadow .25s var(--ease-roll);
	animation: rise .25s var(--ease-roll);
}
.panel:focus-within {
	border-color: rgb(var(--theme-accent-rgb) / .6);
	box-shadow: 0 0 0 3px rgb(var(--theme-accent-rgb) / .18), var(--shadow);
}
@keyframes rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }
@keyframes spin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) {
	.panel { animation: none; }
	.pill { transition: none; }
}
.status {
	padding: 16px 22px 0; font-size: 14px; color: rgb(var(--theme-foreground-muted-rgb));
	display: flex; align-items: center; gap: 8px;
}
.status.working::before {
	content: ''; width: 12px; height: 12px; flex: none; border-radius: 50%;
	border: 2px solid rgb(var(--theme-border-rgb) / .3); border-top-color: rgb(var(--theme-accent-rgb));
	animation: spin .7s linear infinite;
}
.status.error { color: var(--theme-error); }
textarea {
	display: block; width: 100%; resize: none; min-height: 76px; max-height: 200px;
	padding: 16px 22px 6px; border: 0; outline: 0; background: transparent;
	font-size: 16px; line-height: 1.6; color: rgb(var(--theme-foreground-rgb));
}
textarea::placeholder { color: rgb(var(--theme-foreground-muted-rgb)); }
/* New page: where it goes, above what it is for. */
.path {
	display: flex; align-items: center; gap: 10px; padding: 16px 22px 0;
	color: rgb(var(--theme-foreground-muted-rgb));
}
.path input {
	flex: 1; min-width: 0; height: 34px; padding: 0 14px; outline: 0;
	border: 1px solid rgb(var(--theme-border-rgb) / .25); border-radius: var(--border-radius-pill);
	background: rgb(var(--theme-background-actions-rgb) / .45); color: rgb(var(--theme-foreground-rgb));
	transition: border-color .25s var(--ease-roll);
}
.path input:focus-visible { border-color: rgb(var(--theme-accent-rgb)); }
.path input::placeholder { color: rgb(var(--theme-foreground-muted-rgb)); }
.path input:disabled { opacity: .5; }
textarea:disabled { opacity: .5; }
.toolbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px 12px; }
.spacer { flex: 1; }
.chip {
	display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: .4em 1.1em .4em .9em;
	border: 1px solid rgb(var(--theme-border-rgb) / .2); border-radius: var(--border-radius-pill);
	background: rgb(var(--theme-background-actions-rgb) / .6); white-space: nowrap;
	transition: background-color .25s var(--ease-roll);
}
button.chip:hover:not(:disabled) { background: rgb(var(--theme-background-actions-rgb)); }
button.chip:disabled { opacity: .5; }
.scope { min-width: 0; background: transparent; }
.scope > span:not(.icon) { overflow: hidden; text-overflow: ellipsis; }
.scope button {
	display: inline-flex; margin-right: -6px; padding: 3px; border-radius: 50%;
	color: rgb(var(--theme-foreground-muted-rgb));
}
.scope button:hover { background: rgb(var(--theme-background-actions-rgb)); color: rgb(var(--theme-foreground-rgb)); }
.scope button svg { width: 14px; height: 14px; }
.icon-button {
	display: inline-flex; align-items: center; justify-content: center;
	width: 34px; height: 34px; border-radius: 50%; color: rgb(var(--theme-foreground-muted-rgb));
	transition: background-color .25s var(--ease-roll), color .25s var(--ease-roll), opacity .25s var(--ease-roll);
}
.icon-button:hover:not(:disabled) { background: rgb(var(--theme-background-actions-rgb)); color: rgb(var(--theme-foreground-rgb)); }
/* The one call to action: white on orange. */
.icon-button.primary { background: rgb(var(--theme-accent-rgb)); color: #fff; }
.icon-button.primary:hover:not(:disabled) { background: rgb(var(--theme-accent-rgb)); color: #fff; opacity: .88; }
.icon-button.primary:disabled { opacity: .35; }
.divider { width: 1px; height: 20px; background: rgb(var(--theme-border-rgb) / .3); margin: 0 4px; }

/* On the site: storing the draft, and the way out. */
.footer {
	display: flex; align-items: center; gap: 8px; padding: 10px 12px 10px 22px;
	border-top: 1px solid rgb(var(--theme-border-rgb) / .2);
	background: rgb(var(--theme-background-actions-rgb) / .45);
}
.footer .chip { height: 30px; padding: .4em 1.2em; background: rgb(var(--theme-background-alt-rgb)); }
.unsaved { color: rgb(var(--theme-foreground-muted-rgb)); display: inline-flex; align-items: center; }
.link { color: rgb(var(--theme-foreground-muted-rgb)); text-decoration: underline; text-underline-offset: 3px; padding: 0 6px; }
.link:hover { color: rgb(var(--theme-foreground-rgb)); }
.dot {
	display: inline-block; width: 7px; height: 7px; border-radius: 50%;
	background: rgb(var(--theme-accent-rgb)); margin-right: 8px;
}
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

const icon = (doc: Document, name: keyof typeof ICONS) => {
	const span = element(doc, 'span', { className: 'icon' })
	span.setAttribute('aria-hidden', 'true')
	span.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`
	return span
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
	const pillText = element(doc, 'span', { textContent: labels.open })
	const pill = element(
		doc,
		'button',
		{ className: 'pill', type: 'button' },
		pillText,
		// The Obelism mark.
		element(doc, 'span', { className: 'mark', textContent: '⁜' }),
	)
	// Someone signed in who may only read: a note that drafts show, and a
	// way out.
	const viewing = element(
		doc,
		'span',
		{ className: 'pill compact' },
		`${labels.viewingDrafts} · `,
	)
	const pillSignOut = element(doc, 'button', {
		className: 'link',
		type: 'button',
		textContent: labels.signOut,
	})
	viewing.appendChild(pillSignOut)

	const status = element(doc, 'p', { className: 'status' })
	status.setAttribute('role', 'status')
	const input = element(doc, 'textarea', {
		placeholder: labels.placeholder,
		rows: 1,
	})
	input.setAttribute('aria-label', labels.open)

	// What the prompt acts on: the whole page, or the selected block with a
	// way back to the page.
	const pageIcon = icon(doc, 'page')
	const blockIcon = icon(doc, 'block')
	const scopeText = element(doc, 'span')
	const clearBlock = element(doc, 'button', {
		type: 'button',
		title: labels.clearBlock,
	})
	clearBlock.setAttribute('aria-label', labels.clearBlock)
	clearBlock.appendChild(icon(doc, 'close'))
	const scope = element(
		doc,
		'span',
		{ className: 'chip scope' },
		pageIcon,
		blockIcon,
		scopeText,
		clearBlock,
	)
	const undo = element(
		doc,
		'button',
		{ className: 'action chip', type: 'button' },
		icon(doc, 'undo'),
		labels.undo,
	)

	// New page (on the site, for people who may add pages): the scope becomes
	// the new page, with a way back, and a path field shows above the prompt.
	const newPage = element(
		doc,
		'button',
		{ className: 'action chip', type: 'button' },
		icon(doc, 'newPage'),
		labels.newPage,
	)
	const cancelNew = element(doc, 'button', {
		type: 'button',
		title: labels.newPageCancel,
	})
	cancelNew.setAttribute('aria-label', labels.newPageCancel)
	cancelNew.appendChild(icon(doc, 'close'))
	const newScope = element(
		doc,
		'span',
		{ className: 'chip scope' },
		icon(doc, 'newPage'),
		element(doc, 'span', { textContent: labels.newPage }),
		cancelNew,
	)
	const pathInput = element(doc, 'input', {
		type: 'text',
		placeholder: labels.pathPlaceholder,
		autocomplete: 'off',
		spellcheck: false,
	})
	const pathRow = element(
		doc,
		'label',
		{ className: 'path' },
		element(doc, 'span', { textContent: labels.path }),
		pathInput,
	)
	const close = element(
		doc,
		'button',
		{ className: 'close icon-button', type: 'button', title: labels.close },
		icon(doc, 'close'),
	)
	close.setAttribute('aria-label', labels.close)
	const send = element(
		doc,
		'button',
		{ className: 'action primary icon-button', type: 'submit' },
		element(doc, 'span', {
			className: 'visually-hidden',
			textContent: labels.send,
		}),
		icon(doc, 'send'),
	)
	send.title = labels.send

	const unsaved = element(doc, 'span', { className: 'unsaved' })
	unsaved.appendChild(element(doc, 'span', { className: 'dot' }))
	unsaved.appendChild(doc.createTextNode(labels.unsaved))
	const signOut = element(doc, 'button', {
		className: 'link',
		type: 'button',
		textContent: labels.signOut,
	})
	const save = element(doc, 'button', {
		className: 'action chip',
		type: 'button',
		textContent: labels.save,
	})
	const publish = element(doc, 'button', {
		className: 'action chip',
		type: 'button',
		textContent: labels.publish,
	})
	const footer = element(
		doc,
		'div',
		{ className: 'footer' },
		unsaved,
		element(doc, 'span', { className: 'spacer' }),
		signOut,
		save,
		publish,
	)

	const panel = element(
		doc,
		'form',
		{ className: 'panel' },
		status,
		pathRow,
		input,
		element(
			doc,
			'div',
			{ className: 'toolbar' },
			scope,
			newScope,
			undo,
			newPage,
			element(doc, 'span', { className: 'spacer' }),
			close,
			element(doc, 'span', { className: 'divider' }),
			send,
		),
		footer,
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
	let creating = false
	let message: { text: string; error: boolean } | null = null

	const render = (state: BridgeState) => {
		const available = state.features.includes('prompt')
		const storing = state.saving || state.publishing
		const busy = state.prompting || storing
		root.hidden = !available && !site
		pill.hidden = open || !available
		viewing.hidden = available || !site
		panel.hidden = !open || !available
		const canCreate = site && state.features.includes('create')
		// A page of the site that isn't an entry (no `editable(entry)`, like a
		// hand-written /about) has nothing to edit: only New page.
		const pageless = site && bridge.entryId === null
		const onlyNew = pageless && canCreate
		if (!canCreate) creating = false
		if (onlyNew) creating = true
		pillText.textContent = onlyNew ? labels.newPage : labels.open
		cancelNew.hidden = onlyNew
		scope.hidden = creating
		newScope.hidden = !creating
		newPage.hidden = creating || !canCreate
		newPage.disabled = busy
		pathRow.hidden = !creating
		pathInput.disabled = busy
		input.placeholder = creating
			? labels.newPagePlaceholder
			: labels.placeholder
		scopeText.textContent = state.selectedUid
			? labels.scopeBlock
			: labels.scopeEntry
		clearBlock.hidden = !state.selectedUid
		pageIcon.hidden = !!state.selectedUid
		blockIcon.hidden = !state.selectedUid
		undo.hidden = creating || !state.canUndo
		undo.disabled = busy
		send.disabled =
			busy ||
			input.value.trim() === '' ||
			(creating && pathInput.value.trim() === '')
		input.disabled = busy
		save.hidden = !state.features.includes('save') || pageless
		save.disabled = busy || !state.unsaved
		save.textContent = state.saving ? labels.saving : labels.save
		publish.hidden = !state.features.includes('publish') || pageless
		publish.disabled = busy
		publish.textContent = state.publishing ? labels.publishing : labels.publish
		signOut.hidden = !site
		footer.hidden = !site
		unsaved.hidden = !state.unsaved
		const text = state.prompting
			? creating
				? labels.creating
				: labels.working
			: (message?.text ??
				(site && !creating && !state.selectedUid ? labels.selectHint : ''))
		status.textContent = text
		status.hidden = !text
		status.className = `status${state.prompting ? ' working' : ''}${!busy && message?.error ? ' error' : ''}`
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
			if (creating) {
				const path = pathInput.value.trim()
				if (!path) return pathInput.focus()
				// The bridge opens the new page; this shows until it does.
				await bridge.createPage(path, prompt)
				message = { text: labels.created, error: false }
			} else {
				const { summary } = await bridge.prompt(prompt)
				message = { text: summary, error: false }
			}
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
		refresh()
		if (site) bridge.setSelecting(open && !creating)
	}

	const setCreating = (next: boolean) => {
		creating = next
		message = null
		bridge.setSelecting(open && !creating)
		if (creating) bridge.select(null)
		refresh()
		;(creating ? pathInput : input).focus()
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
		;(creating ? pathInput : input).focus()
	})
	close.addEventListener('click', () => setOpen(false))
	save.addEventListener('click', () => void store('save'))
	publish.addEventListener('click', () => void store('publish'))
	signOut.addEventListener('click', () => bridge.signOut())
	pillSignOut.addEventListener('click', () => bridge.signOut())
	clearBlock.addEventListener('click', () => bridge.select(null))
	newPage.addEventListener('click', () => setCreating(true))
	cancelNew.addEventListener('click', () => setCreating(false))
	pathInput.addEventListener('input', refresh)
	pathInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			input.focus()
		} else if (event.key === 'Escape') {
			setOpen(false)
		}
	})
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
