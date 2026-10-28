import type { BridgeState, ContentBridge } from './createBridge'
import type { SharedLabels } from './labels'

// What the prompt box and the on-site editor decide alike on the site.

export const failure = (error: unknown) =>
	error instanceof Error ? error.message : String(error)

export const pageContext = (
	bridge: ContentBridge,
	state: BridgeState,
	promptWithoutPage: boolean | undefined,
) => {
	const site = bridge.mode === 'site'
	const canCreate = site && state.features.includes('create')
	// A page of the site that isn't an entry (no `editable(entry)`, like a
	// hand-written /about) has nothing to edit: only New page…
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
	const onlyNew = pageless && canCreate && !shopHere && !promptWithoutPage
	return { site, canCreate, pageless, shopHere, onlyNew }
}

export const shopCopy = (
	labels: SharedLabels,
	shopHere: 'product' | 'collection' | null,
) =>
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

// Makes the page's product (collection) page; the bridge then reloads, and
// the answer shows until it does.
export const addShopPage = async (
	bridge: ContentBridge,
	labels: SharedLabels,
) => {
	try {
		if (bridge.product) {
			await bridge.createProductPage()
			return { text: labels.addedProductPage, error: false }
		}
		await bridge.createCollectionPage()
		return { text: labels.addedCollectionPage, error: false }
	} catch (error) {
		return { text: failure(error), error: true }
	}
}

// Saves or publishes; the reason when that failed, else null.
export const storeChanges = async (
	bridge: ContentBridge,
	action: 'save' | 'publish',
) => {
	try {
		await bridge[action]()
		return null
	} catch (error) {
		return failure(error)
	}
}
