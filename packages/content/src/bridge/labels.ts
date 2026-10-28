// The words of the prompt box and the on-site editor. What both say is
// `SharedLabels`; each adds its own.

export type SharedLabels = {
	open: string
	placeholder: string
	send: string
	undo: string
	minimize: string
	scopeEntry: string
	working: string
	publish: string
	saving: string
	publishing: string
	saved: string
	published: string
	unsaved: string
	signOut: string
	viewingDrafts: string
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

export const SHARED_LABELS: SharedLabels = {
	open: 'Edit with a prompt',
	placeholder: 'Describe a change, like “make it warmer”',
	send: 'Apply',
	undo: 'Undo',
	minimize: 'Minimize, to see the page',
	scopeEntry: 'Whole page',
	working: 'Working on it…',
	publish: 'Publish',
	saving: 'Saving…',
	publishing: 'Publishing…',
	saved: 'Saved as a draft',
	published: 'Published',
	unsaved: 'Unsaved changes',
	signOut: 'Exit',
	viewingDrafts: 'Viewing drafts',
	newPage: 'New page',
	newPageCancel: 'Edit this page instead',
	newPagePlaceholder:
		'Describe the new page, e.g. “a pricing page for agencies”',
	path: 'Path',
	pathPlaceholder: '/pricing',
	creating: 'Writing the page…',
	created: 'Opening the new page…',
	modes: 'Edit with',
	modePrompt: 'Ask',
	form: 'Edit fields',
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

export type PromptLabels = SharedLabels & {
	close: string
	expand: string
	// The scope with no page to act on (no entry), like Content's canvas
	// with nothing selected.
	scopeNoPage: string
	scopeBlock: string
	clearBlock: string
	save: string
	selectHint: string
}

export const DEFAULT_PROMPT_LABELS: PromptLabels = {
	...SHARED_LABELS,
	close: 'Close',
	expand: 'Expand',
	scopeNoPage: 'Whole page',
	scopeBlock: 'Selected block',
	clearBlock: 'Edit the whole page instead',
	save: 'Save',
	selectHint: 'Click a block to change only that block',
}

export type SiteEditorLabels = SharedLabels & {
	editor: string
	editing: string
	hideOutlines: string
	environment: string
	// How `production` reads; other environments show their own name.
	envProduction: string
	// `{name}`: the block's name, in bold.
	scopeNoteBlock: string
	scopeNotePage: string
	// A block whose type isn't known yet.
	block: string
	// `{name}`: the block's name.
	previewChip: string
	askIntro: string
	you: string
	obelism: string
	suggested: string
	keep: string
	retry: string
	// Sent for Try another; `{prompt}` is the request it retries.
	retryPrompt: string
	kept: string
	undone: string
	before: string
	after: string
	emptyValue: string
	// `{count}`: changed fields not shown.
	moreChanges: string
	keepFirst: string
	keepBeforeFields: string
	saveDraft: string
	upToDate: string
	saveFailed: string
	publishFailed: string
	tryAgain: string
}

export const DEFAULT_SITE_EDITOR_LABELS: SiteEditorLabels = {
	...SHARED_LABELS,
	editor: 'Obelism editor',
	editing: 'Editing',
	hideOutlines: 'Show the page without outlines',
	environment: 'Environment',
	envProduction: 'live',
	scopeNoteBlock: 'Working on {name}. Click another block to switch.',
	scopeNotePage:
		'Working on the whole page. Click a block to change only that block.',
	block: 'Block',
	previewChip: '{name} · preview',
	askIntro:
		'Describe a change and Obelism shows it on the page. Nothing is stored until you keep it and save.',
	you: 'You',
	obelism: 'Obelism',
	suggested: 'Suggested by Obelism',
	keep: 'Keep it',
	retry: 'Try another',
	retryPrompt: '{prompt}\n\nWrite a different version than the last one.',
	kept: 'Kept',
	undone: 'Undone',
	before: 'Before',
	after: 'After',
	emptyValue: 'Empty',
	moreChanges: '{count} more changed',
	keepFirst: 'Keep or undo the suggestion to save',
	keepBeforeFields: 'Keep or undo the suggestion before editing fields.',
	saveDraft: 'Save draft',
	upToDate: 'No unsaved changes',
	saveFailed: 'Couldn’t save',
	publishFailed: 'Couldn’t publish',
	tryAgain: 'Try again',
}
