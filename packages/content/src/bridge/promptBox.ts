import type {
	BridgeState,
	ContentBridge,
	FormHandle,
	SitePage,
} from './createBridge'

// The prompt box: a small bar at the bottom of the page, inside the visual
// editor or on a site signed in to edit, where an editor types what to
// change ("make the hero shorter, and friendlier"). Plain DOM in a shadow
// root, so it works on any site and the site's CSS can't reach it (nor its
// CSS the site). It shows once prompts are offered (people who may edit
// content), acts on the selected block or the whole entry, and offers undo.
// On the site it also saves, publishes and signs out, and can add a page
// ("New page": a path and what the page is for); in the visual editor the
// editor around the site does that. On the site it also shows the CMS's own
// entry form (Form mode, `bridge.openForm`), edited live, and goes to any
// page of the space, drafts included.

export type PromptLabels = {
	open: string
	placeholder: string
	send: string
	undo: string
	close: string
	minimize: string
	expand: string
	scopeEntry: string
	// The scope with no page to act on (no entry), like Content's canvas
	// with nothing selected.
	scopeNoPage: string
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
	modes: string
	modePrompt: string
	form: string
	formTitle: string
	formLoading: string
	pages: string
	pagesSearch: string
	pagesLoading: string
	pagesEmpty: string
	pageCurrent: string
	pageDraft: string
	pageChanged: string
	addProductPage: string
	addingProductPage: string
	addedProductPage: string
	productPageHint: string
	addCollectionPage: string
	addingCollectionPage: string
	addedCollectionPage: string
	collectionPageHint: string
}

export const DEFAULT_PROMPT_LABELS: PromptLabels = {
	open: 'Edit with a prompt',
	placeholder: 'Describe a change, e.g. “make the heading shorter”',
	send: 'Apply',
	undo: 'Undo',
	close: 'Close',
	minimize: 'Minimize, to see the page',
	expand: 'Expand',
	scopeEntry: 'Whole page',
	scopeNoPage: 'Whole page',
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
	modes: 'Edit with',
	modePrompt: 'Prompt',
	form: 'Form',
	formTitle: 'The content form',
	formLoading: 'Opening the form…',
	pages: 'Pages',
	pagesSearch: 'Find a page',
	pagesLoading: 'Loading pages…',
	pagesEmpty: 'No pages match',
	pageCurrent: 'This page',
	pageDraft: 'Draft',
	pageChanged: 'Changed',
	addProductPage: 'Add a product page',
	addingProductPage: 'Making the product page…',
	addedProductPage: 'Opening the product page…',
	productPageHint:
		'This product has no page yet. Add one for what the store doesn’t say.',
	addCollectionPage: 'Add a collection page',
	addingCollectionPage: 'Making the collection page…',
	addedCollectionPage: 'Opening the collection page…',
	collectionPageHint:
		'This collection has no page yet. Add one for what goes around its products.',
}

export type PromptBoxOptions = {
	labels?: Partial<PromptLabels> | undefined
	// Controls of your own in the box (Content's canvas puts its zoom there):
	// an element of the page, shown next to the closed box and in the open
	// box's footer, by a `<slot>`, so the page's own CSS styles it.
	actions?: HTMLElement | undefined
	// `false` leaves Sign out out (where signing out is the page's own
	// business, like a dashboard). Default: shown on the site.
	signOut?: boolean | undefined
	// `true` keeps the prompt where the bridge has no page (`entryId` null):
	// the bridge's `prompt` says what it acts on (a canvas: the whole site),
	// with New page beside it. Default: such a page offers only New page.
	promptWithoutPage?: boolean | undefined
}

type Side = 'left' | 'center' | 'right'
const SIDE_KEY = 'obelism-content-prompt-side'
// How far the pointer moves before it drags the box, not clicks it.
const DRAG_THRESHOLD_PX = 6
// How far ahead a flick carries the box: its speed for this long.
const FLICK_MS = 150
// …at most this far, so one coarse pointer event isn't a flick across the
// screen…
const FLICK_MAX_PX = 120
// …and none when the pointer stood still this long before letting go.
const FLICK_STALE_MS = 80
// Its distance from the side of the screen, as in the CSS.
const EDGE_PX = 16

// Icons (Lucide), drawn in the text colour.
const ICONS = {
	page: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
	newPage:
		'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
	block:
		'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 8h10"/><path d="M7 12h6"/>',
	undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
	minimize: '<path d="m6 9 6 6 6-6"/>',
	expand: '<path d="m18 15-6-6-6 6"/>',
	chevrons: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
	search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
	check: '<path d="M20 6 9 17l-5-5"/>',
	mark: '<path d="M12 3v18M3 12h18"/><g fill="currentColor" stroke="none"><circle cx="7" cy="7" r="1.75"/><circle cx="17" cy="7" r="1.75"/><circle cx="7" cy="17" r="1.75"/><circle cx="17" cy="17" r="1.75"/></g>',
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
	transition: translate .45s cubic-bezier(0.34, 1.3, 0.64, 1);
	z-index: 2147483647; width: min(640px, calc(100vw - 32px)); color-scheme: light dark;
	font: 400 14px/1.4 var(--font-inter); color: rgb(var(--theme-foreground-rgb));
	-webkit-font-smoothing: antialiased;
}
/* Dragged to a side of the screen, it stays there, springing into place. */
.root[data-side='left'] { left: 16px; transform: none; }
.root[data-side='right'] { left: auto; right: 16px; transform: none; }
.root[data-side='left'] .bar { justify-content: flex-start; }
.root[data-side='right'] .bar { justify-content: flex-end; }
.root.dragging { transition: none; user-select: none; -webkit-user-select: none; }
.root.dragging, .root.dragging * { cursor: grabbing !important; }
.toolbar, .footer, .status { cursor: grab; touch-action: none; }
.pill { touch-action: none; }
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
.bar { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px; }
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
.mark { color: rgb(var(--theme-accent-rgb)); }
.mark svg { width: 20px; height: 20px; }
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
	.root, .panel { animation: none; transition: none; }
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
/* Form: the CMS's entry form, edited live. */
.form { padding: 12px 12px 0; }
.form iframe {
	display: block; width: 100%; height: min(560px, 60vh); border: none; border-radius: 12px;
	background: rgb(var(--theme-background-actions-rgb) / .45);
}
/* Loading, it keeps the form's own height, the spinner in the middle,
   whatever the form says meanwhile; the frame shows once the form does. */
.form.loading { position: relative; height: calc(min(560px, 60vh) + 12px); }
.form.loading iframe { position: absolute; visibility: hidden; }
.form-loader {
	position: absolute; inset: 12px 12px 0; display: flex; align-items: center; justify-content: center;
	gap: 10px; border-radius: 12px; color: rgb(var(--theme-foreground-muted-rgb));
	background: rgb(var(--theme-background-actions-rgb) / .45);
}
.form-loader::before {
	content: ''; width: 16px; height: 16px; flex: none; border-radius: 50%;
	border: 2px solid rgb(var(--theme-border-rgb) / .3); border-top-color: rgb(var(--theme-accent-rgb));
	animation: spin .7s linear infinite;
}
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
/* Prompt or Form: two small pills in one track. */
.modes {
	display: inline-flex; flex: none; gap: 2px; padding: 2px; border-radius: var(--border-radius-pill);
	border: 1px solid rgb(var(--theme-border-rgb) / .2); background: rgb(var(--theme-background-actions-rgb) / .6);
}
.modes button {
	height: 28px; padding: 0 12px; border-radius: var(--border-radius-pill); font-size: 13px;
	color: rgb(var(--theme-foreground-muted-rgb));
	transition: background-color .25s var(--ease-roll), color .25s var(--ease-roll);
}
.modes button:hover { color: rgb(var(--theme-foreground-rgb)); }
.modes button[aria-pressed='true'] {
	background: rgb(var(--theme-background-alt-rgb)); color: rgb(var(--theme-foreground-rgb));
	box-shadow: 0 1px 2px rgb(var(--color-black-rgb) / .08);
}
.divider { width: 1px; height: 20px; background: rgb(var(--theme-border-rgb) / .3); margin: 0 4px; }

/* On the site: storing the draft, and the way out. */
.footer {
	display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 12px 10px 22px;
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

/* The pages: a search above a list, in place of the prompt while open. */
.page-chip { min-width: 0; max-width: 50%; gap: 6px; }
.page-chip > span:not(.icon) { overflow: hidden; text-overflow: ellipsis; }
.page-chip .icon:last-child { color: rgb(var(--theme-foreground-muted-rgb)); margin-right: -4px; }
.page-chip .icon:last-child svg { width: 14px; height: 14px; }
.pages { display: grid; gap: 8px; padding: 16px 12px 12px; }
.search {
	display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; margin: 0 4px;
	border: 1px solid rgb(var(--theme-border-rgb) / .25); border-radius: var(--border-radius-pill);
	background: rgb(var(--theme-background-actions-rgb) / .45); color: rgb(var(--theme-foreground-muted-rgb));
	transition: border-color .25s var(--ease-roll);
}
.search:focus-within { border-color: rgb(var(--theme-accent-rgb)); }
.search input { flex: 1; min-width: 0; height: 100%; border: 0; outline: 0; background: transparent; color: rgb(var(--theme-foreground-rgb)); }
.search input::placeholder { color: rgb(var(--theme-foreground-muted-rgb)); }
.options { list-style: none; padding: 0; max-height: min(300px, 40vh); overflow-y: auto; display: grid; gap: 2px; }
.option {
	display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; cursor: pointer;
	transition: background-color .15s var(--ease-roll);
}
.option:hover, .option.active { background: rgb(var(--theme-background-actions-rgb) / .7); }
.option-text { flex: 1; min-width: 0; display: grid; }
.option-text > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.option-path { font-size: 12px; color: rgb(var(--theme-foreground-muted-rgb)); }
.badge {
	flex: none; font-size: 12px; padding: 1px 8px; border-radius: var(--border-radius-pill);
	border: 1px solid rgb(var(--theme-border-rgb) / .3); color: rgb(var(--theme-foreground-muted-rgb));
}
.option .icon { color: rgb(var(--theme-accent-rgb)); }
.empty { padding: 8px 12px; color: rgb(var(--theme-foreground-muted-rgb)); }
.empty.error { color: var(--theme-error); }
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

const mark = (doc: Document) => {
	const span = icon(doc, 'mark')
	span.classList.add('mark')
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
		// The Obelism mark (⁜), drawn: the glyph sits low in most fonts.
		mark(doc),
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
	// Form mode (on the site): the CMS's form, mounted while shown.
	const formLoader = element(doc, 'div', {
		className: 'form-loader',
		textContent: labels.formLoading,
	})
	formLoader.setAttribute('role', 'status')
	const formBox = element(doc, 'div', { className: 'form' }, formLoader)

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

	// Prompt or Form (on the site).
	const modeButton = (text: string) => {
		const button = element(doc, 'button', { type: 'button', textContent: text })
		button.setAttribute('aria-pressed', 'false')
		return button
	}
	const promptMode = modeButton(labels.modePrompt)
	const formMode = modeButton(labels.form)
	const modes = element(
		doc,
		'span',
		{ className: 'modes' },
		promptMode,
		formMode,
	)
	modes.setAttribute('role', 'group')
	modes.setAttribute('aria-label', labels.modes)

	// New page (on the site, for people who may add pages): the scope becomes
	// the new page, with a way back, and a path field shows above the prompt.
	const newPage = element(
		doc,
		'button',
		{ className: 'action chip', type: 'button' },
		icon(doc, 'newPage'),
		labels.newPage,
	)
	// A product (collection) the site marks (editableProduct,
	// editableCollection) without a page of its own: one click makes its
	// page, which the page then shows.
	const addProduct = element(
		doc,
		'button',
		{ className: 'action chip product', type: 'button' },
		icon(doc, 'newPage'),
		labels.addProductPage,
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
	// Minimized, only the toolbar and footer show, so a short page stays in
	// view; the form stays mounted (and its edits) meanwhile.
	const minimizeIcon = icon(doc, 'minimize')
	const expandIcon = icon(doc, 'expand')
	const minimize = element(
		doc,
		'button',
		{ className: 'icon-button', type: 'button' },
		minimizeIcon,
		expandIcon,
	)
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
	const divider = element(doc, 'span', { className: 'divider' })
	const toolbar = element(
		doc,
		'div',
		{ className: 'toolbar' },
		scope,
		newScope,
		modes,
		undo,
		addProduct,
		newPage,
		element(doc, 'span', { className: 'spacer' }),
		minimize,
		close,
		divider,
		send,
	)

	// The pages (on the site): a chip naming this page, opening a search
	// and a list of every page in place of the prompt.
	const pageChipText = element(doc, 'span', { textContent: labels.pages })
	const pageChip = element(
		doc,
		'button',
		{ className: 'chip page-chip', type: 'button', title: labels.pages },
		icon(doc, 'page'),
		pageChipText,
		icon(doc, 'chevrons'),
	)
	pageChip.setAttribute('aria-haspopup', 'listbox')
	pageChip.setAttribute('aria-expanded', 'false')
	pageChip.setAttribute('aria-controls', 'obelism-pages')
	const search = element(doc, 'input', {
		type: 'text',
		placeholder: labels.pagesSearch,
		autocomplete: 'off',
		spellcheck: false,
	})
	search.setAttribute('role', 'combobox')
	search.setAttribute('aria-label', labels.pagesSearch)
	search.setAttribute('aria-autocomplete', 'list')
	search.setAttribute('aria-expanded', 'true')
	search.setAttribute('aria-controls', 'obelism-pages')
	const optionList = element(doc, 'ul', {
		className: 'options',
		id: 'obelism-pages',
	})
	optionList.setAttribute('role', 'listbox')
	optionList.setAttribute('aria-label', labels.pages)
	const pagesNote = element(doc, 'p', { className: 'empty' })
	const pagesSection = element(
		doc,
		'div',
		{ className: 'pages' },
		element(doc, 'label', { className: 'search' }, icon(doc, 'search'), search),
		optionList,
		pagesNote,
	)

	// The page's own controls (`actions`), in the footer while open and next
	// to the pill while closed.
	const actionsInFooter = element(doc, 'slot')
	actionsInFooter.name = 'actions-footer'
	const actionsInBar = element(doc, 'slot')
	actionsInBar.name = 'actions-bar'
	if (options.actions) {
		options.actions.slot = 'actions-bar'
		host.appendChild(options.actions)
	}

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
		pageChip,
		unsaved,
		element(doc, 'span', { className: 'spacer' }),
		actionsInFooter,
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
		formBox,
		toolbar,
		pagesSection,
		footer,
	)
	const root = element(
		doc,
		'div',
		{ className: 'root' },
		element(doc, 'div', { className: 'bar' }, pill, viewing, actionsInBar),
		panel,
	)
	shadow.append(element(doc, 'style', { textContent: CSS }), root)

	// Dragged sideways, the box moves to the left, the middle or the right
	// of the screen, whichever third it is let go (or flicked) in; this
	// browser remembers where. From the pill, or the open box's bars, not its
	// fields and buttons.
	const win = doc.defaultView
	const readSide = (): Side => {
		try {
			const side = win?.localStorage.getItem(SIDE_KEY)
			return side === 'left' || side === 'right' ? side : 'center'
		} catch {
			return 'center'
		}
	}
	const placeAt = (side: Side) => {
		if (side === 'center') delete root.dataset.side
		else root.dataset.side = side
	}
	placeAt(readSide())
	let drag: {
		id: number
		startX: number
		x: number
		velocity: number
		time: number
		moved: boolean
		// How far it may go before it resists, to stay on the screen.
		min: number
		max: number
	} | null = null
	// A drag that ends on the pill isn't a click on it.
	let dragged = false
	root.addEventListener('pointerdown', (event) => {
		dragged = false
		if (event.button !== 0 || !event.isPrimary) return
		const target = event.target as Element
		const control = target.closest(
			'button, input, textarea, select, iframe, a, label, .pages, .form',
		)
		if (control && control !== pill) return
		const { left, right } = root.getBoundingClientRect()
		drag = {
			id: event.pointerId,
			startX: event.clientX,
			x: event.clientX,
			velocity: 0,
			time: event.timeStamp,
			moved: false,
			min: Math.min(0, EDGE_PX - left),
			max: Math.max(0, (win?.innerWidth ?? 0) - EDGE_PX - right),
		}
	})
	root.addEventListener('pointermove', (event) => {
		if (!drag || event.pointerId !== drag.id) return
		const dx = event.clientX - drag.startX
		if (!drag.moved) {
			if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
			drag.moved = true
			root.classList.add('dragging')
			try {
				root.setPointerCapture(event.pointerId)
			} catch {}
		}
		const elapsed = event.timeStamp - drag.time
		if (elapsed > 0) drag.velocity = (event.clientX - drag.x) / elapsed
		drag.x = event.clientX
		drag.time = event.timeStamp
		// Past the edge, a third as far.
		const clamped = Math.min(Math.max(dx, drag.min), drag.max)
		root.style.translate = `${clamped + (dx - clamped) / 3}px 0`
	})
	const drop = (event: PointerEvent) => {
		if (!drag || event.pointerId !== drag.id) return
		const { moved, x, velocity, time } = drag
		drag = null
		if (!moved) return
		dragged = true
		// Springs from where it was let go to its new place.
		const before = root.getBoundingClientRect().left
		const width = win?.innerWidth ?? 0
		const flick =
			event.timeStamp - time > FLICK_STALE_MS
				? 0
				: Math.min(Math.max(velocity * FLICK_MS, -FLICK_MAX_PX), FLICK_MAX_PX)
		const projected = x + flick
		const side: Side =
			projected < width / 3
				? 'left'
				: projected > (width * 2) / 3
					? 'right'
					: 'center'
		placeAt(side)
		root.style.translate = ''
		const after = root.getBoundingClientRect().left
		root.style.translate = `${before - after}px 0`
		void root.offsetWidth
		root.classList.remove('dragging')
		root.style.translate = ''
		try {
			win?.localStorage.setItem(SIDE_KEY, side)
		} catch {}
	}
	root.addEventListener('pointerup', drop)
	root.addEventListener('pointercancel', drop)
	root.addEventListener(
		'click',
		(event) => {
			if (!dragged) return
			dragged = false
			event.preventDefault()
			event.stopPropagation()
		},
		true,
	)

	let open = false
	let minimized = false
	let creating = false
	let message: { text: string; error: boolean } | null = null
	// Form mode, and the form while mounted: a fresh one (and one-time
	// address) every time it shows.
	let form = false
	let formHandle: FormHandle | null = null
	let formLoading = false
	// The pages, fetched once the panel opens and kept; `active` is the
	// option arrow keys are on.
	let picking = false
	let pages: SitePage[] | null = null
	let pagesLoad: Promise<void> | null = null
	let pagesError: string | null = null
	let active = 0

	const failure = (error: unknown) => ({
		text: error instanceof Error ? error.message : String(error),
		error: true,
	})

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
		// …unless it shows a product (collection): then Add a product
		// (collection) page first.
		const shopHere =
			!pageless || !canCreate
				? null
				: bridge.product
					? ('product' as const)
					: bridge.collection
						? ('collection' as const)
						: null
		const productHere = shopHere !== null
		const shopCopy =
			shopHere === 'collection'
				? {
						add: labels.addCollectionPage,
						adding: labels.addingCollectionPage,
						hint: labels.collectionPageHint,
					}
				: {
						add: labels.addProductPage,
						adding: labels.addingProductPage,
						hint: labels.productPageHint,
					}
		addProduct.lastChild!.textContent = shopCopy.add
		const onlyNew =
			pageless && canCreate && !productHere && !options.promptWithoutPage
		if (!canCreate) creating = false
		if (onlyNew) creating = true
		if (creating || pageless || !site) form = false
		// The form is there only while shown in the open panel.
		const showForm = open && available && form
		if (showForm && !formHandle) mountForm()
		else if (!showForm && formHandle) unmountForm()
		const offerProduct = productHere && !creating
		pillText.textContent = offerProduct
			? shopCopy.add
			: onlyNew
				? labels.newPage
				: labels.open
		cancelNew.hidden = onlyNew
		scope.hidden = creating || offerProduct
		newScope.hidden = !creating
		addProduct.hidden = !offerProduct
		addProduct.disabled = busy
		newPage.hidden = creating || form || !canCreate
		newPage.disabled = busy
		if (minimized) picking = false
		pathRow.hidden = !creating || picking || minimized
		pathInput.disabled = busy
		input.hidden = form || picking || minimized || offerProduct
		formBox.hidden = !form || picking || minimized
		formBox.classList.toggle('loading', formLoading)
		formLoader.hidden = !formLoading
		toolbar.hidden = picking
		pagesSection.hidden = !picking
		input.placeholder = creating
			? labels.newPagePlaceholder
			: labels.placeholder
		scopeText.textContent = state.selectedUid
			? labels.scopeBlock
			: pageless
				? labels.scopeNoPage
				: labels.scopeEntry
		clearBlock.hidden = !state.selectedUid
		pageIcon.hidden = !!state.selectedUid
		blockIcon.hidden = !state.selectedUid
		// A CMS from before the form doesn't offer it.
		modes.hidden =
			!site || creating || pageless || !state.features.includes('form')
		promptMode.setAttribute('aria-pressed', String(!form))
		formMode.setAttribute('aria-pressed', String(form))
		modes.querySelectorAll('button').forEach((button) => {
			button.disabled = busy
		})
		undo.hidden = creating || !state.canUndo
		undo.disabled = busy
		// The form applies edits as they are made.
		send.hidden = form || minimized || offerProduct
		divider.hidden = form || minimized || offerProduct
		const toggleLabel = minimized ? labels.expand : labels.minimize
		minimize.title = toggleLabel
		minimize.setAttribute('aria-label', toggleLabel)
		minimize.setAttribute('aria-expanded', String(!minimized))
		minimizeIcon.hidden = minimized
		expandIcon.hidden = !minimized
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
		signOut.hidden = !site || options.signOut === false
		pillSignOut.hidden = options.signOut === false
		if (options.actions) {
			options.actions.slot =
				open && available ? 'actions-footer' : 'actions-bar'
		}
		footer.hidden = !site
		unsaved.hidden = !state.unsaved
		pageChip.hidden = !site
		pageChip.setAttribute('aria-expanded', String(picking))
		pageChipText.textContent =
			pages?.find(({ entryId }) => entryId === bridge.entryId)?.name ??
			labels.pages
		const loadingForm = form && formLoading && !picking
		const working = state.prompting
		// A form opening says so in its own place.
		const note = state.prompting
			? creating
				? labels.creating
				: offerProduct
					? shopCopy.adding
					: labels.working
			: loadingForm
				? ''
				: (message?.text ??
					(offerProduct
						? shopCopy.hint
						: site && !creating && !picking && !state.selectedUid
							? labels.selectHint
							: ''))
		status.textContent = note
		status.hidden = !note || minimized
		status.className = `status${working ? ' working' : ''}${!busy && !loadingForm && message?.error ? ' error' : ''}`
	}
	const refresh = () => render(bridge.getState())

	const grow = () => {
		input.style.height = 'auto'
		input.style.height = `${input.scrollHeight}px`
	}

	// Callbacks come later (the address is fetched first), never during a
	// render.
	const mountForm = () => {
		formLoading = true
		formBox.classList.add('loading')
		const handle = bridge.openForm(formBox, {
			title: labels.formTitle,
			onReady: () => {
				if (formHandle !== handle) return
				formLoading = false
				message = null
				refresh()
			},
			onError: (text) => {
				if (formHandle !== handle) return
				formLoading = false
				message = { text, error: true }
				refresh()
			},
		})
		formHandle = handle
	}

	const unmountForm = () => {
		formHandle?.close()
		formHandle = null
		formLoading = false
	}

	const setForm = (next: boolean) => {
		if (form === next) return
		form = next
		message = null
		refresh()
		if (!form) input.focus()
	}

	const submit = async () => {
		if (form) return
		const prompt = input.value.trim()
		if (!prompt || bridge.getState().prompting) return
		message = null
		try {
			if (creating) {
				const path = pathInput.value.trim()
				if (!path) return pathInput.focus()
				// The bridge opens the new page; this shows until it does.
				await bridge.createPage(path, prompt)
				pages = null
				pagesLoad = null
				message = { text: labels.created, error: false }
			} else {
				const { summary } = await bridge.prompt(prompt)
				message = { text: summary, error: false }
			}
			input.value = ''
			grow()
		} catch (error) {
			message = failure(error)
		}
		refresh()
		input.focus()
	}

	const fetchPages = () => {
		pagesLoad ??= bridge.pages().then(
			(list) => {
				pages = list
				pagesError = null
				renderPages()
				refresh()
			},
			(error: unknown) => {
				pagesLoad = null
				pagesError = failure(error).text
				renderPages()
			},
		)
		return pagesLoad
	}

	const matching = () => {
		const query = search.value.trim().toLowerCase()
		return (pages ?? []).filter(
			(page) =>
				!query ||
				page.name.toLowerCase().includes(query) ||
				page.url.toLowerCase().includes(query) ||
				`/${page.path}`.toLowerCase().includes(query),
		)
	}

	const renderPages = () => {
		const list = matching()
		active = Math.max(0, Math.min(active, list.length - 1))
		optionList.textContent = ''
		list.forEach((page, index) => {
			const current = page.entryId === bridge.entryId
			const option = element(
				doc,
				'li',
				{
					className: `option${index === active ? ' active' : ''}`,
					id: `obelism-page-${index}`,
				},
				element(
					doc,
					'span',
					{ className: 'option-text' },
					element(doc, 'span', { textContent: page.name }),
					element(doc, 'span', {
						className: 'option-path',
						textContent: page.url,
					}),
				),
			)
			option.setAttribute('role', 'option')
			option.setAttribute('aria-selected', String(index === active))
			if (page.status !== 'published') {
				option.appendChild(
					element(doc, 'span', {
						className: 'badge',
						textContent:
							page.status === 'draft' ? labels.pageDraft : labels.pageChanged,
					}),
				)
			}
			if (current) {
				option.setAttribute('aria-current', 'page')
				const check = icon(doc, 'check')
				check.removeAttribute('aria-hidden')
				check.setAttribute('role', 'img')
				check.setAttribute('aria-label', labels.pageCurrent)
				option.appendChild(check)
			}
			option.addEventListener('click', () => choose(page))
			optionList.appendChild(option)
		})
		const activeOption = optionList.children[active]
		if (activeOption) {
			search.setAttribute('aria-activedescendant', activeOption.id)
			activeOption.scrollIntoView?.({ block: 'nearest' })
		} else {
			search.removeAttribute('aria-activedescendant')
		}
		const note = pagesError ?? (pages ? '' : labels.pagesLoading)
		pagesNote.textContent = note || (list.length === 0 ? labels.pagesEmpty : '')
		pagesNote.hidden = !pagesNote.textContent
		pagesNote.className = `empty${pagesError ? ' error' : ''}`
	}

	const setPicking = (next: boolean) => {
		picking = next
		message = null
		if (picking) {
			search.value = ''
			active = Math.max(
				0,
				(pages ?? []).findIndex(({ entryId }) => entryId === bridge.entryId),
			)
			void fetchPages()
			renderPages()
		}
		refresh()
		;(picking ? search : pageChip).focus()
	}

	const choose = (page: SitePage) => {
		if (page.entryId === bridge.entryId) return setPicking(false)
		// Asks first when changes aren't saved; stays here if told no.
		bridge.openPage(page)
	}

	const setOpen = (next: boolean) => {
		open = next
		if (!open) {
			picking = false
			minimized = false
		}
		refresh()
		if (site) bridge.setSelecting(open && !creating)
		if (open && site) void fetchPages()
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
			message = failure(error)
		}
		refresh()
	}

	pill.addEventListener('click', () => {
		setOpen(true)
		if (!form) (creating ? pathInput : input).focus()
	})
	close.addEventListener('click', () => setOpen(false))
	minimize.addEventListener('click', () => {
		minimized = !minimized
		refresh()
		if (!minimized) (form ? minimize : input).focus()
	})
	// Any other button of the minimized box expands it first (capture, so
	// its own handler then sees the box open), e.g. the pages or New page.
	panel.addEventListener(
		'click',
		(event) => {
			if (!minimized) return
			const button = (event.target as Element).closest('button')
			if (!button || button === minimize || button === close) return
			minimized = false
			refresh()
		},
		true,
	)
	save.addEventListener('click', () => void store('save'))
	publish.addEventListener('click', () => void store('publish'))
	signOut.addEventListener('click', () => bridge.signOut())
	pillSignOut.addEventListener('click', () => bridge.signOut())
	clearBlock.addEventListener('click', () => bridge.select(null))
	newPage.addEventListener('click', () => setCreating(true))
	addProduct.addEventListener('click', async () => {
		message = null
		try {
			// The bridge reloads the page; this shows until it does.
			if (bridge.product) {
				await bridge.createProductPage()
				message = { text: labels.addedProductPage, error: false }
			} else {
				await bridge.createCollectionPage()
				message = { text: labels.addedCollectionPage, error: false }
			}
		} catch (error) {
			message = failure(error)
		}
		refresh()
	})
	cancelNew.addEventListener('click', () => setCreating(false))
	promptMode.addEventListener('click', () => setForm(false))
	formMode.addEventListener('click', () => setForm(true))
	pageChip.addEventListener('click', () => setPicking(!picking))
	pathInput.addEventListener('input', refresh)
	pathInput.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			input.focus()
		} else if (event.key === 'Escape') {
			setOpen(false)
		}
	})
	search.addEventListener('input', () => {
		active = 0
		renderPages()
	})
	search.addEventListener('keydown', (event) => {
		const count = optionList.children.length
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault()
			if (count === 0) return
			active = (active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count
			renderPages()
		} else if (event.key === 'Enter' && !event.isComposing) {
			event.preventDefault()
			const page = matching()[active]
			if (page) choose(page)
		} else if (event.key === 'Escape') {
			event.preventDefault()
			setPicking(false)
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
		unmountForm()
		host.remove()
	}
}
