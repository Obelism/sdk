export const UID_ATTRIBUTE = 'data-cms-uid'
export const ENTRY_ATTRIBUTE = 'data-cms-entry'
export const PRODUCT_ATTRIBUTE = 'data-cms-product'
export const PRODUCT_HANDLE_ATTRIBUTE = 'data-cms-product-handle'

type Editable = { 'data-cms-uid'?: string; 'data-cms-entry'?: string }

// The attribute that lets editors select a block on the page, in the visual
// editor and on the site. Spread it on the block's outermost element:
//
//   <section {...editable(block)}>…</section>
//
// Given an entry, it marks the element the entry renders into, which editing
// on the site (outside the visual editor) needs to know what a prompt, Save
// and Publish act on:
//
//   <main {...editable(entry)}>…</main>
export const editable = (
	target:
		{ _uid?: string } | { id: string; fields: unknown } | null | undefined,
): Editable => {
	if (!target) return {}
	if ('_uid' in target && target._uid) return { 'data-cms-uid': target._uid }
	if ('id' in target && 'fields' in target && target.id) {
		return { 'data-cms-entry': target.id }
	}
	return {}
}

type EditableProduct = {
	'data-cms-product'?: string
	'data-cms-product-handle'?: string
}

// The Shopify product a page shows, on a product route: editing on the site
// then offers "Add a product page" when the page has no product page yet
// (no `editable(entry)`), and makes one for this product.
//
//   <main {...editableProduct(product)} {...editable(page)}>…</main>
//
// `product` is the store's (its GID and handle), from the Storefront API or
// a Shopify field.
export const editableProduct = (
	product: { id: string; handle: string } | null | undefined,
): EditableProduct =>
	product?.id
		? {
				'data-cms-product': product.id,
				'data-cms-product-handle': product.handle,
			}
		: {}
