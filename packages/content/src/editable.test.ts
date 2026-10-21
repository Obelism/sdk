import { describe, expect, it } from 'vitest'

import { editable, editableCollection, editableProduct } from './editable'

describe('editable', () => {
	it('marks a block with its uid', () => {
		expect(editable({ _uid: 'b_1' })).toEqual({ 'data-cms-uid': 'b_1' })
		expect(editable(null)).toEqual({})
	})
})

describe('editableProduct', () => {
	it('marks the product a page shows', () => {
		expect(
			editableProduct({ id: 'gid://shopify/Product/42', handle: 'mug' }),
		).toEqual({
			'data-cms-product': 'gid://shopify/Product/42',
			'data-cms-product-handle': 'mug',
		})
		expect(editableProduct(null)).toEqual({})
	})
})

describe('editableCollection', () => {
	it('marks the collection a page shows', () => {
		expect(
			editableCollection({ id: 'gid://shopify/Collection/7', handle: 'sale' }),
		).toEqual({
			'data-cms-collection': 'gid://shopify/Collection/7',
			'data-cms-collection-handle': 'sale',
		})
		expect(editableCollection(null)).toEqual({})
	})
})
