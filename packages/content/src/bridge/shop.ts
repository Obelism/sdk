import {
	COLLECTION_ATTRIBUTE,
	COLLECTION_HANDLE_ATTRIBUTE,
	PRODUCT_ATTRIBUTE,
	PRODUCT_HANDLE_ATTRIBUTE,
} from '../editable'
import type { ShopifyItem } from '../types'
import type { SharedLabels } from '../bridge/labels'
import type { ShopKind } from '../shopKinds'

export type { ShopKind }

// A product page and a collection page are the same thing to the bridge: a
// page made for the shop item a page shows. What differs is which attributes
// mark that item, which page type the CMS files it under, where the site keeps
// such pages, and what the box calls it — all here.

type ShopDefinition = {
	// The attributes `editableProduct` / `editableCollection` set.
	item: string
	handle: string
	// The site's setting for where these pages are, in the CMS, and its
	// default.
	setting: 'productPath' | 'collectionPath'
	route: string
	// How a page marks the item, for the error when it doesn't.
	marker: string
	add: keyof SharedLabels
	adding: keyof SharedLabels
	hint: keyof SharedLabels
	// Said once the CMS made it, before the page reloads.
	added: keyof SharedLabels
}

export const SHOP: Record<ShopKind, ShopDefinition> = {
	product: {
		item: PRODUCT_ATTRIBUTE,
		handle: PRODUCT_HANDLE_ATTRIBUTE,
		setting: 'productPath',
		route: '/products/{handle}',
		marker: 'editableProduct(product)',
		add: 'addProductPage',
		adding: 'addingProductPage',
		hint: 'productPageHint',
		added: 'addedProductPage',
	},
	collection: {
		item: COLLECTION_ATTRIBUTE,
		handle: COLLECTION_HANDLE_ATTRIBUTE,
		setting: 'collectionPath',
		route: '/collections/{handle}',
		marker: 'editableCollection(collection)',
		add: 'addCollectionPage',
		adding: 'addingCollectionPage',
		hint: 'collectionPageHint',
		added: 'addedCollectionPage',
	},
}

// The shop item the page marks with `editableProduct` or
// `editableCollection`, if it marks one.
export const pageShopItem = (
	doc: Document,
	kind: ShopKind,
): ShopifyItem | null => {
	const { item, handle } = SHOP[kind]
	const element = doc.querySelector(`[${item}]`)
	const id = element?.getAttribute(item)
	const itemHandle = element?.getAttribute(handle)
	return id && itemHandle ? { id, handle: itemHandle } : null
}

// A page's shop column, as the CMS's pages answer sends it: null or missing
// before it sent one.
type ShopColumns = {
	product?: ShopifyItem | null
	collection?: ShopifyItem | null
}

// Which kind of shop page a page entry is, else null.
export const shopKindOf = (page: ShopColumns): ShopKind | null =>
	page.product ? 'product' : page.collection ? 'collection' : null

export const shopItemOf = (page: ShopColumns): ShopifyItem | null =>
	page.product ?? page.collection ?? null

export const shopCopy = (labels: SharedLabels, kind: ShopKind) => {
	const shop = SHOP[kind]
	return {
		add: labels[shop.add],
		adding: labels[shop.adding],
		hint: labels[shop.hint],
		added: labels[shop.added],
	}
}
