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

	it("crops around the asset's focal point, or the one asked for", () => {
		const focused = { ...asset, focalPoint: { x: 0.25, y: 0.6 } }
		expect(imageUrl(focused, { w: 400, h: 400, fit: 'cover' })).toBe(
			`${asset.url}?w=400&h=400&fit=cover&focus=0.25%2C0.6`,
		)
		// Nothing is cut off without cover or crop.
		expect(imageUrl(focused, { w: 400 })).toBe(`${asset.url}?w=400`)
		expect(imageUrl(asset, { w: 400, fit: 'crop', focus: 'auto' })).toBe(
			`${asset.url}?w=400&fit=crop&focus=auto`,
		)
	})

	it('builds a srcset', () => {
		expect(imageSrcSet(asset, [480, 960], { q: 70 })).toBe(
			`${asset.url}?w=480&q=70 480w, ${asset.url}?w=960&q=70 960w`,
		)
	})
})
