import { describe, expect, it } from 'vitest'

import { imageSrcSet, imageUrl } from './images'

const asset = { url: 'https://content.obelism.studio/files/asset_1/photo.jpg' }

describe('images', () => {
	it('adds the transform to the url', () => {
		expect(imageUrl(asset, { w: 800, fit: 'cover', format: 'auto' })).toBe(
			`${asset.url}?w=800&fit=cover&format=auto`,
		)
		expect(imageUrl(asset.url)).toBe(asset.url)
	})

	it('builds a srcset', () => {
		expect(imageSrcSet(asset, [480, 960], { q: 70 })).toBe(
			`${asset.url}?w=480&q=70 480w, ${asset.url}?w=960&q=70 960w`,
		)
	})
})
