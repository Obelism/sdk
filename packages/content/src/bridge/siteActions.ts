import type { BridgeState, ContentBridge } from './contract'
import type { SharedLabels } from './labels'
import { SHOP, type ShopKind, shopKindOf } from './shop'

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
	const shop: ShopKind | null =
		pageless && canCreate ? shopKindOf(bridge) : null
	const onlyNew = pageless && canCreate && !shop && !promptWithoutPage
	return { site, canCreate, pageless, shop, onlyNew }
}

// Makes the page's product (collection) page; the bridge then reloads, and
// the answer shows until it does.
export const addShopPage = async (
	bridge: ContentBridge,
	labels: SharedLabels,
	kind: ShopKind,
) => {
	try {
		if (kind === 'product') await bridge.createProductPage()
		else await bridge.createCollectionPage()
		return { text: labels[SHOP[kind].added], error: false }
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
