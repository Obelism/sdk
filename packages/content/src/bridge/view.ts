import type { BridgeState, ContentBridge } from './contract'
import type { PromptLabels, SiteEditorLabels } from './labels'
import { pageContext } from './siteActions'

// What the prompt box and the on-site editor both read the bridge's state to
// find out, worked out once.

export type BridgeViewOptions = {
	promptWithoutPage?: boolean | undefined
	signOut?: boolean | undefined
	// The words for the page's two kinds of prompt field.
	labels: Pick<
		PromptLabels & SiteEditorLabels,
		'placeholder' | 'newPagePlaceholder'
	>
}

export const bridgeView = (
	bridge: ContentBridge,
	state: BridgeState,
	// What the editor asked for; `creating` is that, kept in step with what
	// the page actually offers.
	intent: { creating: boolean },
	{ promptWithoutPage, signOut, labels }: BridgeViewOptions,
) => {
	const page = pageContext(bridge, state, promptWithoutPage)
	// A page with nothing to edit has one thing to offer; a page that can't
	// take a new one has nothing to make.
	const creating = page.canCreate && (intent.creating || page.onlyNew)
	const available = state.features.includes('prompt')
	const storing = state.saving || state.publishing
	const busy = state.prompting || storing
	return {
		...page,
		creating,
		available,
		storing,
		busy,
		// The page's product (collection) page, when that is all it can offer.
		offerShop: page.shop !== null && !creating,
		// The CMS's form is for a page that is an entry, in its own mode,
		// when the CMS offers one (`state.features`).
		canForm: page.site && !creating && !page.pageless,
		placeholder: creating ? labels.newPagePlaceholder : labels.placeholder,
		canSave: state.features.includes('save') && !page.pageless,
		canPublish: state.features.includes('publish') && !page.pageless,
		showSignOut: page.site && signOut !== false,
		// Sending needs something to say, and a path when making a page.
		canSend: (prompt: string, path: string) =>
			!busy && prompt.trim() !== '' && (!creating || path.trim() !== ''),
	}
}
